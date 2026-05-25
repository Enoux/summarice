import { beforeEach, describe, expect, it, vi } from 'vitest';

const { generate, collectFastLibraryCandidatesForQueries } = vi.hoisted(() => ({
	generate: vi.fn(),
	collectFastLibraryCandidatesForQueries: vi.fn()
}));

vi.mock('$lib/server/ai', () => ({
	getLLMProvider: () => ({
		generate
	})
}));

vi.mock('./fast-library-search', async () => {
	const actual =
		await vi.importActual<typeof import('./fast-library-search')>('./fast-library-search');
	return {
		...actual,
		collectFastLibraryCandidatesForQueries
	};
});

import { searchDeepLibrary } from './deep-library-search';
import {
	applyDeepSearchPreRankScores,
	buildDeepSearchFanoutQueries,
	capRewrittenQueries,
	extractSalientDeepSearchTerms
} from '$lib/search/deep-library-search-helpers';

function createSupabaseStub(rows: {
	highlights?: Record<string, unknown>[];
	documents?: Record<string, unknown>[];
	summaries?: Record<string, unknown>[];
}) {
	const resolveRows = (table: string): Record<string, unknown>[] => {
		if (table === 'highlights') {
			return rows.highlights ?? [];
		}
		if (table === 'documents') {
			return rows.documents ?? [];
		}
		if (table === 'summaries') {
			return rows.summaries ?? [];
		}
		return [];
	};

	const chain = {
		eq: () => chain,
		in: async (_column: string, _values: string[]) => ({
			data: resolveRows(currentTable),
			error: null
		})
	};

	let currentTable = 'highlights';

	return {
		from: (table: string) => {
			currentTable = table;
			return {
				select: () => chain
			};
		}
	};
}

describe('searchDeepLibrary', () => {
	it('returns ranked parent highlight results with reasons', async () => {
		generate
			.mockResolvedValueOnce({
				object: {
					rewrittenQueries: ['recent notes on attention'],
					targetKinds: ['note', 'highlight'],
					wantsRecent: true
				}
			})
			.mockResolvedValueOnce({
				object: {
					results: [
						{
							candidateKey: 'highlight:h1',
							reason: 'Matches your recent note about attention.',
							matchedEvidence: 'Note (user): recent attention write-up',
							score: 0.92
						}
					]
				}
			});

		collectFastLibraryCandidatesForQueries.mockResolvedValue({
			candidates: [
				{
					candidateKey: 'highlight:h1',
					kind: 'highlight',
					highlightId: 'h1',
					documentId: 'd1',
					documentTitle: 'Attention Paper',
					pageNumber: 4,
					highlightKind: 'text',
					retrievalScore: 0.8,
					href: '/doc/d1#highlight-h1',
					previewText: 'recent attention write-up',
					updatedAtMs: null
				}
			],
			fanoutCounts: [
				{
					query: 'recent notes on attention',
					resultCount: 1,
					laneCounts: { direct: 1, summary: 0, semantic: 0, document: 0, recommended: 0 }
				}
			]
		});

		const statusSteps: string[] = [];
		const response = await searchDeepLibrary({
			supabase: createSupabaseStub({
				highlights: [
					{
						id: 'h1',
						document_id: 'd1',
						page_number: 4,
						kind: 'text',
						text: 'attention mechanism',
						comment: null,
						color: '#facc15',
						created_at: '2026-05-20T00:00:00.000Z',
						updated_at: '2026-05-23T00:00:00.000Z',
						annotations: [
							{
								id: 'a1',
								body: 'recent attention write-up',
								source: 'user',
								created_at: '2026-05-23T00:00:00.000Z',
								updated_at: '2026-05-23T00:00:00.000Z'
							}
						]
					}
				],
				documents: [{ id: 'd1', title: 'Attention Paper' }]
			}) as never,
			ownerId: 'user-1',
			rawPrompt: 'recent notes on attention',
			currentDocumentId: null,
			onStatus: (step) => {
				statusSteps.push(step.phase);
			},
			abortSignal: undefined
		});

		expect(statusSteps).toEqual(['interpreting', 'searching', 'searching', 'reading', 'ranking']);
		expect(response.results).toHaveLength(1);
		expect(response.results[0]?.highlightId).toBe('h1');
		expect(response.results[0]?.reason).toContain('recent note');
	});

	it('sanitizes verbose planner expansions before candidate collection', async () => {
		generate.mockResolvedValueOnce({
			object: {
				rewrittenQueries: [
					'HotpotQA dataset documentation',
					'HotpotQA examples and benchmark results',
					'HotpotQA full dataset download'
				],
				targetKinds: ['area_highlight', 'highlight'],
				wantsRecent: false
			}
		});

		collectFastLibraryCandidatesForQueries.mockResolvedValue({
			candidates: [],
			fanoutCounts: []
		});

		await searchDeepLibrary({
			supabase: createSupabaseStub({}) as never,
			ownerId: 'user-1',
			rawPrompt: 'Where can I see hotpotQA',
			currentDocumentId: null,
			onStatus: () => {},
			abortSignal: undefined
		});

		expect(collectFastLibraryCandidatesForQueries).toHaveBeenCalledWith(
			expect.objectContaining({
				rawQuery: 'Where can I see hotpotQA'
			}),
			['HotpotQA']
		);
	});
});

beforeEach(() => {
	generate.mockReset();
	collectFastLibraryCandidatesForQueries.mockReset();
});

