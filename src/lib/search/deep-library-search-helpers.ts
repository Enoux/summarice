import type {
	DeepLibrarySearchIntent,
	DeepLibrarySearchMode,
	DeepLibrarySearchResult,
	DeepLibrarySearchTargetKind
} from '$lib/search/deep-library-search-types';

export const MAX_DEEP_REWRITTEN_QUERIES = 3;
export const MAX_DEEP_FANOUT_QUERIES = 4;
export const DEEP_CANDIDATE_POOL_SIZE = 18;
export const DEEP_FINAL_RESULT_COUNT = 6;

const DEEP_SEARCH_STOPWORDS = new Set([
	'a',
	'an',
	'and',
	'are',
	'as',
	'at',
	'be',
	'by',
	'can',
	'do',
	'for',
	'from',
	'how',
	'i',
	'in',
	'is',
	'it',
	'me',
	'my',
	'of',
	'on',
	'or',
	'see',
	'that',
	'the',
	'their',
	'there',
	'this',
	'to',
	'was',
	'we',
	'what',
	'when',
	'where',
	'which',
	'who',
	'why',
	'with',
	'you',
	'your'
]);

const QUOTED_PHRASE_PATTERN = /"([^"]+)"/g;
const SALIENT_TOKEN_PATTERN = /[A-Za-z0-9][A-Za-z0-9_-]*/g;

const VALID_TARGET_KINDS: DeepLibrarySearchTargetKind[] = [
	'highlight',
	'area_highlight',
	'note',
	'document'
];

export type DeepSearchMergeInput = {
	candidateKey: string;
	kind: 'highlight' | 'document';
	highlightId: string | null;
	documentId: string;
	documentTitle: string;
	pageNumber: number | null;
	highlightKind: 'text' | 'area' | null;
	retrievalScore: number;
	href: string;
	previewText: string | null;
	updatedAtMs: number | null;
};

export type DeepSearchScoredCandidate = DeepSearchMergeInput & {
	recencyBoost: number;
	kindBoost: number;
	preRankScore: number;
};

export function normalizeDeepLibrarySearchIntent(
	raw: unknown,
	fallbackPrompt: string
): DeepLibrarySearchIntent {
	const record = readRecord(raw);
	const rewrittenQueries = capRewrittenQueries(
		readStringArray(record.rewrittenQueries),
		fallbackPrompt
	);
	const targetKinds = normalizeTargetKinds(record.targetKinds);
	const wantsRecent = record.wantsRecent === true;

	return {
		rewrittenQueries,
		targetKinds,
		wantsRecent
	};
}

export function capRewrittenQueries(queries: string[], fallbackPrompt: string): string[] {
	const normalized = queries
		.map((query) => query.trim().replace(/\s+/g, ' '))
		.filter((query) => query.length > 0);
	const fallback = fallbackPrompt.trim().replace(/\s+/g, ' ');
	const source = normalized.length > 0 ? normalized : fallback.length > 0 ? [fallback] : [];
	const unique: string[] = [];

	for (const query of source) {
		appendUniqueQuery(unique, query, MAX_DEEP_REWRITTEN_QUERIES);
	}

	if (unique.length === 0) {
		throw new Error('Deep search requires at least one rewritten query.');
	}

	return unique;
}

export function extractSalientDeepSearchTerms(rawPrompt: string): string[] {
	const trimmed = rawPrompt.trim();
	if (trimmed.length === 0) {
		return [];
	}

	const terms: string[] = [];
	const seen = new Set<string>();

	const addTerm = (value: string): void => {
		const normalized = value.trim();
		if (normalized.length === 0) {
			return;
		}

		const dedupeKey = normalized.toLowerCase();
		if (seen.has(dedupeKey)) {
			return;
		}

		seen.add(dedupeKey);
		terms.push(normalized);
	};

	let quotedMatch: RegExpExecArray | null;
	while ((quotedMatch = QUOTED_PHRASE_PATTERN.exec(trimmed)) !== null) {
		addTerm(quotedMatch[1]);
	}

	let tokenMatch: RegExpExecArray | null;
	while ((tokenMatch = SALIENT_TOKEN_PATTERN.exec(trimmed)) !== null) {
		const token = tokenMatch[0];
		if (!isSalientDeepSearchToken(token)) {
			continue;
		}
		addTerm(token);
	}

	return terms;
}

export function buildDeepSearchFanoutQueries(
	rewrittenQueries: string[],
	rawPrompt: string
): string[] {
	const fallback = rawPrompt.trim().replace(/\s+/g, ' ');
	const plannerQueries = rewrittenQueries
		.map((query) => query.trim().replace(/\s+/g, ' '))
		.filter((query) => query.length > 0);
	const salientTerms = extractSalientDeepSearchTerms(rawPrompt);
	const unique: string[] = [];

	appendUniqueQuery(unique, fallback, MAX_DEEP_FANOUT_QUERIES);

	for (const term of salientTerms) {
		appendUniqueQuery(unique, term, MAX_DEEP_FANOUT_QUERIES);
	}

	const plannerSource =
		plannerQueries.length > 0 ? plannerQueries : fallback.length > 0 ? [fallback] : [];

	for (const query of plannerSource) {
		appendUniqueQuery(unique, query, MAX_DEEP_FANOUT_QUERIES);
	}

	if (unique.length === 0) {
		throw new Error('Deep search requires at least one fanout query.');
	}

	return unique;
}

