import type { SupabaseClient } from '@supabase/supabase-js';
import type { ModelMessage } from 'ai';

import { getLLMProvider } from '$lib/server/ai';
import { env } from '$lib/server/env';
import { errorMessage } from '$lib/server/error-message';
import {
	DEEP_FINAL_RESULT_COUNT,
	applyDeepSearchPreRankScores,
	normalizeDeepLibrarySearchIntent,
	shapeDeepLibrarySearchResults,
	type DeepSearchMergeInput
} from '$lib/search/deep-library-search-helpers';
import type {
	DeepLibrarySearchIntent,
	DeepLibrarySearchResponse,
	DeepLibrarySearchResult,
	DeepLibrarySearchStatusStep
} from '$lib/search/deep-library-search-types';

import {
	collectFastLibraryCandidatesForQueries,
	type DeepSearchFanoutCounts
} from './fast-library-search';
import { deepSearchIntentSchema, deepSearchRerankSchema } from './deep-library-search-schema';

const DEEP_PLANNER_SYSTEM = [
	'You interpret library search prompts for an academic PDF reading workspace.',
	'Return JSON with rewrittenQueries (1-3 retrieval phrases), targetKinds, and wantsRecent.',
	'Each rewrittenQuery should be 1-3 meaningful searchable tokens, not a full sentence.',
	'Preserve exact entities, names, and technical terms from the user prompt (for example HotpotQA).',
	'Do not add words the user did not mention (avoid invented terms like dataset, documentation, or download).',
	'Treat commands like point me to, show me, find, see, and need to as navigation intent, not searchable content.',
	'Use targetKinds to reflect whether the user wants text highlights, area highlights or figures, notes, or whole documents.',
	'For comments or notes, include note in targetKinds and use content phrases like "recent comment" or the topic words.',
	'For figures or screenshots, include area_highlight in targetKinds and preserve the visible topic words.',
	'For document-level requests, include document in targetKinds and use the document/topic words.',
	'Set wantsRecent true only when the prompt implies recency such as recent, latest, or newly written.',
	'Do not answer the user; only structure retrieval intent.'
].join(' ');

const DEEP_RERANK_SYSTEM = [
	'You rerank library search candidates for navigable highlight and document results.',
	'Prefer parent highlights over raw note matches. Prefer area highlights for figure-related prompts.',
	'Use document results only when no highlight is a strong match.',
	'Return at most six results with concise reason and matchedEvidence excerpt from the provided evidence.',
	'candidateKey must match an input candidate key exactly.'
].join(' ');

export type DeepLibrarySearchOptions = {
	supabase: SupabaseClient;
	ownerId: string;
	rawPrompt: string;
	currentDocumentId: string | null;
	onStatus: (step: DeepLibrarySearchStatusStep) => void;
	abortSignal: AbortSignal | undefined;
};

type AnnotationRow = {
	id: string;
	body: string;
	source: string;
	created_at: string;
	updated_at: string;
};

type HighlightHydrationRow = {
	id: string;
	document_id: string;
	page_number: number;
	kind: 'text' | 'area';
	text: string | null;
	comment: string | null;
	color: string;
	created_at: string;
	updated_at: string;
	annotations: AnnotationRow[] | null;
};

type DocumentHydrationRow = {
	id: string;
	title: string;
};

type SummaryHydrationRow = {
	document_id: string;
	markdown: string;
	tags: string[] | null;
	entities: string[] | null;
	created_at: string;
};

export type DeepSearchHydratedCandidate = DeepSearchMergeInput & {
	evidenceText: string;
	updatedAt: string | null;
};

type DeepSearchRankedHydratedCandidate = DeepSearchHydratedCandidate & {
	recencyBoost: number;
	kindBoost: number;
	preRankScore: number;
};

