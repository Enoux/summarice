import type { SupabaseClient } from '@supabase/supabase-js';
import { getLLMProvider } from '$lib/server/ai';
import { configuredEmbeddingModel } from '$lib/server/embeddings/highlight-embedding-service';
import { errorMessage } from '$lib/server/error-message';
import { searchColorFilterValue } from '$lib/highlights/color-slots';

const VECTOR_LIMIT = 50;
const LEXICAL_LIMIT = 50;
const RRF_K = 60;
const MMR_LAMBDA = 0.7;
const MMR_POOL_SIZE = 20;
const RESULT_LIMIT = 10;
const GROUPED_LANE_LIMIT = 4;
const GROUPED_TOTAL_LIMIT = 12;
const SEMANTIC_SIMILARITY_THRESHOLD = 0.75;
const EMBEDDING_RETRY_ATTEMPTS = 3;

export type PageFilter = {
	start: number;
	end: number;
};

export type FastSearchFilters = {
	documentTitle?: string;
	color?: string;
	hasNote?: true;
	page?: PageFilter;
};

export type ParsedFastSearchQuery = {
	textQuery: string;
	filters: FastSearchFilters;
};

export type SearchStageCounts = {
	vector: number;
	lexical: number;
	semantic: number;
	fused: number;
	mmrInput: number;
	results: number;
};

export type FastSearchResultKind =
	| 'direct_highlight'
	| 'summary_highlight'
	| 'semantic_highlight'
	| 'document';

export type FastSearchLaneId = 'direct' | 'summary' | 'semantic' | 'document';

export type FastSearchHighlightResult = {
	kind: Exclude<FastSearchResultKind, 'document'>;
	highlightId: string;
	documentId: string;
	documentTitle: string;
	pageNumber: number;
	highlightKind: 'text' | 'area';
	text: string | null;
	annotationPreview: string | null;
	color: string;
	score: number;
	href: string;
};

export type FastSearchDocumentResult = {
	kind: 'document';
	documentId: string;
	documentTitle: string;
	text: string;
	score: number;
	href: string;
};

export type FastSearchResult = FastSearchHighlightResult | FastSearchDocumentResult;

export type FastSearchLane = {
	id: FastSearchLaneId;
	label: string;
	results: FastSearchResult[];
};

export type FastSearchTelemetry = {
	textQuery: string;
	filters: FastSearchFilters;
	stageCounts: SearchStageCounts;
	orderedResultIds: string[];
	latencyMs: number;
};

export type FastSearchResponse = {
	results: FastSearchResult[];
	lanes: FastSearchLane[];
	telemetry: FastSearchTelemetry;
};

export type FastSearchOptions = {
	supabase: SupabaseClient;
	ownerId: string;
	rawQuery: string;
};

export class FastSearchQueryError extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'FastSearchQueryError';
	}
}

type RankedId = {
	id: string;
	rank: number;
};

export type FusedCandidate = {
	id: string;
	score: number;
	vectorRank: number | null;
	lexicalRank: number | null;
};

export type MmrCandidate = {
	id: string;
	fusedScore: number;
	embedding: number[];
};

export type MergeCandidate = {
	id: string;
	fusedRank: number;
	hasEmbedding: boolean;
};

type RawCandidate = {
	highlight_id: string;
	document_id: string;
	document_title: string;
	page_number: number;
	kind: 'text' | 'area';
	text: string | null;
	annotation_preview: string | null;
	color: string;
	embedding: number[] | string | null;
	source: 'direct' | 'summary';
	summary_block: string | null;
	similarity: number | null;
	rank: number;
};

type RawDocumentCandidate = {
	document_id: string;
	document_title: string;
	summary_block: string;
	rank: number;
};

type CandidateRecord = {
	highlightId: string;
	documentId: string;
	documentTitle: string;
	pageNumber: number;
	kind: 'text' | 'area';
	text: string | null;
	annotationPreview: string | null;
	color: string;
	embedding: number[] | null;
	source: 'direct' | 'summary' | 'semantic';
	summaryBlock: string | null;
	similarity: number | null;
	vectorRank: number | null;
	lexicalRank: number | null;
	fusedScore: number;
	fusedRank: number;
};

