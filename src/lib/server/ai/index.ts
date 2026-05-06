import { env } from '$lib/server/env';

import { createOpenRouterLLMProvider } from './openrouter';
import type { LLMProvider } from './types';

export { createOpenRouterLLMProvider } from './openrouter';
export type { OpenRouterLLMProviderOptions } from './openrouter';
export type {
	LLMCallContext,
	LLMCallTelemetry,
	LLMEmbedManyOptions,
	LLMEmbedManyResult,
	LLMEmbedOptions,
	LLMEmbedResult,
	LLMGenerateOptions,
	LLMGenerateResult,
	LLMObjectStreamChunk,
	LLMObjectStreamResult,
	LLMStructuredObjectStreamResult,
	LLMOperation,
	LLMProvider,
	LLMStreamChunk,
	LLMStreamResult,
	LLMTelemetryHooks,
	LLMUsage,
	LLMVisionImage,
	LLMVisionOptions
} from './types';

let provider: LLMProvider | undefined;

export function getLLMProvider(): LLMProvider {
	if (!env.OPENROUTER_API_KEY) {
		throw new Error('OPENROUTER_API_KEY is required to create the LLM provider');
	}

	provider ??= createOpenRouterLLMProvider({
		apiKey: env.OPENROUTER_API_KEY,
		defaultModel: env.OPENROUTER_GENERATION_MODEL ?? env.OPENROUTER_FIGURE_MODEL,
		visionModel: env.OPENROUTER_FIGURE_MODEL ?? env.OPENROUTER_FALLBACK_MODEL,
		embeddingModel: env.OPENROUTER_EMBEDDING_MODEL
	});

	return provider;
}
