import { describe, expect, it, vi } from 'vitest';

vi.mock('$lib/server/ai', () => ({
	getLLMProvider: () => ({
		embed: vi.fn(async () => ({ embedding: [1, 0] }))
	})
}));

vi.mock('$lib/server/embeddings/highlight-embedding-service', () => ({
	configuredEmbeddingModel: () => 'test-embedding-model'
}));

import {
	extractSummarySearchBlocks,
	mergeMissingVectorCandidates,
	mergeSemanticLane,
	parseFastSearchQuery,
	rankWithMmr,
	removeDirectHighlightDuplicates,
	reciprocalRankFusion,
	searchFastLibrary,
	searchFastLibraryDirect,
	searchFastLibraryEnrichment,
	searchFastLibrarySemantic
} from './fast-library-search';

type RpcCall = {
	name: string;
	params: Record<string, unknown>;
};

type InsertCall = {
	table: string;
	row: Record<string, unknown>;
};

type SupabaseSearchStub = {
	rpcCalls: RpcCall[];
	insertCalls: InsertCall[];
	supabase: {
		rpc: (name: string, params: Record<string, unknown>) => Promise<{ data: unknown[]; error: null }>;
		from: (table: string) => {
			insert: (row: Record<string, unknown>) => Promise<{ error: null }>;
		};
	};
};

function createSupabaseSearchStub(rowsByRpc: Record<string, unknown[]>): SupabaseSearchStub {
	const rpcCalls: RpcCall[] = [];
	const insertCalls: InsertCall[] = [];

	return {
		rpcCalls,
		insertCalls,
		supabase: {
			rpc: vi.fn(async (name: string, params: Record<string, unknown>) => {
				rpcCalls.push({ name, params });
				return { data: rowsByRpc[name] ?? [], error: null };
			}),
			from: vi.fn((table: string) => ({
				insert: vi.fn(async (row: Record<string, unknown>) => {
					insertCalls.push({ table, row });
					return { error: null };
				})
			}))
		}
	};
}

function rawHighlightCandidate(
	overrides: Partial<{
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
	}>
): Record<string, unknown> {
	return {
		highlight_id: 'highlight-direct',
		document_id: 'document-direct',
		document_title: 'Direct Document',
		page_number: 3,
		kind: 'text',
		text: 'direct retrieval text',
		annotation_preview: null,
		color: '#facc15',
		embedding: null,
		source: 'direct',
		summary_block: null,
		similarity: null,
		rank: 1,
		...overrides
	};
}

function rawDocumentCandidate(
	overrides: Partial<{
		document_id: string;
		document_title: string;
		summary_block: string;
		rank: number;
	}>
): Record<string, unknown> {
	return {
		document_id: 'document-result',
		document_title: 'Document Result',
		summary_block: 'summary block text',
		rank: 1,
		...overrides
	};
}

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

describe('searchFastLibraryDirect', () => {
	it('returns only direct highlight matches without logging telemetry', async () => {
		const stub = createSupabaseSearchStub({
			fast_search_direct_candidates: [
				rawHighlightCandidate({ highlight_id: 'direct-a', source: 'direct' })
			],
			fast_search_lexical_candidates: [
				rawHighlightCandidate({ highlight_id: 'summary-a', source: 'summary' })
			],
			fast_search_document_candidates: [rawDocumentCandidate({ document_id: 'doc-a' })]
		});

		const response = await searchFastLibraryDirect({
			supabase: stub.supabase as never,
			ownerId: 'owner-a',
			rawQuery: 'retrieval'
		});

		expect(stub.rpcCalls.map((call) => call.name)).toEqual(['fast_search_direct_candidates']);
		expect(stub.insertCalls).toEqual([]);
		expect(response.lanes.map((lane) => [lane.id, lane.results.length])).toEqual([
			['direct', 1],
			['summary', 0],
			['semantic', 0],
			['document', 0]
		]);
		expect(response.results.map((result) => result.kind)).toEqual(['direct_highlight']);
	});
});

describe('searchFastLibraryEnrichment', () => {
	it('appends summary and document lanes without moving direct results or logging telemetry', async () => {
		const directStub = createSupabaseSearchStub({
			fast_search_direct_candidates: [
				rawHighlightCandidate({ highlight_id: 'direct-a', document_id: 'doc-direct' })
			]
		});
		const directResponse = await searchFastLibraryDirect({
			supabase: directStub.supabase as never,
			ownerId: 'owner-a',
			rawQuery: 'retrieval'
		});
		const enrichmentStub = createSupabaseSearchStub({
			fast_search_summary_candidates: [
				rawHighlightCandidate({
					highlight_id: 'summary-a',
					document_id: 'doc-summary',
					source: 'summary',
					summary_block: 'summary retrieval block'
				})
			],
			fast_search_document_candidates: [
				rawDocumentCandidate({ document_id: 'doc-match', document_title: 'Doc Match' })
			]
		});

		const response = await searchFastLibraryEnrichment(
			{
				supabase: enrichmentStub.supabase as never,
				ownerId: 'owner-a',
				rawQuery: 'retrieval'
			},
			directResponse
		);

		expect(enrichmentStub.rpcCalls.map((call) => call.name)).toEqual([
			'fast_search_summary_candidates',
			'fast_search_document_candidates'
		]);
		expect(enrichmentStub.insertCalls).toEqual([]);
		expect(response.results.map((result) => result.kind)).toEqual([
			'direct_highlight',
			'summary_highlight',
			'document'
		]);
		expect(response.results[0]).toMatchObject({ kind: 'direct_highlight', highlightId: 'direct-a' });
	});
});

