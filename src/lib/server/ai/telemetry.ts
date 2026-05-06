import type { EmbeddingModelUsage, LanguageModelUsage } from 'ai';

import type {
	LLMCallContext,
	LLMCallTelemetry,
	LLMObjectStreamChunk,
	LLMPricing,
	LLMStreamChunk,
	LLMTelemetryHooks,
	LLMUsage
} from './types';

export function usageFromLanguageModelUsage(usage: LanguageModelUsage | undefined): LLMUsage {
	if (!usage) return {};

	return {
		promptTokens: usage.inputTokens,
		completionTokens: usage.outputTokens,
		totalTokens:
			usage.totalTokens ??
			(typeof usage.inputTokens === 'number' || typeof usage.outputTokens === 'number'
				? (usage.inputTokens ?? 0) + (usage.outputTokens ?? 0)
				: undefined)
	};
}

export function usageFromEmbeddingModelUsage(usage: EmbeddingModelUsage | undefined): LLMUsage {
	if (!usage) return {};

	return {
		promptTokens: usage.tokens,
		totalTokens: usage.tokens
	};
}

export function estimateCostUsd(usage: LLMUsage, pricing: LLMPricing | undefined): number | undefined {
	if (!pricing) return undefined;

	const inputCost =
		typeof usage.promptTokens === 'number' && typeof pricing.inputPerMillion === 'number'
			? (usage.promptTokens / 1_000_000) * pricing.inputPerMillion
			: 0;
	const outputCost =
		typeof usage.completionTokens === 'number' && typeof pricing.outputPerMillion === 'number'
			? (usage.completionTokens / 1_000_000) * pricing.outputPerMillion
			: 0;
	const embeddingCost =
		typeof usage.totalTokens === 'number' && typeof pricing.embeddingPerMillion === 'number'
			? (usage.totalTokens / 1_000_000) * pricing.embeddingPerMillion
			: 0;
	const total = inputCost + outputCost + embeddingCost;

	return total > 0 ? Number(total.toFixed(8)) : undefined;
}

export function providerReportedCostUsdFromMetadata(
	providerMetadata: unknown
): number | undefined {
	if (!providerMetadata || typeof providerMetadata !== 'object') return undefined;

	const openrouter = (providerMetadata as { openrouter?: unknown }).openrouter;
	if (!openrouter || typeof openrouter !== 'object') return undefined;

	const usage = (openrouter as { usage?: unknown }).usage;
	if (!usage || typeof usage !== 'object') return undefined;

	const cost = (usage as { cost?: unknown }).cost;
	return typeof cost === 'number' && Number.isFinite(cost) ? cost : undefined;
}

export function normalizeStreamChunk(chunk: unknown, index: number): LLMStreamChunk | undefined {
	if (!chunk || typeof chunk !== 'object') return undefined;

	const part = chunk as {
		type?: string;
		text?: string;
		delta?: string;
		error?: unknown;
		finishReason?: LLMStreamChunk extends { type: 'finish'; finishReason?: infer R } ? R : never;
		usage?: LanguageModelUsage;
		toolName?: string;
		toolCallId?: string;
		input?: unknown;
	};

	if (part.type === 'start') {
		return { type: 'start', index };
	}

	if (part.type === 'text-delta' || part.type === 'text') {
		return { type: 'text', index, text: part.text ?? part.delta ?? '' };
	}

	if (part.type === 'reasoning-delta' || part.type === 'reasoning') {
		return { type: 'reasoning', index, text: part.text ?? part.delta ?? '' };
	}

	if (part.type === 'tool-call') {
		return {
			type: 'tool-call',
			index,
			toolName: part.toolName,
			toolCallId: part.toolCallId,
			input: part.input
		};
	}

	if (part.type === 'error') {
		return {
			type: 'error',
			index,
			error: part.error instanceof Error ? part.error.message : String(part.error ?? 'Unknown stream error')
		};
	}

	if (part.type === 'finish') {
		const usage = usageFromLanguageModelUsage(part.usage);
		return {
			type: 'finish',
			index,
			finishReason: part.finishReason,
			...(Object.keys(usage).length > 0 ? { usage } : {})
		};
	}

	return undefined;
}

export function normalizeObjectStreamChunk<T = unknown>(
	chunk: unknown,
	index: number
): LLMObjectStreamChunk<T> | undefined {
	if (!chunk || typeof chunk !== 'object') return undefined;

	const part = chunk as {
		type?: string;
		object?: unknown;
		textDelta?: string;
		error?: unknown;
		finishReason?: LLMObjectStreamChunk<T> extends { type: 'finish'; finishReason?: infer R }
			? R
			: never;
		usage?: LanguageModelUsage;
	};

	if (part.type === 'object') {
		return {
			type: 'object',
			index,
			object: (part.object ?? {}) as LLMObjectStreamChunk<T> extends {
				type: 'object';
				object: infer TObject;
			}
				? TObject
				: never
		};
	}

	if (part.type === 'text-delta') {
		return {
			type: 'text-delta',
			index,
			text: part.textDelta ?? ''
		};
	}

	if (part.type === 'error') {
		return {
			type: 'error',
			index,
			error: part.error instanceof Error ? part.error.message : String(part.error ?? 'Unknown stream error')
		};
	}

	if (part.type === 'finish') {
		const usage = usageFromLanguageModelUsage(part.usage);
		return {
			type: 'finish',
			index,
			finishReason: part.finishReason,
			...(Object.keys(usage).length > 0 ? { usage } : {})
		};
	}

	return undefined;
}

export async function withTelemetry<T>(options: {
	provider: string;
	model: string;
	context: LLMCallContext;
	hooks?: LLMTelemetryHooks;
	pricing?: LLMPricing;
	call: () => Promise<{
		value: T;
		usage: LLMUsage;
		providerMetadata?: LLMCallTelemetry['providerMetadata'];
		costUsd?: number;
	}>;
}): Promise<{ value: T; telemetry: LLMCallTelemetry }> {
	const startedAt = performance.now();
	const base = {
		provider: options.provider,
		model: options.model,
		operation: options.context.operation,
		ownerId: options.context.ownerId,
		documentId: options.context.documentId,
		highlightId: options.context.highlightId
	};

	await options.hooks?.onStart?.(base);

	try {
		const result = await options.call();
		const telemetry = {
			...base,
			latencyMs: Math.round(performance.now() - startedAt),
			usage: result.usage,
			providerMetadata: result.providerMetadata,
			costUsd: result.costUsd,
			estimatedCostUsd: estimateCostUsd(result.usage, options.pricing)
		};

		await options.hooks?.onFinish?.(telemetry);

		return {
			value: result.value,
			telemetry
		};
	} catch (error) {
		await options.hooks?.onError?.(error, {
			...base,
			latencyMs: Math.round(performance.now() - startedAt)
		});
		throw error;
	}
}