export async function searchDeepLibrary(
	opts: DeepLibrarySearchOptions
): Promise<DeepLibrarySearchResponse> {
	const prompt = opts.rawPrompt.trim().replace(/\s+/g, ' ');
	if (!prompt) {
		throw new Error('Enter a prompt to run Deep search.');
	}

	const statusSteps: DeepLibrarySearchStatusStep[] = [];
	const emitStatus = (step: DeepLibrarySearchStatusStep): void => {
		statusSteps.push(step);
		opts.onStatus(step);
	};

	emitStatus({
		phase: 'interpreting',
		label: 'Understanding your question…',
		detail: null
	});

	const interpretedIntent = await interpretDeepSearchPrompt({
		ownerId: opts.ownerId,
		prompt,
		abortSignal: opts.abortSignal
	});

	emitStatus({
		phase: 'searching',
		label: 'Searching your library…',
		detail: formatFanoutDetail(interpretedIntent.rewrittenQueries)
	});

	const { candidates, fanoutCounts } = await collectFastLibraryCandidatesForQueries(
		{
			supabase: opts.supabase,
			ownerId: opts.ownerId,
			rawQuery: prompt,
			currentDocumentId: opts.currentDocumentId
		},
		interpretedIntent.rewrittenQueries
	);

	emitStatus({
		phase: 'searching',
		label: 'Searching your library…',
		detail: formatFanoutCountsDetail(fanoutCounts)
	});

	if (candidates.length === 0) {
		return {
			prompt,
			interpretedIntent,
			statusSteps,
			results: []
		};
	}

	emitStatus({
		phase: 'reading',
		label: 'Reading passages that might fit…',
		detail: `Reviewing ${candidates.length} passages…`
	});

	const hydrated = await hydrateDeepSearchCandidates(opts.supabase, opts.ownerId, candidates);
	const scored: DeepSearchRankedHydratedCandidate[] = applyDeepSearchPreRankScores(
		hydrated.map(hydratedCandidateToMergeInput),
		interpretedIntent,
		Date.now()
	).map((candidate, index) => ({
		...hydrated[index],
		...candidate
	}));

	emitStatus({
		phase: 'ranking',
		label: 'Choosing the best matches…',
		detail: `Picking the top ${Math.min(scored.length, DEEP_FINAL_RESULT_COUNT)} for you…`
	});

	const results = await rerankDeepSearchCandidates({
		ownerId: opts.ownerId,
		prompt,
		intent: interpretedIntent,
		candidates: scored,
		abortSignal: opts.abortSignal
	});

	return {
		prompt,
		interpretedIntent,
		statusSteps,
		results
	};
}

async function interpretDeepSearchPrompt(opts: {
	ownerId: string;
	prompt: string;
	abortSignal: AbortSignal | undefined;
}): Promise<DeepLibrarySearchIntent> {
	const provider = getLLMProvider();
	const model = env.OPENROUTER_GENERATION_MODEL ?? env.OPENROUTER_FIGURE_MODEL;
	if (!model) {
		throw new Error('OPENROUTER_GENERATION_MODEL is required for Deep library search.');
	}

	const messages: ModelMessage[] = [{ role: 'user', content: opts.prompt }];

	try {
		const result = await provider.generate<DeepLibrarySearchIntent>({
			operation: 'deep_chat',
			ownerId: opts.ownerId,
			system: DEEP_PLANNER_SYSTEM,
			messages,
			model,
			schema: deepSearchIntentSchema,
			temperature: 0.2,
			abortSignal: opts.abortSignal
		});

		if (!result.object) {
			throw new Error('Deep search planner returned no structured intent.');
		}

		return normalizeDeepLibrarySearchIntent(result.object, opts.prompt);
	} catch (error) {
		console.error('[deep-library-search interpret]', {
			ownerId: opts.ownerId,
			prompt: opts.prompt,
			error: errorMessage(error, {
				operation: 'deep library search interpret',
				params: { ownerId: opts.ownerId, prompt: opts.prompt }
			})
		});
		throw error;
	}
}

async function rerankDeepSearchCandidates(opts: {
	ownerId: string;
	prompt: string;
	intent: DeepLibrarySearchIntent;
	candidates: DeepSearchRankedHydratedCandidate[];
	abortSignal: AbortSignal | undefined;
}): Promise<DeepLibrarySearchResult[]> {
	const provider = getLLMProvider();
	const model = env.OPENROUTER_GENERATION_MODEL ?? env.OPENROUTER_FIGURE_MODEL;
	if (!model) {
		throw new Error('OPENROUTER_GENERATION_MODEL is required for Deep library search.');
	}

	const candidatePayload = opts.candidates.map((candidate) => ({
		candidateKey: candidate.candidateKey,
		kind: candidate.kind,
		documentTitle: candidate.documentTitle,
		pageNumber: candidate.pageNumber,
		highlightKind: candidate.highlightKind,
		preRankScore: candidate.preRankScore,
		evidenceText: candidate.evidenceText
	}));

	const messages: ModelMessage[] = [
		{
			role: 'user',
			content: JSON.stringify({
				prompt: opts.prompt,
				intent: opts.intent,
				candidates: candidatePayload
			})
		}
	];

	try {
		const result = await provider.generate({
			operation: 'deep_chat',
			ownerId: opts.ownerId,
			system: DEEP_RERANK_SYSTEM,
			messages,
			model,
			schema: deepSearchRerankSchema,
			temperature: 0.2,
			abortSignal: opts.abortSignal
		});

		if (!result.object) {
			throw new Error('Deep search reranker returned no structured results.');
		}

		const parsed = deepSearchRerankSchema.parse(result.object);
		const candidateByKey = new Map(
			opts.candidates.map((candidate) => [candidate.candidateKey, candidate])
		);

		const ranked = parsed.results
			.map((entry) => {
				const candidate = candidateByKey.get(entry.candidateKey);
				if (!candidate) {
					return null;
				}

				return {
					candidate,
					reason: entry.reason,
					matchedEvidence: entry.matchedEvidence,
					score: entry.score,
					updatedAt: candidate.updatedAt
				};
			})
			.filter((entry): entry is NonNullable<typeof entry> => entry !== null);

		return shapeDeepLibrarySearchResults(ranked, DEEP_FINAL_RESULT_COUNT);
	} catch (error) {
		console.error('[deep-library-search rerank]', {
			ownerId: opts.ownerId,
			prompt: opts.prompt,
			candidateCount: opts.candidates.length,
			error: errorMessage(error, {
				operation: 'deep library search rerank',
				params: { ownerId: opts.ownerId, prompt: opts.prompt }
			})
		});
		throw error;
	}
}