type QueryEmbeddingOptions = {
	textQuery: string;
	ownerId: string;
};

export function parseFastSearchQuery(rawQuery: string): ParsedFastSearchQuery {
	const tokens = tokenizeQuery(rawQuery.trim());
	const filters: FastSearchFilters = {};
	const bareTerms: string[] = [];

	for (const token of tokens) {
		const separatorIndex = token.indexOf(':');
		if (separatorIndex <= 0) {
			bareTerms.push(token);
			continue;
		}

		const key = token.slice(0, separatorIndex).toLowerCase();
		const value = token.slice(separatorIndex + 1).trim();

		if (key === 'doc') {
			if (!value) throw new FastSearchQueryError('Document filter requires a title');
			filters.documentTitle = value;
			continue;
		}

		if (key === 'color') {
			if (!value) throw new FastSearchQueryError('Color filter requires a value');
			filters.color = searchColorFilterValue(value);
			continue;
		}

		if (key === 'has') {
			if (value.toLowerCase() !== 'note') {
				throw new FastSearchQueryError('Only has:note is supported');
			}
			filters.hasNote = true;
			continue;
		}

		if (key === 'page') {
			filters.page = parsePageFilter(value);
			continue;
		}

		bareTerms.push(token);
	}

	return {
		textQuery: bareTerms.join(' ').replace(/\s+/g, ' ').trim(),
		filters
	};
}

export function reciprocalRankFusion(
	vector: RankedId[],
	lexical: RankedId[],
	k: number
): FusedCandidate[] {
	const scores = new Map<string, FusedCandidate>();

	for (const candidate of vector) {
		const existing = scores.get(candidate.id);
		const score = 1 / (k + candidate.rank);
		scores.set(candidate.id, {
			id: candidate.id,
			score: (existing?.score ?? 0) + score,
			vectorRank: candidate.rank,
			lexicalRank: existing?.lexicalRank ?? null
		});
	}

	for (const candidate of lexical) {
		const existing = scores.get(candidate.id);
		const score = 1 / (k + candidate.rank);
		scores.set(candidate.id, {
			id: candidate.id,
			score: (existing?.score ?? 0) + score,
			vectorRank: existing?.vectorRank ?? null,
			lexicalRank: candidate.rank
		});
	}

	return [...scores.values()].sort((left, right) => right.score - left.score);
}

export function rankWithMmr(
	candidates: MmrCandidate[],
	queryEmbedding: number[],
	lambda: number
): MmrCandidate[] {
	void queryEmbedding;
	const remaining = [...candidates];
	const selected: MmrCandidate[] = [];

	while (remaining.length > 0) {
		let bestIndex = 0;
		let bestScore = Number.NEGATIVE_INFINITY;

		for (let index = 0; index < remaining.length; index += 1) {
			const candidate = remaining[index];
			const relevance = candidate.fusedScore;
			const diversityPenalty = Math.max(
				0,
				...selected.map((selectedCandidate) =>
					cosineSimilarity(candidate.embedding, selectedCandidate.embedding)
				)
			);
			const score = lambda * relevance - (1 - lambda) * diversityPenalty;

			if (score > bestScore) {
				bestScore = score;
				bestIndex = index;
			}
		}

		const [best] = remaining.splice(bestIndex, 1);
		selected.push(best);
	}

	return selected;
}

export function mergeMissingVectorCandidates<T extends MergeCandidate>(
	fusedCandidates: T[],
	mmrRankedCandidates: T[]
): T[] {
	const mmrById = new Map(mmrRankedCandidates.map((candidate) => [candidate.id, candidate]));
	const usedMmrIds = new Set<string>();
	const merged: T[] = [];

	for (const candidate of fusedCandidates) {
		if (!candidate.hasEmbedding) {
			merged.push(candidate);
			continue;
		}

		const nextMmrCandidate = mmrRankedCandidates.find((ranked) => !usedMmrIds.has(ranked.id));
		if (nextMmrCandidate) {
			merged.push(nextMmrCandidate);
			usedMmrIds.add(nextMmrCandidate.id);
		} else if (!mmrById.has(candidate.id)) {
			merged.push(candidate);
		}
	}

	return merged;
}