describe('deep search fanout helpers', () => {
	it('builds intent-first fanout queries without raw navigation prompts', () => {
		const queries = buildDeepSearchFanoutQueries(
			['recent comment', 'highlight comment'],
			'Point me to a recent comment I made on a highlight that I need to research'
		);

		expect(queries).toEqual(['recent comment', 'highlight comment']);
		expect(queries).not.toContain(
			'Point me to a recent comment I made on a highlight that I need to research'
		);
		expect(queries).not.toContain('Point');
	});

	it('preserves exact entities while removing invented planner terms', () => {
		const queries = capRewrittenQueries(
			[
				'HotpotQA dataset documentation',
				'HotpotQA examples and benchmark results',
				'HotpotQA full dataset download'
			],
			'Where can I see HotpotQA'
		);

		expect(queries).toEqual(['HotpotQA']);
	});

	it('preserves quoted phrases exactly in salient terms', () => {
		const terms = extractSalientDeepSearchTerms('Find notes about "chain of thought" safety');

		expect(terms).toContain('chain of thought');
	});

	it('falls back to deterministic salient phrases when planner rewrites are unusable', () => {
		const queries = buildDeepSearchFanoutQueries([], 'Show me transformer attention');

		expect(queries).toEqual(['transformer attention']);
	});

	it('normalizes unusable planner output to facet fallback queries', () => {
		const queries = capRewrittenQueries(['show me'], 'Show me transformer attention');

		expect(queries).toEqual(['transformer attention']);
	});

	it('does not break clear comment intent into standalone evidence words', () => {
		const queries = buildDeepSearchFanoutQueries(
			[],
			'Point me to a recent comment I made on a highlight that I need to research'
		);

		expect(queries).toEqual(['highlight comment']);
		expect(queries).not.toContain('recent');
		expect(queries).not.toContain('comment');
		expect(queries).not.toContain('highlight');
		expect(queries).not.toContain('research');
	});

	it('preserves planner recency phrases instead of deduping them to content-only terms', () => {
		const queries = buildDeepSearchFanoutQueries(['recent comment'], 'recent comment');

		expect(queries).toEqual(['recent comment']);
	});

	it('boosts comment candidates above note candidates for comment intent', () => {
		const scored = applyDeepSearchPreRankScores(
			[
				{
					candidateKey: 'highlight:note',
					kind: 'highlight',
					highlightId: 'note',
					documentId: 'doc',
					documentTitle: 'Doc',
					pageNumber: 1,
					highlightKind: 'text',
					retrievalScore: 0.8,
					href: '/doc/doc#highlight-note',
					previewText: 'note highlight',
					updatedAtMs: null,
					hasComment: false,
					hasNote: true
				},
				{
					candidateKey: 'highlight:comment',
					kind: 'highlight',
					highlightId: 'comment',
					documentId: 'doc',
					documentTitle: 'Doc',
					pageNumber: 1,
					highlightKind: 'text',
					retrievalScore: 0.8,
					href: '/doc/doc#highlight-comment',
					previewText: 'comment highlight',
					updatedAtMs: null,
					hasComment: true,
					hasNote: false
				}
			],
			{ rewrittenQueries: ['comment'], targetKinds: ['note'], wantsRecent: false },
			Date.UTC(2026, 4, 25)
		);

		expect(scored[1]?.preRankScore).toBeGreaterThan(scored[0]?.preRankScore ?? 0);
	});

	it('boosts note candidates above comment candidates for note intent', () => {
		const scored = applyDeepSearchPreRankScores(
			[
				{
					candidateKey: 'highlight:comment',
					kind: 'highlight',
					highlightId: 'comment',
					documentId: 'doc',
					documentTitle: 'Doc',
					pageNumber: 1,
					highlightKind: 'text',
					retrievalScore: 0.8,
					href: '/doc/doc#highlight-comment',
					previewText: 'comment highlight',
					updatedAtMs: null,
					hasComment: true,
					hasNote: false
				},
				{
					candidateKey: 'highlight:note',
					kind: 'highlight',
					highlightId: 'note',
					documentId: 'doc',
					documentTitle: 'Doc',
					pageNumber: 1,
					highlightKind: 'text',
					retrievalScore: 0.8,
					href: '/doc/doc#highlight-note',
					previewText: 'note highlight',
					updatedAtMs: null,
					hasComment: false,
					hasNote: true
				}
			],
			{ rewrittenQueries: ['note'], targetKinds: ['note'], wantsRecent: false },
			Date.UTC(2026, 4, 25)
		);

		expect(scored[1]?.preRankScore).toBeGreaterThan(scored[0]?.preRankScore ?? 0);
	});

	it('applies recency boost without requiring recent as a fanout query', () => {
		const queries = buildDeepSearchFanoutQueries(['comment'], 'recent comment');
		const scored = applyDeepSearchPreRankScores(
			[
				{
					candidateKey: 'highlight:old',
					kind: 'highlight',
					highlightId: 'old',
					documentId: 'doc',
					documentTitle: 'Doc',
					pageNumber: 1,
					highlightKind: 'text',
					retrievalScore: 0.8,
					href: '/doc/doc#highlight-old',
					previewText: 'old comment',
					updatedAtMs: Date.UTC(2026, 3, 20),
					hasComment: true,
					hasNote: true
				},
				{
					candidateKey: 'highlight:new',
					kind: 'highlight',
					highlightId: 'new',
					documentId: 'doc',
					documentTitle: 'Doc',
					pageNumber: 1,
					highlightKind: 'text',
					retrievalScore: 0.8,
					href: '/doc/doc#highlight-new',
					previewText: 'new comment',
					updatedAtMs: Date.UTC(2026, 4, 24),
					hasComment: true,
					hasNote: true
				}
			],
			{ rewrittenQueries: ['comment'], targetKinds: ['note'], wantsRecent: true },
			Date.UTC(2026, 4, 25)
		);

		expect(queries).toEqual(['comment']);
		expect(scored[1]?.preRankScore).toBeGreaterThan(scored[0]?.preRankScore ?? 0);
	});
});
