import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import { embed, embedMany, generateText, streamObject, streamText } from 'ai';
import type { ModelMessage, UserModelMessage } from 'ai';

import {
	estimateCostUsd,
	normalizeStreamChunk,
	providerReportedCostUsdFromMetadata,
	usageFromEmbeddingModelUsage,
	usageFromLanguageModelUsage,
	withTelemetry
} from './telemetry';
import type {
	LLMCallTelemetry,
	LLMGenerateOptions,
	LLMGenerateResult,
	LLMPricing,
	LLMProvider,
	LLMStreamResult,
	LLMStructuredObjectStreamResult,
	LLMTelemetryHooks,
	LLMVisionImage,
	LLMVisionOptions
} from './types';

export type OpenRouterLLMProviderOptions = {
	apiKey: string;
	appName?: string;
	siteUrl?: string;
	defaultModel?: string;
	visionModel?: string;
	embeddingModel?: string;
	pricing?: Partial<Record<'generate' | 'vision' | 'embed', LLMPricing>>;
	telemetry?: LLMTelemetryHooks;
};

const DEFAULT_MODEL = 'google/gemini-2.5-flash';
const DEFAULT_VISION_MODEL = 'google/gemini-2.5-flash';

export function createOpenRouterLLMProvider(options: OpenRouterLLMProviderOptions): LLMProvider {
	const openrouter = createOpenRouter({
		apiKey: options.apiKey,
		appName: options.appName ?? 'summarice',
		appUrl: options.siteUrl
	});

	const providerName = 'openrouter';

	function languageModel(model?: string) {
		return model ?? options.defaultModel ?? DEFAULT_MODEL;
	}

	function openRouterLanguageModel(modelId: string) {
		return openrouter(modelId, {
			usage: {
				include: true
			}
		});
	}

	function visionModel(model?: string) {
		return model ?? options.visionModel ?? options.defaultModel ?? DEFAULT_VISION_MODEL;
	}

	function embeddingModel(model?: string) {
		const modelId = model ?? options.embeddingModel;
		if (!modelId) {
			throw new Error('OPENROUTER_EMBEDDING_MODEL is required to create embedding requests');
		}
		return modelId;
	}

	function combineSignals(callerSignal: AbortSignal | undefined): AbortSignal {
		const timeout = AbortSignal.timeout(60_000);
		if (!callerSignal) return timeout;
		return AbortSignal.any([callerSignal, timeout]);
	}

	async function generate<T = unknown>(
		generateOptions: LLMGenerateOptions
	): Promise<LLMGenerateResult<T>> {
		const modelId = languageModel(generateOptions.model);

		const { value, telemetry } = await withTelemetry({
			provider: providerName,
			model: modelId,
			context: generateOptions,
			hooks: options.telemetry,
			pricing: options.pricing?.generate,
			call: async () => {
				const result = await generateText({
					model: openRouterLanguageModel(modelId),
					system: generateOptions.system,
					messages: generateOptions.messages,
					tools: generateOptions.tools,
					output: generateOptions.schema as never,
					providerOptions: generateOptions.providerOptions,
					temperature: generateOptions.temperature,
					maxOutputTokens: generateOptions.maxOutputTokens,
					abortSignal: combineSignals(generateOptions.abortSignal)
				});

				return {
					value: {
						text: result.text,
						object: 'object' in result ? (result.object as T | undefined) : undefined,
						usage: usageFromLanguageModelUsage(result.usage)
					},
					usage: usageFromLanguageModelUsage(result.usage),
					providerMetadata: result.providerMetadata,
					costUsd: providerReportedCostUsdFromMetadata(result.providerMetadata)
				};
			}
		});

		return {
			...value,
			telemetry
		};
	}

	function stream(streamOptions: LLMGenerateOptions): LLMStreamResult {
		const modelId = languageModel(streamOptions.model);
		const startedAt = performance.now();
		let settledUsage = {};

		const signal = combineSignals(streamOptions.abortSignal);

		const result = streamText({
			model: openRouterLanguageModel(modelId),
			system: streamOptions.system,
			messages: streamOptions.messages,
			tools: streamOptions.tools,
			output: streamOptions.schema as never,
			providerOptions: streamOptions.providerOptions,
			temperature: streamOptions.temperature,
			maxOutputTokens: streamOptions.maxOutputTokens,
			abortSignal: signal,
			onFinish: ({ usage }) => {
				settledUsage = usageFromLanguageModelUsage(usage);
			}
		});

		const telemetry = result.usage.then(async (usage) => {
			const providerMetadata = await result.providerMetadata;
			const normalizedUsage = usageFromLanguageModelUsage(usage) ?? settledUsage;
			const callTelemetry: LLMCallTelemetry = {
				provider: providerName,
				model: modelId,
				operation: streamOptions.operation,
				ownerId: streamOptions.ownerId,
				documentId: streamOptions.documentId,
				highlightId: streamOptions.highlightId,
				latencyMs: Math.round(performance.now() - startedAt),
				usage: normalizedUsage,
				providerMetadata,
				costUsd: providerReportedCostUsdFromMetadata(providerMetadata),
				estimatedCostUsd: estimateCostUsd(normalizedUsage, options.pricing?.generate)
			};

			await options.telemetry?.onFinish?.(callTelemetry);
			return callTelemetry;
		});

		async function* chunks() {
			await options.telemetry?.onStart?.({
				provider: providerName,
				model: modelId,
				operation: streamOptions.operation,
				ownerId: streamOptions.ownerId,
				documentId: streamOptions.documentId,
				highlightId: streamOptions.highlightId
			});

			let index = 0;
			for await (const part of result.fullStream) {
				const chunk = normalizeStreamChunk(part, index++);
				if (chunk) yield chunk;
			}
		}

		return Object.assign(chunks(), { telemetry: Promise.resolve(telemetry) });
	}

	function streamStructuredObject<T = unknown>(
		streamOptions: LLMGenerateOptions
	): LLMStructuredObjectStreamResult<T> {
		const modelId = languageModel(streamOptions.model);
		const startedAt = performance.now();
		let settledUsage = {};

		const signal = combineSignals(streamOptions.abortSignal);

		const result = streamObject({
			model: openRouterLanguageModel(modelId),
			system: streamOptions.system,
			messages: streamOptions.messages,
			output: 'object',
			schema: streamOptions.schema as never,
			providerOptions: streamOptions.providerOptions,
			temperature: streamOptions.temperature,
			maxOutputTokens: streamOptions.maxOutputTokens,
			abortSignal: signal,
			onFinish: ({ usage }) => {
				settledUsage = usageFromLanguageModelUsage(usage);
			}
		});

		const telemetry = result.usage.then(async (usage) => {
			const providerMetadata = await result.providerMetadata;
			const normalizedUsage = usageFromLanguageModelUsage(usage) ?? settledUsage;
			const callTelemetry: LLMCallTelemetry = {
				provider: providerName,
				model: modelId,
				operation: streamOptions.operation,
				ownerId: streamOptions.ownerId,
				documentId: streamOptions.documentId,
				highlightId: streamOptions.highlightId,
				latencyMs: Math.round(performance.now() - startedAt),
				usage: normalizedUsage,
				providerMetadata,
				costUsd: providerReportedCostUsdFromMetadata(providerMetadata),
				estimatedCostUsd: estimateCostUsd(normalizedUsage, options.pricing?.generate)
			};

			await options.telemetry?.onFinish?.(callTelemetry);
			return callTelemetry;
		});

		const partialObjectStream = (async function* () {
			await options.telemetry?.onStart?.({
				provider: providerName,
				model: modelId,
				operation: streamOptions.operation,
				ownerId: streamOptions.ownerId,
				documentId: streamOptions.documentId,
				highlightId: streamOptions.highlightId
			});

			for await (const partialObject of result.partialObjectStream) {
				yield partialObject;
			}
		})();

		return {
			partialObjectStream,
			finalObject: result.object as Promise<T>,
			telemetry: Promise.resolve(telemetry)
		};
	}

	async function embedOne(embedOptions: Parameters<LLMProvider['embed']>[0]) {
		const modelId = embeddingModel(embedOptions.model);
		const { value, telemetry } = await withTelemetry({
			provider: providerName,
			model: modelId,
			context: embedOptions,
			hooks: options.telemetry,
			pricing: options.pricing?.embed,
			call: async () => {
				const result = await embed({
					model: openrouter.textEmbeddingModel(modelId),
					value: embedOptions.text
				});

				return {
					value: {
						embedding: result.embedding as number[],
						usage: result.usage
					},
					usage: usageFromEmbeddingModelUsage(result.usage)
				};
			}
		});

		return { ...value, telemetry };
	}

	async function embedTexts(embedOptions: Parameters<LLMProvider['embedMany']>[0]) {
		const modelId = embeddingModel(embedOptions.model);
		const { value, telemetry } = await withTelemetry({
			provider: providerName,
			model: modelId,
			context: embedOptions,
			hooks: options.telemetry,
			pricing: options.pricing?.embed,
			call: async () => {
				const result = await embedMany({
					model: openrouter.textEmbeddingModel(modelId),
					values: embedOptions.texts
				});

				return {
					value: {
						embeddings: result.embeddings as number[][],
						usage: result.usage
					},
					usage: usageFromEmbeddingModelUsage(result.usage)
				};
			}
		});

		return { ...value, telemetry };
	}

	async function vision<T = unknown>(
		visionOptions: LLMVisionOptions
	): Promise<LLMGenerateResult<T>> {
		const modelId = visionModel(visionOptions.model);
		const messages = withVisionImage(visionOptions.messages, visionOptions.image);

		return generate<T>({
			...visionOptions,
			model: modelId,
			messages
		});
	}

	return {
		generate,
		stream,
		streamObject: streamStructuredObject,
		embed: embedOne,
		embedMany: embedTexts,
		vision
	};
}

function withVisionImage(messages: ModelMessage[], image: LLMVisionImage): ModelMessage[] {
	const imagePart =
		image.type === 'url'
			? {
					type: 'image' as const,
					image: new URL(image.url),
					mediaType: image.mediaType ?? 'image/png'
				}
			: image.type === 'base64'
				? {
						type: 'image' as const,
						image: `data:${image.mediaType};base64,${image.data}`,
						mediaType: image.mediaType
					}
				: { type: 'image' as const, image: image.data, mediaType: image.mediaType };
	const lastMessage = messages.at(-1);
	const imageMessage: UserModelMessage = {
		role: 'user',
		content: [imagePart]
	};

	if (!lastMessage || lastMessage.role !== 'user') {
		return [...messages, imageMessage];
	}

	return [
		...messages.slice(0, -1),
		{
			...lastMessage,
			content: Array.isArray(lastMessage.content)
				? [imagePart, ...lastMessage.content]
				: [imagePart, { type: 'text', text: lastMessage.content }]
		}
	];
}