function isSalientDeepSearchToken(token: string): boolean {
	const normalized = token.toLowerCase();
	if (normalized.length === 0) {
		return false;
	}

	if (DEEP_SEARCH_STOPWORDS.has(normalized)) {
		return false;
	}

	if (token.length >= 4) {
		return true;
	}

	if (/[A-Z]/.test(token) && /[a-z]/.test(token)) {
		return true;
	}

	if (/\d/.test(token)) {
		return true;
	}

	return false;
}

function appendUniqueQuery(unique: string[], query: string, maxQueries: number): void {
	const normalized = query.trim().replace(/\s+/g, ' ');
	if (normalized.length === 0) {
		return;
	}

	const dedupeKey = normalized.toLowerCase();
	if (unique.some((existing) => existing.toLowerCase() === dedupeKey)) {
		return;
	}

	if (unique.length >= maxQueries) {
		return;
	}

	unique.push(normalized);
}

export function mergeDeepSearchCandidates(
	inputs: DeepSearchMergeInput[],
	poolSize: number
): DeepSearchMergeInput[] {
	const merged = new Map<string, DeepSearchMergeInput>();

	for (const candidate of inputs) {
		const existing = merged.get(candidate.candidateKey);
		if (!existing || candidate.retrievalScore > existing.retrievalScore) {
			merged.set(candidate.candidateKey, candidate);
		}
	}

	return [...merged.values()]
		.sort((left, right) => right.retrievalScore - left.retrievalScore)
		.slice(0, poolSize);
}

export function applyDeepSearchPreRankScores(
	candidates: DeepSearchMergeInput[],
	intent: DeepLibrarySearchIntent,
	nowMs: number
): DeepSearchScoredCandidate[] {
	return candidates.map((candidate) => {
		const recencyBoost = intent.wantsRecent
			? computeRecencyBoost(candidate.updatedAtMs, nowMs)
			: 0;
		const kindBoost = computeTargetKindBoost(candidate, intent.targetKinds);
		const preRankScore = candidate.retrievalScore + recencyBoost + kindBoost;

		return {
			...candidate,
			recencyBoost,
			kindBoost,
			preRankScore
		};
	});
}

export function shapeDeepLibrarySearchResults(
	ranked: Array<{
		candidate: DeepSearchMergeInput;
		reason: string;
		matchedEvidence: string;
		score: number;
		updatedAt: string | null;
	}>,
	limit: number
): DeepLibrarySearchResult[] {
	return ranked.slice(0, limit).map((entry) => ({
		kind: entry.candidate.kind,
		highlightId: entry.candidate.highlightId,
		documentId: entry.candidate.documentId,
		documentTitle: entry.candidate.documentTitle,
		pageNumber: entry.candidate.pageNumber,
		matchedEvidence: entry.matchedEvidence.trim(),
		reason: entry.reason.trim(),
		score: entry.score,
		href: entry.candidate.href,
		updatedAt: entry.updatedAt
	}));
}

export function readStoredDeepLibrarySearchMode(raw: string | null): DeepLibrarySearchMode | null {
	if (raw === 'fast' || raw === 'deep') {
		return raw;
	}
	return null;
}

function computeRecencyBoost(updatedAtMs: number | null, nowMs: number): number {
	if (updatedAtMs === null) {
		return 0;
	}

	const ageMs = Math.max(0, nowMs - updatedAtMs);
	const fourteenDaysMs = 14 * 24 * 60 * 60 * 1000;
	if (ageMs >= fourteenDaysMs) {
		return 0;
	}

	return 0.15 * (1 - ageMs / fourteenDaysMs);
}

function computeTargetKindBoost(
	candidate: DeepSearchMergeInput,
	targetKinds: DeepLibrarySearchTargetKind[]
): number {
	if (targetKinds.includes('document') && candidate.kind === 'document') {
		return 0.05;
	}

	if (candidate.kind !== 'highlight') {
		return 0;
	}

	if (targetKinds.includes('area_highlight') && candidate.highlightKind === 'area') {
		return 0.08;
	}

	if (targetKinds.includes('highlight') && candidate.highlightKind === 'text') {
		return 0.04;
	}

	if (targetKinds.includes('note')) {
		return 0.03;
	}

	return 0;
}

function normalizeTargetKinds(raw: unknown): DeepLibrarySearchTargetKind[] {
	const values = readStringArray(raw);
	const kinds = values.filter((value): value is DeepLibrarySearchTargetKind =>
		VALID_TARGET_KINDS.includes(value as DeepLibrarySearchTargetKind)
	);

	if (kinds.length > 0) {
		return kinds;
	}

	return ['highlight', 'area_highlight', 'note'];
}

function readRecord(value: unknown): Record<string, unknown> {
	if (!value || typeof value !== 'object') {
		return {};
	}
	return value as Record<string, unknown>;
}

function readStringArray(value: unknown): string[] {
	if (!Array.isArray(value)) {
		return [];
	}
	return value.filter((entry): entry is string => typeof entry === 'string');
}
