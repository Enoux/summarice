import { describe, expect, it, vi } from 'vitest';

import {
	configuredEmbeddingModel,
	embeddingErrorMessage,
	markEmbeddingPending,
	recordEmbeddingTelemetry
} from './highlight-embedding-service';

vi.mock('$lib/server/env', () => ({
	env: {
		OPENROUTER_EMBEDDING_MODEL: 'env/embedding-model'
	}
}));

describe('configuredEmbeddingModel', () => {
	it('uses the OPENROUTER_EMBEDDING_MODEL environment value', () => {
		expect(configuredEmbeddingModel()).toBe('env/embedding-model');
	});
});

describe('embeddingErrorMessage', () => {
	it('preserves object-shaped provider and database errors', () => {
		const message = embeddingErrorMessage(
			{
				code: 'PGRST204',
				message: "Could not find the 'embedding' column",
				details: 'Schema cache does not include the column',
				hint: 'Reload the schema cache'
			},
			{
				highlightId: 'highlight-1',
				documentId: 'doc-1',
				ownerId: 'user-1',
				model: 'env/embedding-model',
				attempt: 2
			}
		);

		expect(message).toContain('process highlight embedding failed');
		expect(message).toContain('"highlightId":"highlight-1"');
		expect(message).toContain('PGRST204');
		expect(message).toContain("Could not find the 'embedding' column");
		expect(message).not.toContain('[object Object]');
	});
});

describe('markEmbeddingPending', () => {
	it('upserts a due pending row without changing the current embedding directly', async () => {
		let payload: Record<string, unknown> | undefined;

		const supabase = {
			from: (table: string) => {
				expect(table).toBe('highlight_embeddings');
				return {
					upsert: (value: Record<string, unknown>, options: Record<string, unknown>) => {
						payload = value;
						expect(options).toEqual({ onConflict: 'highlight_id' });
						return {
							select: () => ({
								single: async () => ({ data: value, error: null })
							})
						};
					}
				};
			}
		};

		await markEmbeddingPending(supabase as never, {
			highlightId: 'highlight-1',
			model: 'env/embedding-model'
		});

		expect(payload).toMatchObject({
			highlight_id: 'highlight-1',
			model: 'env/embedding-model',
			status: 'pending',
			embedding: null,
			last_error: null,
			processing_started_at: null
		});
		expect(payload?.next_retry_at).toEqual(expect.any(String));
	});
});

describe('recordEmbeddingTelemetry', () => {
	it('writes embedding telemetry using the current llm_calls shape', async () => {
		const insert = vi.fn(async () => ({ error: null }));
		const supabase = {
			from: (table: string) => {
				expect(table).toBe('llm_calls');
				return { insert };
			}
		};

		await recordEmbeddingTelemetry(supabase as never, {
			ownerId: 'user-1',
			documentId: 'doc-1',
			highlightId: 'highlight-1',
			provider: 'openrouter',
			model: 'env/embedding-model',
			usage: {
				promptTokens: 23,
				totalTokens: 23
			},
			latencyMs: 321,
			costUsd: 0.00001,
			providerMetadata: { ok: true },
			status: 'completed'
		});

		expect(insert).toHaveBeenCalledWith({
			owner_id: 'user-1',
			document_id: 'doc-1',
			highlight_id: 'highlight-1',
			provider: 'openrouter',
			model: 'env/embedding-model',
			use_case: 'embed',
			status: 'completed',
			prompt_tokens: 23,
			completion_tokens: null,
			total_tokens: 23,
			latency_ms: 321,
			cost_usd: 0.00001,
			usage: {
				promptTokens: 23,
				totalTokens: 23
			},
			provider_metadata: { ok: true },
			error_message: null
		});
	});
});
