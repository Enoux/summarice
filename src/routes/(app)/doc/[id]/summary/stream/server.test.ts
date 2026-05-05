import { beforeEach, describe, expect, it, vi } from 'vitest';

const streamObject = vi.fn();

describe('POST /doc/[id]/summary/stream', () => {
	beforeEach(() => {
		streamObject.mockReset();
		vi.resetModules();
	});

	it('streams ready, delta, and done events then finalizes the summary', async () => {
		const llm = {
			partialObjectStream: (async function* () {
				yield { markdown: 'Alpha[^1]' };
				yield { markdown: 'Alpha[^1]\n\nBeta[^2]' };
			})(),
			finalObject: Promise.resolve({
				markdown: 'Alpha[^1]\n\nBeta[^2]',
				tags: ['alpha'],
				entities: ['Beta'],
				open_questions: []
			}),
			telemetry: Promise.resolve({
				provider: 'openrouter',
				model: 'openrouter/test-model',
				operation: 'summary_generate',
				latencyMs: 123,
				usage: { promptTokens: 12, completionTokens: 8, totalTokens: 20 }
			})
		};
		streamObject.mockImplementation(() => llm);
		vi.doMock('$lib/server/ai', () => ({
			getLLMProvider: () => ({
				streamObject
			})
		}));
		vi.doMock('$lib/server/env', () => ({
			env: {
				OPENROUTER_API_KEY: 'test-key',
				OPENROUTER_GENERATION_MODEL: 'openrouter/test-model'
			}
		}));

		const rpc = vi.fn().mockResolvedValue({
			data: {
				id: 'summary-1',
				version: 1,
				markdown: 'Alpha[^1]\n\nBeta[^2]'
			},
			error: null
		});
		const insertLlmCall = vi.fn().mockResolvedValue({ error: null });

		const queryBuilder = (result: unknown) => {
			const builder = {
				select: () => builder,
				eq: () => builder,
				order: async () => result,
				maybeSingle: async () => result
			};
			return builder;
		};

		const supabase = {
			rpc,
			from: (table: string) => {
				if (table === 'documents') {
					return queryBuilder({
						data: {
							id: 'doc-1',
							owner_id: 'user-1',
							title: 'Doc',
							page_count: 1
						},
						error: null
					});
				}

				if (table === 'document_pages') {
					return {
						select: () => ({
							eq: () => ({
								order: async () => ({
									data: [{ document_id: 'doc-1', page_number: 1, text: 'Alpha Beta' }],
									error: null
								})
							})
						})
					};
				}

				if (table === 'highlights') {
					return {
						select: () => ({
							eq: () => ({
								eq: () => ({
									order: async () => ({
										data: [
											{
												id: 'hl-1',
												document_id: 'doc-1',
												owner_id: 'user-1',
												ordinal: 1,
												kind: 'text',
												page_number: 1,
												text: 'Alpha',
												comment: null,
												screenshot_path: null,
												bounding_box: { boundingRect: { pageNumber: 1 }, rects: [] },
												category: 1,
												color: '#facc15',
												created_at: '2026-05-04T10:00:00Z',
												annotations: []
											},
											{
												id: 'hl-2',
												document_id: 'doc-1',
												owner_id: 'user-1',
												ordinal: 2,
												kind: 'text',
												page_number: 1,
												text: 'Beta',
												comment: null,
												screenshot_path: null,
												bounding_box: { boundingRect: { pageNumber: 1 }, rects: [] },
												category: 2,
												color: '#22c55e',
												created_at: '2026-05-04T10:01:00Z',
												annotations: []
											}
										],
										error: null
									})
								})
							})
						})
					};
				}

				if (table === 'user_settings') {
					return queryBuilder({
						data: {
							id: 'user-1',
							category_labels: {
								'1': 'Key idea',
								'2': 'Definition',
								'3': 'Evidence',
								'4': 'Question',
								'5': 'Contradiction'
							},
							use_colors_decoratively: false
						},
						error: null
					});
				}

				if (table === 'llm_calls') {
					return {
						insert: insertLlmCall
					};
				}

				throw new Error(`Unexpected table: ${table}`);
			}
		};

		const { POST } = await import('./+server');
		const response = await POST({
			locals: {
				user: { id: 'user-1' },
				supabase
			},
			params: { id: 'doc-1' },
			request: new Request('http://localhost/doc/doc-1/summary/stream', { method: 'POST' })
		} as never);

		expect(response.status).toBe(200);
		expect(streamObject).toHaveBeenCalledWith(
			expect.objectContaining({
				operation: 'summary_generate',
				documentId: 'doc-1',
				ownerId: 'user-1',
				model: 'google/gemini-2.5-flash'
			})
		);

		const text = await response.text();
		expect(rpc).toHaveBeenCalledWith('generate_summary_finalize', {
			p_document_id: 'doc-1',
			p_markdown: 'Alpha[^1]\n\nBeta[^2]',
			p_tags: ['alpha'],
			p_entities: ['Beta'],
			p_open_questions: [],
			p_model: 'openrouter/test-model',
			p_prompt_tokens: 12,
			p_completion_tokens: 8,
			p_citations: [
				{ ordinal: 1, occurrenceIndex: 0 },
				{ ordinal: 2, occurrenceIndex: 1 }
			]
		});
		expect(text).toContain('event: ready');
		expect(text).toContain('event: delta');
		expect(text).toContain('Alpha[^1]');
		expect(text).toContain('event: done');
		expect(text).toContain('"id":"summary-1"');
	});
});
