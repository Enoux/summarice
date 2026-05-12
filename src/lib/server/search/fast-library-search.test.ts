import { describe, expect, it } from 'vitest';

import {
	extractSummarySearchBlocks,
	mergeMissingVectorCandidates,
	mergeSemanticLane,
	parseFastSearchQuery,
	rankWithMmr,
	removeDirectHighlightDuplicates,
	reciprocalRankFusion
} from './fast-library-search';

describe('parseFastSearchQuery', () => {
	it('extracts supported inline filters and leaves bare query text', () => {
		const parsed = parseFastSearchQuery(
			'doc:"Learning Notes" color:yellow has:note page:12-40 retrieval augmented'
		);

		expect(parsed).toEqual({
			textQuery: 'retrieval augmented',
			filters: {
				documentTitle: 'Learning Notes',
				color: '#facc15',
				hasNote: true,
				page: { start: 12, end: 40 }
			}
		});
	});

	it('keeps custom category label filters searchable', () => {
		const parsed = parseFastSearchQuery('color:keyidea retrieval');

		expect(parsed).toEqual({
			textQuery: 'retrieval',
			filters: { color: 'keyidea' }
		});
	});

	it('rejects invalid page ranges with a user-safe parser error', () => {
		expect(() => parseFastSearchQuery('page:40-12 transformers')).toThrow(
			'Page filter start must be less than or equal to end'
		);
	});
});

describe('reciprocalRankFusion', () => {
	it('fuses duplicate vector and lexical candidates with k=60', () => {
		const fused = reciprocalRankFusion(
			[
				{ id: 'a', rank: 1 },
				{ id: 'b', rank: 2 }
			],
			[
				{ id: 'b', rank: 1 },
				{ id: 'c', rank: 2 }
			],
			60
		);

		expect(fused.map((candidate) => candidate.id)).toEqual(['b', 'a', 'c']);
		expect(fused[0].score).toBeCloseTo(1 / 62 + 1 / 61);
	});
});

describe('rankWithMmr', () => {
	it('prefers relevance first and then diversifies similar embedded candidates', () => {
		const ranked = rankWithMmr(
			[
				{ id: 'a', fusedScore: 1, embedding: [1, 0] },
				{ id: 'b', fusedScore: 0.95, embedding: [0.99, 0.01] },
				{ id: 'c', fusedScore: 0.8, embedding: [0, 1] }
			],
			[1, 0],
			0.7
		);

		expect(ranked.map((candidate) => candidate.id)).toEqual(['a', 'c', 'b']);
	});
});

describe('mergeMissingVectorCandidates', () => {
	it('keeps missing-vector candidates in fused-rank order without score penalties', () => {
		const merged = mergeMissingVectorCandidates(
			[
				{ id: 'a', fusedRank: 1, hasEmbedding: true },
				{ id: 'b', fusedRank: 2, hasEmbedding: false },
				{ id: 'c', fusedRank: 3, hasEmbedding: true },
				{ id: 'd', fusedRank: 4, hasEmbedding: false }
			],
			[
				{ id: 'c', fusedRank: 3, hasEmbedding: true },
				{ id: 'a', fusedRank: 1, hasEmbedding: true }
			]
		);

		expect(merged.map((candidate) => candidate.id)).toEqual(['c', 'b', 'a', 'd']);
	});
});

describe('extractSummarySearchBlocks', () => {
	it('returns only citations from the matched markdown paragraph block', () => {
		const blocks = extractSummarySearchBlocks(
			[
				'Retrieval augmented generation connects notes to grounded answers. [^1] [^3]',
				'',
				'- Unrelated planning detail [^2]'
			].join('\n'),
			'retrieval generation'
		);

		expect(blocks).toEqual([
			{
				text: 'Retrieval augmented generation connects notes to grounded answers. [^1] [^3]',
				citationOrdinals: [1, 3],
				hasLocalCitations: true
			}
		]);
	});

	it('marks a matched summary block without local citations as document level', () => {
		const blocks = extractSummarySearchBlocks(
			[
				'## Themes',
				'',
				'Search latency is dominated by broad document scans.',
				'',
				'Supporting citation elsewhere. [^4]'
			].join('\n'),
			'latency scans'
		);

		expect(blocks).toEqual([
			{
				text: 'Search latency is dominated by broad document scans.',
				citationOrdinals: [],
				hasLocalCitations: false
			}
		]);
	});

	it('treats markdown list items as independent searchable blocks', () => {
		const blocks = extractSummarySearchBlocks(
			[
				'## Findings',
				'',
				'- Retrieval works through grounded snippets. [^1]',
				'- Planning detail mentions retrieval but not the target term. [^2]',
				'- Generation citations stay local. [^3]'
			].join('\n'),
			'retrieval grounded'
		);

		expect(blocks).toEqual([
			{
				text: '- Retrieval works through grounded snippets. [^1]',
				citationOrdinals: [1],
				hasLocalCitations: true
			}
		]);
	});

	it('keeps nested list continuation lines with their parent list item', () => {
		const blocks = extractSummarySearchBlocks(
			[
				'- Retrieval augmented generation:',
				'  continued explanation keeps the local citation. [^4]',
				'- Unrelated generation note. [^5]'
			].join('\n'),
			'retrieval citation'
		);

		expect(blocks).toEqual([
			{
				text: '- Retrieval augmented generation:\n  continued explanation keeps the local citation. [^4]',
				citationOrdinals: [4],
				hasLocalCitations: true
			}
		]);
	});
});

describe('mergeSemanticLane', () => {
	it('keeps semantic-only results at or above threshold without moving lexical lanes', () => {
		const merged = mergeSemanticLane(
			[
				{
					id: 'direct-a',
					lane: 'direct',
					result: { kind: 'direct_highlight', highlightId: 'a' }
				},
				{
					id: 'summary-b',
					lane: 'summary',
					result: { kind: 'summary_highlight', highlightId: 'b' }
				}
			],
			[
				{
					id: 'semantic-b',
					similarity: 0.91,
					result: { kind: 'semantic_highlight', highlightId: 'b' }
				},
				{
					id: 'semantic-c',
					similarity: 0.75,
					result: { kind: 'semantic_highlight', highlightId: 'c' }
				},
				{
					id: 'semantic-d',
					similarity: 0.74,
					result: { kind: 'semantic_highlight', highlightId: 'd' }
				}
			],
			0.75
		);

		expect(merged.map((result) => result.id)).toEqual(['direct-a', 'summary-b', 'semantic-c']);
	});
});

describe('removeDirectHighlightDuplicates', () => {
	it('removes summary highlights already shown as direct matches', () => {
		const deduped = removeDirectHighlightDuplicates(
			[
				{ kind: 'direct_highlight', highlightId: 'a' },
				{ kind: 'direct_highlight', highlightId: 'b' }
			],
			[
				{ kind: 'summary_highlight', highlightId: 'b' },
				{ kind: 'summary_highlight', highlightId: 'c' }
			]
		);

		expect(deduped).toEqual([{ kind: 'summary_highlight', highlightId: 'c' }]);
	});
});