describe('searchFastLibrarySemantic', () => {
	it('appends semantic results without moving prior lanes and logs final telemetry once', async () => {
		const directStub = createSupabaseSearchStub({
			fast_search_direct_candidates: [
				rawHighlightCandidate({ highlight_id: 'direct-a', document_id: 'doc-direct' })
			]
		});
		const directResponse = await searchFastLibraryDirect({
			supabase: directStub.supabase as never,
			ownerId: 'owner-a',
			rawQuery: 'retrieval'
		});
		const enrichmentStub = createSupabaseSearchStub({
			fast_search_summary_candidates: [
				rawHighlightCandidate({
					highlight_id: 'summary-a',
					document_id: 'doc-summary',
					source: 'summary',
					summary_block: 'summary retrieval block'
				})
			],
			fast_search_document_candidates: [
				rawDocumentCandidate({ document_id: 'doc-match', document_title: 'Doc Match' })
			]
		});
		const enrichmentResponse = await searchFastLibraryEnrichment(
			{
				supabase: enrichmentStub.supabase as never,
				ownerId: 'owner-a',
				rawQuery: 'retrieval'
			},
			directResponse
		);
		const semanticStub = createSupabaseSearchStub({
			fast_search_vector_candidates: [
				rawHighlightCandidate({
					highlight_id: 'semantic-a',
					document_id: 'doc-semantic',
					embedding: [0, 1],
					similarity: 0.82,
					rank: 1
				})
			]
		});

		const response = await searchFastLibrarySemantic(
			{
				supabase: semanticStub.supabase as never,
				ownerId: 'owner-a',
				rawQuery: 'retrieval'
			},
			enrichmentResponse
		);

		expect(response.results.map((result) => result.kind)).toEqual([
			'direct_highlight',
			'summary_highlight',
			'semantic_highlight',
			'document'
		]);
		expect(response.results[0]).toMatchObject({ kind: 'direct_highlight', highlightId: 'direct-a' });
		expect(semanticStub.insertCalls).toHaveLength(1);
		expect(semanticStub.insertCalls[0]).toMatchObject({
			table: 'searches',
			row: {
				owner_id: 'owner-a',
				query: 'retrieval',
				ordered_result_ids: [
					'highlight:direct-a',
					'highlight:summary-a',
					'highlight:semantic-a',
					'document:doc-match'
				]
			}
		});
		expect(semanticStub.insertCalls[0].row.stage_counts).toMatchObject({
			vector: 1,
			lexical: 2,
			semantic: 1,
			results: 4
		});
	});
});

describe('searchFastLibrary', () => {
	it('keeps the compatibility wrapper returning final merged results', async () => {
		const stub = createSupabaseSearchStub({
			fast_search_direct_candidates: [
				rawHighlightCandidate({ highlight_id: 'direct-a', document_id: 'doc-direct' })
			],
			fast_search_summary_candidates: [
				rawHighlightCandidate({
					highlight_id: 'summary-a',
					document_id: 'doc-summary',
					source: 'summary',
					summary_block: 'summary retrieval block'
				})
			],
			fast_search_document_candidates: [
				rawDocumentCandidate({ document_id: 'doc-match', document_title: 'Doc Match' })
			],
			fast_search_vector_candidates: [
				rawHighlightCandidate({
					highlight_id: 'semantic-a',
					document_id: 'doc-semantic',
					embedding: [0, 1],
					similarity: 0.82,
					rank: 1
				})
			]
		});

		const response = await searchFastLibrary({
			supabase: stub.supabase as never,
			ownerId: 'owner-a',
			rawQuery: 'retrieval'
		});

		expect(stub.rpcCalls.map((call) => call.name)).toEqual([
			'fast_search_direct_candidates',
			'fast_search_summary_candidates',
			'fast_search_document_candidates',
			'fast_search_vector_candidates'
		]);
		expect(stub.insertCalls).toHaveLength(1);
		expect(response.results.map((result) => result.kind)).toEqual([
			'direct_highlight',
			'summary_highlight',
			'semantic_highlight',
			'document'
		]);
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
