import { describe, expect, it } from 'vitest';

import { estimateCostUsd, normalizeStreamChunk, usageFromLanguageModelUsage } from './telemetry';

describe('AI provider telemetry and stream normalization', () => {
	it('normalizes stream chunks to a provider-independent shape', () => {
		expect(normalizeStreamChunk({ type: 'text-delta', text: 'hello' }, 2)).toEqual({
			type: 'text',
			index: 2,
			text: 'hello'
		});

		expect(normalizeStreamChunk({ type: 'reasoning-delta', text: 'thinking' }, 3)).toEqual({
			type: 'reasoning',
			index: 3,
			text: 'thinking'
		});

		expect(normalizeStreamChunk({ type: 'finish', finishReason: 'stop' }, 4)).toEqual({
			type: 'finish',
			index: 4,
			finishReason: 'stop'
		});
	});

	it('maps AI SDK language usage into the llm_calls shape', () => {
		expect(
			usageFromLanguageModelUsage({
				inputTokens: 12,
				inputTokenDetails: {
					cacheReadTokens: undefined,
					cacheWriteTokens: undefined,
					noCacheTokens: undefined
				},
				outputTokens: 5,
				outputTokenDetails: {
					reasoningTokens: undefined,
					textTokens: undefined
				},
				totalTokens: 17
			})
		).toEqual({
			promptTokens: 12,
			completionTokens: 5,
			totalTokens: 17
		});
	});

	it('estimates model cost from per-million token prices', () => {
		expect(
			estimateCostUsd(
				{
					promptTokens: 1_000_000,
					completionTokens: 500_000,
					totalTokens: 1_500_000
				},
				{ inputPerMillion: 0.1, outputPerMillion: 0.4 }
			)
		).toBe(0.3);
	});
});