export async function searchFastLibrary(opts: FastSearchOptions): Promise<FastSearchResponse> {
	const lexicalResponse = await searchFastLibraryLexical(opts);
	const semanticResponse = await searchFastLibrarySemantic(opts, lexicalResponse);
	return semanticResponse;
}

export async function searchFastLibraryLexical(
	opts: FastSearchOptions
): Promise<FastSearchResponse> {
	const startedAt = performance.now();
	const parsed = parseFastSearchQuery(opts.rawQuery);

	if (!parsed.textQuery && Object.keys(parsed.filters).length === 0) {
		return buildEmptyResponse(parsed, startedAt);
	}

	try {
		const [lexicalRows, documentRows] = await Promise.all([
			fetchLexicalCandidates(opts.supabase, opts.ownerId, parsed),
			fetchDocumentCandidates(opts.supabase, opts.ownerId, parsed)
		]);
		const directResults = lexicalRows
			.filter((row) => row.source === 'direct')
			.slice(0, GROUPED_LANE_LIMIT)
			.map((row) => shapeHighlightResult(rowToCandidateRecord(row), 'direct_highlight'));
		const summaryResults = lexicalRows
			.filter((row) => row.source === 'summary')
			.map((row) => shapeHighlightResult(rowToCandidateRecord(row), 'summary_highlight'));
		const documentResults = documentRows
			.slice(0, GROUPED_LANE_LIMIT)
			.map((row) => shapeDocumentResult(row));
		const lanes = capGroupedLanes([
			{ id: 'direct', label: 'Direct matches', results: directResults },
			{
				id: 'summary',
				label: 'Cited summary highlights',
				results: removeDirectHighlightDuplicates(directResults, summaryResults)
			},
			{ id: 'semantic', label: 'Related ideas', results: [] },
			{ id: 'document', label: 'Document matches', results: documentResults }
		]);
		const results = flattenLanes(lanes);
		const telemetry = buildTelemetry(parsed, [], lexicalRows, [], results, startedAt, 0);

		await logSearch(opts.supabase, opts.ownerId, opts.rawQuery, telemetry);

		return { results, lanes, telemetry };
	} catch (error) {
		console.error('[fast-library-search]', {
			ownerId: opts.ownerId,
			rawQuery: opts.rawQuery,
			textQuery: parsed.textQuery,
			filters: parsed.filters,
			error: errorMessage(error, {
				operation: 'fast library search',
				params: { ownerId: opts.ownerId, rawQuery: opts.rawQuery }
			})
		});
		throw error;
	}
}

export async function searchFastLibrarySemantic(
	opts: FastSearchOptions,
	lexicalResponse: FastSearchResponse
): Promise<FastSearchResponse> {
	const startedAt = performance.now();
	const parsed = parseFastSearchQuery(opts.rawQuery);

	if (!parsed.textQuery) return lexicalResponse;

	try {
		const embedding = await getQueryEmbedding({
			textQuery: parsed.textQuery,
			ownerId: opts.ownerId
		});
		const vectorRows = await fetchVectorCandidates(opts.supabase, opts.ownerId, parsed, embedding);
		const ranked = rankCandidates(vectorRows, [], embedding);
		const semanticResults = ranked.map((candidate) => ({
			id: candidate.highlightId,
			similarity: candidate.similarity ?? 0,
			result: shapeHighlightResult(candidate, 'semantic_highlight')
		}));
		const mergedItems = mergeSemanticLane(
			flattenLanes(lexicalResponse.lanes).map((result) => ({
				id: resultIdentity(result),
				lane: laneForResult(result),
				result
			})),
			semanticResults,
			SEMANTIC_SIMILARITY_THRESHOLD
		);
		const lanes = capGroupedLanes(groupMergedResults(mergedItems.map((item) => item.result)));
		const results = flattenLanes(lanes);
		const telemetry = buildTelemetry(
			parsed,
			vectorRows,
			[],
			ranked,
			results,
			startedAt,
			vectorRows.length
		);

		return { results, lanes, telemetry };
	} catch (error) {
		console.error('[fast-library-search semantic]', {
			ownerId: opts.ownerId,
			rawQuery: opts.rawQuery,
			textQuery: parsed.textQuery,
			filters: parsed.filters,
			error: errorMessage(error, {
				operation: 'fast library semantic search',
				params: { ownerId: opts.ownerId, rawQuery: opts.rawQuery }
			})
		});
		throw error;
	}
}

