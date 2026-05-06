import { describe, expect, it } from 'vitest';

import {
	buildFigureInterpretationPrompt,
	recordFigureInterpretationTelemetry
} from './figure-interpretation';

function queryBuilder(result: unknown) {
	const builder = {
		select: () => builder,
		eq: () => builder,
		single: async () => result
	};
	return builder;
}

describe('buildFigureInterpretationPrompt', () => {
	it('returns system instructions separately from user messages', async () => {
		const supabase = {
			from: (table: string) => {
				if (table === 'highlights') {
					return queryBuilder({
						data: {
							id: 'highlight-1',
							document_id: 'doc-1',
							owner_id: 'user-1',
							page_number: 1,
							screenshot_path: 'user-1/doc-1/highlight-1.png',
							bounding_box: {}
						},
						error: null
					});
				}
				if (table === 'annotations') {
					return queryBuilder({ data: { id: 'annotation-1' }, error: null });
				}
				throw new Error(`Unexpected table: ${table}`);
			},
			storage: {
				from: () => ({
					createSignedUrl: async () => ({
						data: { signedUrl: 'https://example.com/highlight-1.png' },
						error: null
					})
				})
			}
		};

		const prompt = await buildFigureInterpretationPrompt(supabase as never, {
			documentId: 'doc-1',
			highlightId: 'highlight-1',
			annotationId: 'annotation-1',
			ownerId: 'user-1'
		});

		expect(prompt.system).toContain('expert scientific figure analyst');
		expect(prompt.messages).toHaveLength(1);
		expect(prompt.messages.some((message) => message.role === 'system')).toBe(false);
		expect(prompt.messages[0]?.role).toBe('user');
	});
});

describe('recordFigureInterpretationTelemetry', () => {
	it('maps normalized usage and scalar telemetry fields into llm_calls columns', async () => {
		let inserted: Record<string, unknown> | undefined;

		const supabase = {
			from: (table: string) => {
				expect(table).toBe('llm_calls');
				return {
					insert: async (payload: Record<string, unknown>) => {
						inserted = payload;
						return { error: null };
					}
				};
			}
		};

		await recordFigureInterpretationTelemetry(supabase as never, {
			ownerId: 'user-1',
			documentId: 'doc-1',
			highlightId: 'highlight-1',
			annotationId: 'annotation-1',
			provider: 'openrouter',
			model: 'google/gemini-2.5-flash',
			usage: {
				promptTokens: 120,
				completionTokens: 45,
				totalTokens: 165
			},
			latencyMs: 987,
			costUsd: 0.012345,
			providerMetadata: {
				openrouter: {
					usage: {
						cost: 0.012345
					}
				}
			},
			status: 'completed'
		});

		expect(inserted).toEqual({
			owner_id: 'user-1',
			document_id: 'doc-1',
			highlight_id: 'highlight-1',
			annotation_id: 'annotation-1',
			provider: 'openrouter',
			model: 'google/gemini-2.5-flash',
			use_case: 'figure_interpretation',
			status: 'completed',
			prompt_tokens: 120,
			completion_tokens: 45,
			total_tokens: 165,
			latency_ms: 987,
			cost_usd: 0.012345,
			usage: {
				promptTokens: 120,
				completionTokens: 45,
				totalTokens: 165
			},
			provider_metadata: {
				openrouter: {
					usage: {
						cost: 0.012345
					}
				}
			},
			error_message: null
		});
	});
});