async function hydrateDeepSearchCandidates(
	supabase: SupabaseClient,
	ownerId: string,
	candidates: DeepSearchMergeInput[]
): Promise<DeepSearchHydratedCandidate[]> {
	const highlightIds = candidates
		.map((candidate) => candidate.highlightId)
		.filter((highlightId): highlightId is string => highlightId !== null);
	const documentIds = [...new Set(candidates.map((candidate) => candidate.documentId))];

	const highlightsById = await fetchHighlightsByIds(supabase, ownerId, highlightIds);
	const documentsById = await fetchDocumentsByIds(supabase, ownerId, documentIds);
	const summariesByDocumentId = await fetchCurrentSummariesByDocumentIds(
		supabase,
		ownerId,
		documentIds
	);

	return candidates.map((candidate) => {
		if (candidate.kind === 'document') {
			const document = documentsById.get(candidate.documentId);
			const summary = summariesByDocumentId.get(candidate.documentId);
			const documentTitle = document?.title ?? candidate.documentTitle;
			const evidenceText = buildDocumentEvidenceText({
				documentTitle,
				summaryMarkdown: summary?.markdown ?? candidate.previewText ?? '',
				tags: normalizeStringList(summary?.tags),
				entities: normalizeStringList(summary?.entities)
			});
			const updatedAt = summary?.created_at ?? null;

			return {
				...candidate,
				documentTitle,
				evidenceText,
				updatedAt,
				updatedAtMs: updatedAt ? Date.parse(updatedAt) : null
			};
		}

		const highlight = candidate.highlightId ? highlightsById.get(candidate.highlightId) : undefined;
		const document = documentsById.get(candidate.documentId);
		const documentTitle = document?.title ?? candidate.documentTitle;
		const evidenceText = highlight
			? buildHighlightEvidenceText(highlight)
			: (candidate.previewText ?? '');
		const updatedAt = highlight
			? newestIsoTimestamp(highlight.updated_at, highlight.annotations)
			: null;

		return {
			...candidate,
			documentTitle,
			pageNumber: highlight?.page_number ?? candidate.pageNumber,
			highlightKind: highlight?.kind ?? candidate.highlightKind,
			evidenceText,
			updatedAt,
			updatedAtMs: updatedAt ? Date.parse(updatedAt) : null,
			hasComment: highlight ? Boolean(highlight.comment?.trim()) : candidate.hasComment === true,
			hasNote: highlight ? (highlight.annotations ?? []).length > 0 : candidate.hasNote === true
		};
	});
}

async function fetchHighlightsByIds(
	supabase: SupabaseClient,
	ownerId: string,
	highlightIds: string[]
): Promise<Map<string, HighlightHydrationRow>> {
	if (highlightIds.length === 0) {
		return new Map();
	}

	const { data, error } = await supabase
		.from('highlights')
		.select(
			'id, document_id, page_number, kind, text, comment, color, created_at, updated_at, annotations(id, body, source, created_at, updated_at)'
		)
		.eq('owner_id', ownerId)
		.in('id', highlightIds);

	if (error) {
		throw error;
	}

	return new Map(((data ?? []) as HighlightHydrationRow[]).map((row) => [row.id, row]));
}