export type SummarySearchBlock = {
	text: string;
	citationOrdinals: number[];
	hasLocalCitations: boolean;
};

export function extractSummarySearchBlocks(
	markdown: string,
	textQuery: string
): SummarySearchBlock[] {
	const terms = textQuery
		.toLowerCase()
		.split(/\s+/)
		.map((term) => term.trim())
		.filter((term) => term.length > 0);
	if (terms.length === 0) return [];

	return markdown
		.split(/\n{2,}/)
		.flatMap(splitMarkdownListItems)
		.map((block) => block.trim())
		.filter((block) => block.length > 0)
		.filter((block) => terms.every((term) => block.toLowerCase().includes(term)))
		.map((block) => {
			const citationOrdinals = [...block.matchAll(/\[\^(\d+)\]/g)].map((match) => Number(match[1]));
			return {
				text: block,
				citationOrdinals,
				hasLocalCitations: citationOrdinals.length > 0
			};
		});
}

export function splitMarkdownListItems(block: string): string[] {
	const lines = block.split('\n');
	const blocks: string[] = [];
	let currentLines: string[] = [];

	for (const line of lines) {
		if (isMarkdownListItem(line)) {
			if (currentLines.length > 0) blocks.push(currentLines.join('\n'));
			currentLines = [line];
			continue;
		}

		currentLines.push(line);
	}

	if (currentLines.length > 0) blocks.push(currentLines.join('\n'));
	return blocks;
}

export function removeDirectHighlightDuplicates<
	T extends { highlightId: string },
	U extends { highlightId: string }
>(directResults: T[], summaryResults: U[]): U[] {
	const directHighlightIds = new Set(directResults.map((result) => result.highlightId));
	return summaryResults.filter((result) => !directHighlightIds.has(result.highlightId));
}

type ExistingLaneItem<T> = {
	id: string;
	lane: FastSearchLaneId;
	result: T;
};

type SemanticLaneItem<T> = {
	id: string;
	similarity: number;
	result: T;
};

export function mergeSemanticLane<T extends { kind: string; highlightId?: string }>(
	existingItems: ExistingLaneItem<T>[],
	semanticItems: SemanticLaneItem<T>[],
	threshold: number
): ExistingLaneItem<T>[] {
	const existingHighlightIds = new Set(
		existingItems
			.map((item) => item.result.highlightId)
			.filter((highlightId): highlightId is string => Boolean(highlightId))
	);
	const appendItems = semanticItems
		.filter((item) => item.similarity >= threshold)
		.filter((item) => !existingHighlightIds.has(item.result.highlightId ?? ''))
		.map((item) => ({ id: item.id, lane: 'semantic' as const, result: item.result }));

	return [...existingItems, ...appendItems];
}

function isMarkdownListItem(line: string): boolean {
	return /^\s*(?:[-*+]|\d+[.)])\s+/.test(line);
}

