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

const DEEP_SEARCH_NAVIGATION_WORDS = new Set([
	'find',
	'made',
	'need',
	'needs',
	'point',
	'research',
	'search',
	'show',
	'tell'
]);

const DEEP_SEARCH_RECENCY_WORDS = new Set(['latest', 'new', 'newly', 'recent', 'recently']);

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
	hasComment?: boolean;
	hasNote?: boolean;
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
	const targetKinds = normalizeTargetKinds(record.targetKinds);
	const rewrittenQueries = capRewrittenQueries(
		readStringArray(record.rewrittenQueries),
		fallbackPrompt,
		targetKinds
	);
	const wantsRecent = record.wantsRecent === true;

	return {
		rewrittenQueries,
		targetKinds,
		wantsRecent
	};
}

export function capRewrittenQueries(
	queries: string[],
	fallbackPrompt: string,
	targetKinds?: DeepLibrarySearchTargetKind[]
): string[] {
	const fallbackQueries = buildDeterministicFanoutQueries(fallbackPrompt);
	const fallbackTokens = new Set(
		tokenizeDeepSearchText(fallbackPrompt).map((token) => token.toLowerCase())
	);
	const structuralTokens = structuralTokensForTargetKinds(targetKinds);
	const normalized = queries
		.map((query) => sanitizePlannerQuery(query, fallbackTokens, structuralTokens))
		.filter((query) => query.length > 0);
	const source = normalized.length > 0 ? normalized : fallbackQueries;
	const unique: string[] = [];

	for (const query of source) {
		appendStrictUniqueQuery(unique, query, MAX_DEEP_REWRITTEN_QUERIES);
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

	const tokens = tokenizeDeepSearchText(trimmed).filter(isSalientDeepSearchToken);
	const contentTokens = tokens.filter(
		(token) => !DEEP_SEARCH_RECENCY_WORDS.has(token.toLowerCase())
	);

	for (const phrase of buildAdjacentPhrases(tokens, 2)) {
		addTerm(phrase);
	}

	for (const phrase of buildAdjacentPhrases(contentTokens, 2)) {
		addTerm(phrase);
	}

	for (const token of tokens) {
		if (DEEP_SEARCH_RECENCY_WORDS.has(token.toLowerCase())) {
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
	const unique: string[] = [];

	for (const query of plannerQueries) {
		appendStrictUniqueQuery(unique, query, MAX_DEEP_FANOUT_QUERIES);
	}

	if (unique.length === 0) {
		for (const query of buildDeterministicFanoutQueries(rawPrompt)) {
			appendStrictUniqueQuery(unique, query, MAX_DEEP_FANOUT_QUERIES);
		}
	}

	if (unique.length === 0 && shouldUseRawPromptForDeepFanout(fallback)) {
		appendStrictUniqueQuery(unique, fallback, MAX_DEEP_FANOUT_QUERIES);
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

	if (DEEP_SEARCH_NAVIGATION_WORDS.has(normalized)) {
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

function buildDeterministicFanoutQueries(rawPrompt: string): string[] {
	const quotedPhrases = extractQuotedDeepSearchPhrases(rawPrompt);
	if (quotedPhrases.length > 0) {
		return quotedPhrases;
	}

	const tokens = tokenizeDeepSearchText(rawPrompt).filter(isSalientDeepSearchToken);
	const normalizedTokens = new Set(tokens.map((token) => token.toLowerCase()));
	const contentTokens = tokens.filter(
		(token) => !DEEP_SEARCH_RECENCY_WORDS.has(token.toLowerCase())
	);

	if (normalizedTokens.has('highlight') && normalizedTokens.has('comment')) {
		return ['highlight comment'];
	}

	if (normalizedTokens.has('highlight') && normalizedTokens.has('note')) {
		return ['highlight note'];
	}

	if (normalizedTokens.has('figure')) {
		const topicTokens = contentTokens.filter((token) => token.toLowerCase() !== 'figure');
		const topicPhrase = firstAdjacentPhrase(topicTokens);
		return topicPhrase ? [`${topicPhrase} figure`] : ['figure'];
	}

	const topicPhrase = firstAdjacentPhrase(contentTokens);
	if (topicPhrase) {
		return [topicPhrase];
	}

	const entityToken = contentTokens.find(isStandaloneDeepSearchEntity);
	return entityToken ? [entityToken] : [];
}

function extractQuotedDeepSearchPhrases(rawPrompt: string): string[] {
	const phrases: string[] = [];
	let quotedMatch: RegExpExecArray | null;
	QUOTED_PHRASE_PATTERN.lastIndex = 0;
	while ((quotedMatch = QUOTED_PHRASE_PATTERN.exec(rawPrompt)) !== null) {
		const phrase = quotedMatch[1]?.trim().replace(/\s+/g, ' ');
		if (phrase) {
			phrases.push(phrase);
		}
	}
	QUOTED_PHRASE_PATTERN.lastIndex = 0;
	return phrases;
}

function firstAdjacentPhrase(tokens: string[]): string | null {
	const phrases = buildAdjacentPhrases(tokens, 2);
	return phrases[0] ?? null;
}

function isStandaloneDeepSearchEntity(token: string): boolean {
	if (/[A-Z]/.test(token) && /[a-z]/.test(token)) {
		return true;
	}

	if (token.toUpperCase() === token && /[A-Z]/.test(token)) {
		return true;
	}

	if (/\d/.test(token)) {
		return true;
	}

	return false;
}

function sanitizePlannerQuery(
	query: string,
	fallbackTokens: Set<string>,
	structuralTokens: Set<string>
): string {
	const tokens = tokenizeDeepSearchText(query).filter((token) => {
		const normalized = token.toLowerCase();
		if (!isSalientDeepSearchToken(token)) {
			return false;
		}
		return fallbackTokens.has(normalized) || structuralTokens.has(normalized);
	});

	return tokens.slice(0, 3).join(' ');
}

function structuralTokensForTargetKinds(
	targetKinds: DeepLibrarySearchTargetKind[] | undefined
): Set<string> {
	const tokens = new Set<string>();
	for (const kind of targetKinds ?? []) {
		if (kind === 'note') {
			tokens.add('comment');
			tokens.add('note');
		}
		if (kind === 'highlight') {
			tokens.add('highlight');
		}
		if (kind === 'area_highlight') {
			tokens.add('figure');
			tokens.add('highlight');
		}
		if (kind === 'document') {
			tokens.add('document');
		}
	}
	return tokens;
}

function tokenizeDeepSearchText(text: string): string[] {
	return [...text.matchAll(SALIENT_TOKEN_PATTERN)].map((match) => match[0]);
}

function buildAdjacentPhrases(tokens: string[], size: number): string[] {
	if (tokens.length < size) {
		return [];
	}

	const phrases: string[] = [];
	for (let index = 0; index <= tokens.length - size; index += 1) {
		phrases.push(tokens.slice(index, index + size).join(' '));
	}
	return phrases;
}

function shouldUseRawPromptForDeepFanout(prompt: string): boolean {
	if (prompt.length === 0) {
		return false;
	}

	if (QUOTED_PHRASE_PATTERN.test(prompt)) {
		QUOTED_PHRASE_PATTERN.lastIndex = 0;
		return true;
	}
	QUOTED_PHRASE_PATTERN.lastIndex = 0;

	const tokens = tokenizeDeepSearchText(prompt);
	if (tokens.length > 3) {
		return false;
	}

	return tokens.every(isSalientDeepSearchToken);
}

function appendStrictUniqueQuery(unique: string[], query: string, maxQueries: number): void {
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
		const recencyBoost = intent.wantsRecent ? computeRecencyBoost(candidate.updatedAtMs, nowMs) : 0;
		const kindBoost = computeTargetKindBoost(candidate, intent);
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
	intent: DeepLibrarySearchIntent
): number {
	const targetKinds = intent.targetKinds;
	if (targetKinds.includes('document') && candidate.kind === 'document') {
		return 0.05;
	}

	if (candidate.kind !== 'highlight') {
		return 0;
	}

	const evidenceBoost = computeEvidenceKindBoost(candidate, intent);
	if (evidenceBoost > 0) {
		return evidenceBoost;
	}

	if (targetKinds.includes('area_highlight') && candidate.highlightKind === 'area') {
		return 0.08;
	}

	if (targetKinds.includes('highlight') && candidate.highlightKind === 'text') {
		return 0.04;
	}

	return 0;
}

function computeEvidenceKindBoost(
	candidate: DeepSearchMergeInput,
	intent: DeepLibrarySearchIntent
): number {
	if (!intent.targetKinds.includes('note')) {
		return 0;
	}

	const queryText = intent.rewrittenQueries.join(' ').toLowerCase();
	const wantsComment = /\bcomments?\b/.test(queryText);
	const wantsNote = /\bnotes?\b/.test(queryText) && !wantsComment;

	if (wantsComment) {
		if (candidate.hasComment === true) {
			return 0.12;
		}
		return candidate.hasNote === true ? 0.03 : 0;
	}

	if (wantsNote) {
		if (candidate.hasNote === true) {
			return 0.12;
		}
		return candidate.hasComment === true ? 0.03 : 0;
	}

	return candidate.hasComment === true || candidate.hasNote === true ? 0.08 : 0;
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