async function fetchDocumentsByIds(
	supabase: SupabaseClient,
	ownerId: string,
	documentIds: string[]
): Promise<Map<string, DocumentHydrationRow>> {
	if (documentIds.length === 0) {
		return new Map();
	}

	const { data, error } = await supabase
		.from('documents')
		.select('id, title')
		.eq('owner_id', ownerId)
		.in('id', documentIds);

	if (error) {
		throw error;
	}

	return new Map(((data ?? []) as DocumentHydrationRow[]).map((row) => [row.id, row]));
}

async function fetchCurrentSummariesByDocumentIds(
	supabase: SupabaseClient,
	ownerId: string,
	documentIds: string[]
): Promise<Map<string, SummaryHydrationRow>> {
	if (documentIds.length === 0) {
		return new Map();
	}

	const { data, error } = await supabase
		.from('summaries')
		.select('document_id, markdown, tags, entities, created_at')
		.eq('owner_id', ownerId)
		.eq('is_current', true)
		.in('document_id', documentIds);

	if (error) {
		throw error;
	}

	return new Map(((data ?? []) as SummaryHydrationRow[]).map((row) => [row.document_id, row]));
}

function hydratedCandidateToMergeInput(
	candidate: DeepSearchHydratedCandidate
): DeepSearchMergeInput {
	return {
		candidateKey: candidate.candidateKey,
		kind: candidate.kind,
		highlightId: candidate.highlightId,
		documentId: candidate.documentId,
		documentTitle: candidate.documentTitle,
		pageNumber: candidate.pageNumber,
		highlightKind: candidate.highlightKind,
		retrievalScore: candidate.retrievalScore,
		href: candidate.href,
		previewText: candidate.previewText,
		updatedAtMs: candidate.updatedAtMs,
		hasComment: candidate.hasComment,
		hasNote: candidate.hasNote
	};
}

function buildHighlightEvidenceText(highlight: HighlightHydrationRow): string {
	const parts: string[] = [
		`Document highlight on page ${highlight.page_number}`,
		`Kind: ${highlight.kind}`
	];

	if (highlight.text) {
		parts.push(`Highlighted text: ${highlight.text}`);
	}

	if (highlight.comment) {
		parts.push(`Comment: ${highlight.comment}`);
	}

	for (const annotation of highlight.annotations ?? []) {
		parts.push(`Note (${annotation.source}): ${annotation.body}`);
	}

	return parts.join('\n');
}

function buildDocumentEvidenceText(opts: {
	documentTitle: string;
	summaryMarkdown: string;
	tags: string[];
	entities: string[];
}): string {
	const parts = [`Document: ${opts.documentTitle}`];

	if (opts.summaryMarkdown.trim()) {
		parts.push(`Summary: ${opts.summaryMarkdown.trim().slice(0, 1200)}`);
	}

	if (opts.tags.length > 0) {
		parts.push(`Themes: ${opts.tags.join(', ')}`);
	}

	if (opts.entities.length > 0) {
		parts.push(`Key entities: ${opts.entities.join(', ')}`);
	}

	return parts.join('\n');
}

function newestIsoTimestamp(
	highlightUpdatedAt: string,
	annotations: AnnotationRow[] | null
): string {
	let newest = highlightUpdatedAt;

	for (const annotation of annotations ?? []) {
		if (annotation.updated_at > newest) {
			newest = annotation.updated_at;
		}
	}

	return newest;
}

const FANOUT_DETAIL_QUERY_LIMIT = 3;

function formatFanoutDetail(queries: string[]): string | null {
	const trimmedQueries = queries.map((query) => query.trim()).filter((query) => query.length > 0);
	if (trimmedQueries.length === 0) {
		return null;
	}

	const displayedQueries = trimmedQueries.slice(0, FANOUT_DETAIL_QUERY_LIMIT);
	const quotedQueries = displayedQueries.map((query) => `“${query}”`).join(', ');
	const remainingCount = trimmedQueries.length - displayedQueries.length;
	if (remainingCount > 0) {
		return `Also trying: ${quotedQueries}, and ${remainingCount} more`;
	}

	return `Also trying: ${quotedQueries}`;
}

function normalizeStringList(values: string[] | null | undefined): string[] {
	return (values ?? []).map((value) => value.trim()).filter((value) => value.length > 0);
}

function formatFanoutCountsDetail(fanoutCounts: DeepSearchFanoutCounts[]): string | null {
	const totalMatches = fanoutCounts.reduce((sum, entry) => sum + entry.resultCount, 0);
	if (totalMatches === 0) {
		return null;
	}

	const matchLabel = totalMatches === 1 ? 'possible match' : 'possible matches';
	return `Found ${totalMatches} ${matchLabel} across your documents`;
}
