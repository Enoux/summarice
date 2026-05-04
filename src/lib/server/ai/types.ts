import type {
	EmbeddingModelUsage,
	FinishReason,
	JSONValue,
	LanguageModelUsage,
	ModelMessage,
	Tool
} from 'ai';

export type LLMOperation =
	| 'generate'
	| 'stream'
	| 'vision'
	| 'embed'
	| 'embed_many'
	| 'figure_interpretation'
	| 'summary_generate'
	| 'deep_chat';

export type LLMUsage = {
	promptTokens?: number;
	completionTokens?: number;
	totalTokens?: number;
};

export type LLMCallTelemetry = {
	provider: string;
	model: string;
	operation: LLMOperation;
	latencyMs: number;
	usage: LLMUsage;
	providerMetadata?: JSONValue;
	costUsd?: number;
	estimatedCostUsd?: number;
	ownerId?: string;
	documentId?: string;
	highlightId?: string;
};

export type LLMTelemetryHooks = {
	onStart?: (
		call: Omit<LLMCallTelemetry, 'latencyMs' | 'usage' | 'providerMetadata' | 'costUsd' | 'estimatedCostUsd'>
	) => void | Promise<void>;
	onFinish?: (call: LLMCallTelemetry) => void | Promise<void>;
	onError?: (
		error: unknown,
		call: Omit<
			LLMCallTelemetry,
			'latencyMs' | 'usage' | 'providerMetadata' | 'costUsd' | 'estimatedCostUsd'
		> & { latencyMs: number }
	) => void | Promise<void>;
};

export type LLMPricing = {
	inputPerMillion?: number;
	outputPerMillion?: number;
	embeddingPerMillion?: number;
};

export type LLMCallContext = {
	operation: LLMOperation;
	ownerId?: string;
	documentId?: string;
	highlightId?: string;
};

export type LLMGenerateOptions = LLMCallContext & {
	messages: ModelMessage[];
	system?: string;
	model?: string;
	schema?: unknown;
	tools?: Record<string, Tool>;
	providerOptions?: Record<string, Record<string, JSONValue>>;
	temperature?: number;
	maxOutputTokens?: number;
	abortSignal?: AbortSignal;
};

export type LLMGenerateResult<T = unknown> = {
	text: string;
	object?: T;
	usage: LLMUsage;
	telemetry: LLMCallTelemetry;
};

export type LLMStreamChunk =
	| { type: 'start'; index: number }
	| { type: 'text'; index: number; text: string }
	| { type: 'reasoning'; index: number; text: string }
	| { type: 'tool-call'; index: number; toolName?: string; toolCallId?: string; input?: unknown }
	| { type: 'error'; index: number; error: string }
	| { type: 'finish'; index: number; finishReason?: FinishReason; usage?: LLMUsage };

export type LLMStreamResult = AsyncIterable<LLMStreamChunk> & {
	telemetry: Promise<LLMCallTelemetry>;
};

export type LLMEmbedOptions = LLMCallContext & {
	text: string;
	model?: string;
};

export type LLMEmbedManyOptions = LLMCallContext & {
	texts: string[];
	model?: string;
};

export type LLMEmbedResult = {
	embedding: number[];
	usage: Pick<EmbeddingModelUsage, 'tokens'>;
	telemetry: LLMCallTelemetry;
};

export type LLMEmbedManyResult = {
	embeddings: number[][];
	usage: Pick<EmbeddingModelUsage, 'tokens'>;
	telemetry: LLMCallTelemetry;
};

export type LLMVisionImage =
	| { type: 'url'; url: string; mediaType?: string }
	| { type: 'base64'; data: string; mediaType: string }
	| { type: 'bytes'; data: Uint8Array; mediaType: string };

export type LLMVisionOptions = Omit<LLMGenerateOptions, 'messages'> & {
	image: LLMVisionImage;
	messages: ModelMessage[];
};

export type LLMProvider = {
	generate<T = unknown>(options: LLMGenerateOptions): Promise<LLMGenerateResult<T>>;
	stream(options: LLMGenerateOptions): LLMStreamResult;
	embed(options: LLMEmbedOptions): Promise<LLMEmbedResult>;
	embedMany(options: LLMEmbedManyOptions): Promise<LLMEmbedManyResult>;
	vision<T = unknown>(options: LLMVisionOptions): Promise<LLMGenerateResult<T>>;
};

export type UsageLike = LanguageModelUsage | EmbeddingModelUsage | undefined;
