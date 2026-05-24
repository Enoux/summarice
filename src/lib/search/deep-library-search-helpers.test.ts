import { describe, expect, it } from 'vitest';

import {
	DEEP_CANDIDATE_POOL_SIZE,
	DEEP_FINAL_RESULT_COUNT,
	MAX_DEEP_FANOUT_QUERIES,
	MAX_DEEP_REWRITTEN_QUERIES,
	applyDeepSearchPreRankScores,
	buildDeepSearchFanoutQueries,
	capRewrittenQueries,
	extractSalientDeepSearchTerms,
	mergeDeepSearchCandidates,
	normalizeDeepLibrarySearchIntent,
	shapeDeepLibrarySearchResults
} from './deep-library-search-helpers';

describe('capRewrittenQueries', () => {
	it('dedupes and caps rewritten queries', () => {
		const queries = capRewrittenQueries(
			[' attention ', 'attention', 'transformer', 'bert', 'gpt'],
			'fallback'
		);

		expect(queries).toEqual(['attention', 'transformer', 'bert']);
		expect(queries.length).toBeLessThanOrEqual(MAX_DEEP_REWRITTEN_QUERIES);
	});

	it('falls back to the raw prompt when planner output is empty', () => {
		expect(capRewrittenQueries([], 'recent notes on attention')).toEqual([
			'recent notes on attention'
		]);
	});
});

describe('extractSalientDeepSearchTerms', () => {
	it('extracts distinctive tokens such as HotpotQA from a natural-language prompt', () => {
		expect(extractSalientDeepSearchTerms('Where can I see hotpotQA')).toEqual(['hotpotQA']);
	});

	it('extracts quoted phrases', () => {
		const terms = extractSalientDeepSearchTerms('find "cellular energy" notes');
		expect(terms).toContain('cellular energy');
		expect(terms).toContain('notes');
	});
});

describe('buildDeepSearchFanoutQueries', () => {
	it('prepends the raw prompt and salient terms before planner expansions', () => {
		const queries = buildDeepSearchFanoutQueries(
			[
				'HotpotQA dataset documentation',
				'HotpotQA examples and benchmark results',
				'HotpotQA full dataset download'
			],
			'Where can I see hotpotQA'
		);

		expect(queries[0]).toBe('Where can I see hotpotQA');
		expect(queries).toContain('hotpotQA');
		expect(queries.length).toBeLessThanOrEqual(MAX_DEEP_FANOUT_QUERIES);
	});

	it('falls back to the raw prompt when planner output is empty', () => {
		expect(buildDeepSearchFanoutQueries([], 'recent notes on attention')).toEqual([
			'recent notes on attention',
			'recent',
			'notes',
			'attention'
		]);
	});
});

describe('normalizeDeepLibrarySearchIntent', () => {
	it('normalizes planner output and defaults target kinds', () => {
		const intent = normalizeDeepLibrarySearchIntent(
			{
				rewrittenQueries: ['figure about loss', 'loss curve chart'],
				targetKinds: ['area_highlight'],
				wantsRecent: true
			},
			'figure about loss'
		);

		expect(intent.rewrittenQueries).toEqual(['figure about loss', 'loss curve chart']);
		expect(intent.targetKinds).toEqual(['area_highlight']);
		expect(intent.wantsRecent).toBe(true);
	});
});

describe('mergeDeepSearchCandidates', () => {
	it('keeps the highest retrieval score per candidate key', () => {
		const merged = mergeDeepSearchCandidates(
			[
				{
					candidateKey: 'highlight:h1',
					kind: 'highlight',
					highlightId: 'h1',
					documentId: 'd1',
					documentTitle: 'Doc',
					pageNumber: 2,
					highlightKind: 'text',
					retrievalScore: 0.4,
					href: '/doc/d1#highlight-h1',
					previewText: 'alpha',
					updatedAtMs: null
				},
				{
					candidateKey: 'highlight:h1',
					kind: 'highlight',
					highlightId: 'h1',
					documentId: 'd1',
					documentTitle: 'Doc',
					pageNumber: 2,
					highlightKind: 'text',
					retrievalScore: 0.9,
					href: '/doc/d1#highlight-h1',
					previewText: 'alpha',
					updatedAtMs: null
				},
				{
					candidateKey: 'document:d2',
					kind: 'document',
					highlightId: null,
					documentId: 'd2',
					documentTitle: 'Other',
					pageNumber: null,
					highlightKind: null,
					retrievalScore: 0.7,
					href: '/doc/d2',
					previewText: 'summary',
					updatedAtMs: null
				}
			],
			DEEP_CANDIDATE_POOL_SIZE
		);

		expect(merged).toHaveLength(2);
		expect(merged[0]?.candidateKey).toBe('highlight:h1');
		expect(merged[0]?.retrievalScore).toBe(0.9);
	});
});

describe('applyDeepSearchPreRankScores', () => {
	it('boosts recent area highlights when wantsRecent is true', () => {
		const nowMs = Date.parse('2026-05-24T12:00:00.000Z');
		const recentMs = Date.parse('2026-05-23T12:00:00.000Z');
		const scored = applyDeepSearchPreRankScores(
			[
				{
					candidateKey: 'highlight:h-area',
					kind: 'highlight',
					highlightId: 'h-area',
					documentId: 'd1',
					documentTitle: 'Doc',
					pageNumber: 4,
					highlightKind: 'area',
					retrievalScore: 0.5,
					href: '/doc/d1#highlight-h-area',
					previewText: 'figure caption',
					updatedAtMs: recentMs
				}
			],
			{
				rewrittenQueries: ['figure about loss'],
				targetKinds: ['area_highlight'],
				wantsRecent: true
			},
			nowMs
		);

		expect(scored[0]?.preRankScore).toBeGreaterThan(0.5);
	});
});

describe('shapeDeepLibrarySearchResults', () => {
	it('returns at most six shaped parent-highlight results', () => {
		const results = shapeDeepLibrarySearchResults(
			Array.from({ length: 8 }, (_, index) => ({
				candidate: {
					candidateKey: `highlight:h${index}`,
					kind: 'highlight' as const,
					highlightId: `h${index}`,
					documentId: 'd1',
					documentTitle: 'Doc',
					pageNumber: index + 1,
					highlightKind: 'text' as const,
					retrievalScore: 1 - index * 0.05,
					href: `/doc/d1#highlight-h${index}`,
					previewText: `evidence ${index}`,
					updatedAtMs: null
				},
				reason: `reason ${index}`,
				matchedEvidence: `evidence ${index}`,
				score: 1 - index * 0.05,
				updatedAt: null
			})),
			DEEP_FINAL_RESULT_COUNT
		);

		expect(results).toHaveLength(DEEP_FINAL_RESULT_COUNT);
		expect(results[0]?.highlightId).toBe('h0');
		expect(results[0]?.reason).toBe('reason 0');
	});
});