function tokenizeQuery(query: string): string[] {
	const matches = query.match(/(?:[^\s"]+:"[^"]+"|[^\s"]+)/g);
	if (!matches) return [];
	return matches.map((token) => {
		const separatorIndex = token.indexOf(':"');
		if (separatorIndex <= 0) return token;
		return `${token.slice(0, separatorIndex)}:${token.slice(separatorIndex + 2, -1)}`;
	});
}

function parsePageFilter(value: string): PageFilter {
	if (!value) throw new FastSearchQueryError('Page filter requires a page number');
	const match = value.match(/^(\d+)(?:-(\d+))?$/);
	if (!match) throw new FastSearchQueryError('Page filter must be page:12 or page:12-40');
	const start = Number(match[1]);
	const end = Number(match[2] ?? match[1]);
	if (start < 1 || end < 1) throw new FastSearchQueryError('Page filter must be greater than zero');
	if (start > end)
		throw new FastSearchQueryError('Page filter start must be less than or equal to end');
	return { start, end };
}

async function getQueryEmbedding(opts: QueryEmbeddingOptions): Promise<number[]> {
	const provider = getLLMProvider();
	const model = configuredEmbeddingModel();
	let lastError: unknown = null;

	for (let attempt = 1; attempt <= EMBEDDING_RETRY_ATTEMPTS; attempt += 1) {
		try {
			const result = await provider.embed({
				text: opts.textQuery,
				model,
				operation: 'embed',
				ownerId: opts.ownerId
			});
			return result.embedding;
		} catch (error) {
			lastError = error;
			console.warn('[fast-library-search embedding retry]', {
				ownerId: opts.ownerId,
				textQuery: opts.textQuery,
				model,
				attempt,
				maxAttempts: EMBEDDING_RETRY_ATTEMPTS,
				error: errorMessage(error, {
					operation: 'fast library search query embedding',
					params: { ownerId: opts.ownerId, textQuery: opts.textQuery, attempt }
				})
			});
		}
	}

	throw lastError;
}

async function fetchVectorCandidates(
	supabase: SupabaseClient,
	ownerId: string,
	parsed: ParsedFastSearchQuery,
	embedding: number[]
): Promise<RawCandidate[]> {
	const { data, error } = await supabase.rpc('fast_search_vector_candidates', {
		p_owner_id: ownerId,
		p_query_embedding: `[${embedding.join(',')}]`,
		p_document_title: parsed.filters.documentTitle ?? null,
		p_color: parsed.filters.color ?? null,
		p_has_note: parsed.filters.hasNote ?? false,
		p_page_start: parsed.filters.page?.start ?? null,
		p_page_end: parsed.filters.page?.end ?? null,
		p_limit: VECTOR_LIMIT
	});

	if (error) throw error;
	return (data ?? []) as RawCandidate[];
}

async function fetchLexicalCandidates(
	supabase: SupabaseClient,
	ownerId: string,
	parsed: ParsedFastSearchQuery
): Promise<RawCandidate[]> {
	const { data, error } = await supabase.rpc('fast_search_lexical_candidates', {
		p_owner_id: ownerId,
		p_text_query: parsed.textQuery,
		p_document_title: parsed.filters.documentTitle ?? null,
		p_color: parsed.filters.color ?? null,
		p_has_note: parsed.filters.hasNote ?? false,
		p_page_start: parsed.filters.page?.start ?? null,
		p_page_end: parsed.filters.page?.end ?? null,
		p_limit: LEXICAL_LIMIT
	});

	if (error) throw error;
	return (data ?? []) as RawCandidate[];
}

async function fetchDocumentCandidates(
	supabase: SupabaseClient,
	ownerId: string,
	parsed: ParsedFastSearchQuery
): Promise<RawDocumentCandidate[]> {
	const { data, error } = await supabase.rpc('fast_search_document_candidates', {
		p_owner_id: ownerId,
		p_text_query: parsed.textQuery,
		p_document_title: parsed.filters.documentTitle ?? null,
		p_limit: LEXICAL_LIMIT
	});

	if (error) throw error;
	return (data ?? []) as RawDocumentCandidate[];
}

function rankCandidates(
	vectorRows: RawCandidate[],
	lexicalRows: RawCandidate[],
	queryEmbedding: number[]
): CandidateRecord[] {
	const fused = reciprocalRankFusion(
		vectorRows.map((row) => ({ id: row.highlight_id, rank: row.rank })),
		lexicalRows.map((row) => ({ id: row.highlight_id, rank: row.rank })),
		RRF_K
	).slice(0, MMR_POOL_SIZE);
	const recordsById = buildCandidateRecords(vectorRows, lexicalRows, fused);
	const fusedRecords = fused
		.map((candidate, index) => ({ record: recordsById.get(candidate.id), fusedRank: index + 1 }))
		.filter((entry): entry is { record: CandidateRecord; fusedRank: number } =>
			Boolean(entry.record)
		)
		.map((entry) => ({ ...entry.record, fusedRank: entry.fusedRank }));
	const mmrInput = fusedRecords.filter((candidate) => candidate.embedding);
	const mmrRanked = queryEmbedding.length
		? rankWithMmr(
				mmrInput.map((candidate) => ({
					id: candidate.highlightId,
					fusedScore: candidate.fusedScore,
					embedding: candidate.embedding ?? []
				})),
				queryEmbedding,
				MMR_LAMBDA
			)
				.map((candidate) => fusedRecords.find((record) => record.highlightId === candidate.id))
				.filter((candidate): candidate is CandidateRecord => Boolean(candidate))
		: mmrInput;

	return mergeMissingVectorCandidates(
		fusedRecords.map((candidate) => ({
			...candidate,
			id: candidate.highlightId,
			hasEmbedding: Boolean(candidate.embedding)
		})),
		mmrRanked.map((candidate) => ({
			...candidate,
			id: candidate.highlightId,
			hasEmbedding: true
		}))
	);
}

function buildCandidateRecords(
	vectorRows: RawCandidate[],
	lexicalRows: RawCandidate[],
	fused: FusedCandidate[]
): Map<string, CandidateRecord> {
	const rowsById = new Map<string, RawCandidate>();
	for (const row of [...lexicalRows, ...vectorRows]) rowsById.set(row.highlight_id, row);

	return new Map(
		fused.map((candidate) => {
			const row = rowsById.get(candidate.id);
			if (!row) throw new Error(`Missing raw candidate for highlight ${candidate.id}`);
			return [
				candidate.id,
				{
					highlightId: row.highlight_id,
					documentId: row.document_id,
					documentTitle: row.document_title,
					pageNumber: row.page_number,
					kind: row.kind,
					text: row.text,
					annotationPreview: row.annotation_preview,
					color: row.color,
					embedding: normalizeEmbedding(row.embedding),
					source: row.source,
					summaryBlock: row.summary_block,
					similarity: row.similarity,
					vectorRank: candidate.vectorRank,
					lexicalRank: candidate.lexicalRank,
					fusedScore: candidate.score,
					fusedRank: 0
				}
			];
		})
	);
}

function rowToCandidateRecord(row: RawCandidate): CandidateRecord {
	return {
		highlightId: row.highlight_id,
		documentId: row.document_id,
		documentTitle: row.document_title,
		pageNumber: row.page_number,
		kind: row.kind,
		text: row.source === 'summary' ? row.summary_block : row.text,
		annotationPreview: row.annotation_preview,
		color: row.color,
		embedding: normalizeEmbedding(row.embedding),
		source: row.source,
		summaryBlock: row.summary_block,
		similarity: row.similarity,
		vectorRank: null,
		lexicalRank: row.rank,
		fusedScore: 1 / (RRF_K + row.rank),
		fusedRank: row.rank
	};
}

function normalizeEmbedding(embedding: number[] | string | null): number[] | null {
	if (Array.isArray(embedding)) return embedding;
	if (!embedding) return null;
	return embedding
		.replace(/^\[/, '')
		.replace(/\]$/, '')
		.split(',')
		.map((value) => Number(value.trim()))
		.filter((value) => Number.isFinite(value));
}

function shapeHighlightResult(
	candidate: CandidateRecord,
	resultKind: Exclude<FastSearchResultKind, 'document'>
): FastSearchHighlightResult {
	return {
		kind: resultKind,
		highlightId: candidate.highlightId,
		documentId: candidate.documentId,
		documentTitle: candidate.documentTitle,
		pageNumber: candidate.pageNumber,
		highlightKind: candidate.kind,
		text: candidate.text,
		annotationPreview: candidate.annotationPreview,
		color: candidate.color,
		score: candidate.similarity ?? candidate.fusedScore,
		href: `/doc/${candidate.documentId}#highlight-${candidate.highlightId}`
	};
}

function shapeDocumentResult(candidate: RawDocumentCandidate): FastSearchDocumentResult {
	return {
		kind: 'document',
		documentId: candidate.document_id,
		documentTitle: candidate.document_title,
		text: candidate.summary_block,
		score: 1 / (RRF_K + candidate.rank),
		href: `/doc/${candidate.document_id}`
	};
}

function buildTelemetry(
	parsed: ParsedFastSearchQuery,
	vectorRows: RawCandidate[],
	lexicalRows: RawCandidate[],
	ranked: CandidateRecord[],
	results: FastSearchResult[],
	startedAt: number,
	semanticCount: number
): FastSearchTelemetry {
	return {
		textQuery: parsed.textQuery,
		filters: parsed.filters,
		stageCounts: {
			vector: vectorRows.length,
			lexical: lexicalRows.length,
			semantic: semanticCount,
			fused: ranked.length,
			mmrInput: ranked.filter((candidate) => candidate.embedding).length,
			results: results.length
		},
		orderedResultIds: results.map(resultIdentity),
		latencyMs: Math.round(performance.now() - startedAt)
	};
}

function buildEmptyResponse(parsed: ParsedFastSearchQuery, startedAt: number): FastSearchResponse {
	return {
		results: [],
		telemetry: {
			textQuery: parsed.textQuery,
			filters: parsed.filters,
			stageCounts: { vector: 0, lexical: 0, semantic: 0, fused: 0, mmrInput: 0, results: 0 },
			orderedResultIds: [],
			latencyMs: Math.round(performance.now() - startedAt)
		},
		lanes: []
	};
}

function capGroupedLanes(lanes: FastSearchLane[]): FastSearchLane[] {
	let remaining = GROUPED_TOTAL_LIMIT;
	return lanes.map((lane) => {
		const results = lane.results.slice(0, Math.min(GROUPED_LANE_LIMIT, remaining));
		remaining -= results.length;
		return { ...lane, results };
	});
}

function flattenLanes(lanes: FastSearchLane[]): FastSearchResult[] {
	return lanes.flatMap((lane) => lane.results);
}

function groupMergedResults(results: FastSearchResult[]): FastSearchLane[] {
	return [
		{
			id: 'direct',
			label: 'Direct matches',
			results: results.filter((result) => result.kind === 'direct_highlight')
		},
		{
			id: 'summary',
			label: 'Cited summary highlights',
			results: results.filter((result) => result.kind === 'summary_highlight')
		},
		{
			id: 'semantic',
			label: 'Related ideas',
			results: results.filter((result) => result.kind === 'semantic_highlight')
		},
		{
			id: 'document',
			label: 'Document matches',
			results: results.filter((result) => result.kind === 'document')
		}
	];
}

function laneForResult(result: FastSearchResult): FastSearchLaneId {
	if (result.kind === 'direct_highlight') return 'direct';
	if (result.kind === 'summary_highlight') return 'summary';
	if (result.kind === 'semantic_highlight') return 'semantic';
	return 'document';
}

function resultIdentity(result: FastSearchResult): string {
	if (result.kind === 'document') return `document:${result.documentId}`;
	return `highlight:${result.highlightId}`;
}

async function logSearch(
	supabase: SupabaseClient,
	ownerId: string,
	rawQuery: string,
	telemetry: FastSearchTelemetry
): Promise<void> {
	const { error } = await supabase.from('searches').insert({
		owner_id: ownerId,
		query: rawQuery,
		text_query: telemetry.textQuery,
		parsed_filters: telemetry.filters,
		stage_counts: telemetry.stageCounts,
		ordered_result_ids: telemetry.orderedResultIds,
		latency_ms: telemetry.latencyMs
	});

	if (error) throw error;
}

function cosineSimilarity(left: number[], right: number[]): number {
	const length = Math.min(left.length, right.length);
	let dot = 0;
	let leftMagnitude = 0;
	let rightMagnitude = 0;

	for (let index = 0; index < length; index += 1) {
		dot += left[index] * right[index];
		leftMagnitude += left[index] * left[index];
		rightMagnitude += right[index] * right[index];
	}

	if (leftMagnitude === 0 || rightMagnitude === 0) return 0;
	return dot / (Math.sqrt(leftMagnitude) * Math.sqrt(rightMagnitude));
}
