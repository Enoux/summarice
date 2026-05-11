import type { SupabaseClient } from '@supabase/supabase-js';
import { getLLMProvider } from '$lib/server/ai';
import type { LLMEmbedResult, LLMUsage } from '$lib/server/ai/types';
import { env } from '$lib/server/env';
import { errorMessage } from '$lib/server/error-message';

const MAX_ATTEMPTS = 3;
const PROCESS_BATCH_SIZE = 5;

export type EmbeddingStatus = 'pending' | 'processing' | 'success' | 'failed';

export type EmbeddingDocumentSource = {
	title: string;
};

export type EmbeddingHighlightSource = {
	kind: 'text' | 'area';
	page_number: number;
	text: string | null;
	comment: string | null;
	screenshot_path: string | null;
};

export type EmbeddingAnnotationSource = {
	body: string;
	source: 'human' | 'ai';
	created_at: string;
};

export type ProcessPendingEmbeddingsResult = {
	processed: number;
	succeeded: number;
	failed: number;
};

type HighlightEmbeddingPendingRow = {
	highlight_id: string;
	attempt_count: number | null;
	status: EmbeddingStatus;
	next_retry_at: string | null;
};

type HighlightEmbeddingSourceRow = EmbeddingHighlightSource & {
	id: string;
	document_id: string;
	owner_id: string;
	documents: EmbeddingDocumentSource | EmbeddingDocumentSource[];
	annotations?: EmbeddingAnnotationSource[];
};

export function configuredEmbeddingModel(): string {
	if (!env.OPENROUTER_EMBEDDING_MODEL) {
		throw new Error('OPENROUTER_EMBEDDING_MODEL is required to process highlight embeddings');
	}
	return env.OPENROUTER_EMBEDDING_MODEL;
}

export function buildHighlightEmbeddingInput(opts: {
	document: EmbeddingDocumentSource;
	highlight: EmbeddingHighlightSource;
	annotations: EmbeddingAnnotationSource[];
}): string {
	const highlightText =
		opts.highlight.kind === 'area' ? '[area highlight]' : cleanText(opts.highlight.text) || '';
	const humanNotes = collectAnnotationText(opts.annotations, 'human');
	const aiNotes = collectAnnotationText(opts.annotations, 'ai');
	const userNoteParts = [cleanText(opts.highlight.comment), ...humanNotes].filter(
		(part): part is string => Boolean(part)
	);

	return [
		cleanText(opts.document.title) || 'Untitled document',
		`Page ${opts.highlight.page_number}`,
		highlightText,
		userNoteParts.length > 0 ? `User note: ${userNoteParts.join('\n')}` : null,
		aiNotes.length > 0 ? `AI interpretation: ${aiNotes.join('\n')}` : null
	]
		.filter((part): part is string => Boolean(part))
		.join(' / ');
}

export async function markEmbeddingPending(
	supabase: SupabaseClient,
	opts: { highlightId: string; model: string }
) {
	const now = new Date().toISOString();
	const { data, error } = await supabase
		.from('highlight_embeddings')
		.upsert(
			{
				highlight_id: opts.highlightId,
				model: opts.model,
				status: 'pending',
				embedding: null,
				last_error: null,
				processing_started_at: null,
				next_retry_at: now,
				updated_at: now
			},
			{ onConflict: 'highlight_id' }
		)
		.select()
		.single();

	if (error) throw error;
	return data;
}

export async function processPendingEmbeddings(
	supabase: SupabaseClient,
	opts: { ownerId: string; documentId: string; model: string; limit: number }
): Promise<ProcessPendingEmbeddingsResult> {
	const now = new Date();
	const rows = await fetchPendingRows(supabase, {
		ownerId: opts.ownerId,
		documentId: opts.documentId,
		limit: opts.limit,
		now
	});
	const result: ProcessPendingEmbeddingsResult = {
		processed: 0,
		succeeded: 0,
		failed: 0
	};

	for (const row of rows) {
		const attempt = (row.attempt_count ?? 0) + 1;
		const claimed = await claimPendingRow(supabase, {
			highlightId: row.highlight_id,
			attempt,
			now: now.toISOString()
		});
		if (!claimed) continue;

		result.processed += 1;
		try {
			await embedClaimedHighlight(supabase, {
				highlightId: row.highlight_id,
				ownerId: opts.ownerId,
				documentId: opts.documentId,
				model: opts.model,
				attempt
			});
			result.succeeded += 1;
		} catch (error) {
			result.failed += 1;
			await writeEmbeddingFailure(supabase, {
				highlightId: row.highlight_id,
				model: opts.model,
				documentId: opts.documentId,
				ownerId: opts.ownerId,
				attempt,
				error,
				now: new Date()
			});
		}
	}

	return result;
}

export async function processDefaultPendingEmbeddings(
	supabase: SupabaseClient,
	opts: { ownerId: string; documentId: string }
): Promise<ProcessPendingEmbeddingsResult> {
	return processPendingEmbeddings(supabase, {
		ownerId: opts.ownerId,
		documentId: opts.documentId,
		model: configuredEmbeddingModel(),
		limit: PROCESS_BATCH_SIZE
	});
}

export function triggerEmbeddingProcessing(
	fetcher: typeof fetch | undefined,
	opts: { documentId: string }
): void {
	if (!fetcher) return;
	void fetcher(`/doc/${opts.documentId}/embeddings/process`, { method: 'POST' }).catch((error) => {
		console.warn('[highlight-embeddings trigger]', {
			documentId: opts.documentId,
			error: errorMessage(error, {
				operation: 'trigger highlight embedding processor',
				params: { documentId: opts.documentId }
			})
		});
	});
}

export async function recordEmbeddingTelemetry(
	supabase: SupabaseClient,
	opts: {
		ownerId: string;
		documentId: string;
		highlightId: string;
		provider: string;
		model: string;
		usage?: LLMUsage;
		latencyMs?: number;
		costUsd?: number;
		providerMetadata?: unknown;
		status: 'completed' | 'failed';
		errorMessage?: string;
	}
): Promise<void> {
	const usage = normalizeUsage(opts.usage);
	const { error } = await supabase.from('llm_calls').insert({
		owner_id: opts.ownerId,
		document_id: opts.documentId,
		highlight_id: opts.highlightId,
		provider: opts.provider,
		model: opts.model,
		use_case: 'embed',
		status: opts.status,
		prompt_tokens: usage.promptTokens ?? null,
		completion_tokens: usage.completionTokens ?? null,
		total_tokens: usage.totalTokens ?? null,
		latency_ms: opts.latencyMs ?? null,
		cost_usd: opts.costUsd ?? null,
		usage: Object.keys(usage).length > 0 ? usage : null,
		provider_metadata: opts.providerMetadata ?? null,
		error_message: opts.errorMessage ?? null
	});

	if (error) {
		console.warn('[highlight-embeddings telemetry]', {
			highlightId: opts.highlightId,
			error
		});
	}
}

async function fetchPendingRows(
	supabase: SupabaseClient,
	opts: { ownerId: string; documentId: string; limit: number; now: Date }
): Promise<HighlightEmbeddingPendingRow[]> {
	const { data, error } = await supabase
		.from('highlight_embeddings')
		.select('highlight_id, attempt_count, status, next_retry_at, highlights!inner(owner_id, document_id)')
		.in('status', ['pending', 'failed'])
		.eq('highlights.owner_id', opts.ownerId)
		.eq('highlights.document_id', opts.documentId)
		.order('updated_at', { ascending: true })
		.limit(opts.limit);

	if (error) throw error;

	return ((data ?? []) as HighlightEmbeddingPendingRow[]).filter((row) => {
		if (!row.next_retry_at) return true;
		return new Date(row.next_retry_at).getTime() <= opts.now.getTime();
	});
}

async function claimPendingRow(
	supabase: SupabaseClient,
	opts: { highlightId: string; attempt: number; now: string }
): Promise<boolean> {
	const { data, error } = await supabase
		.from('highlight_embeddings')
		.update({
			status: 'processing',
			attempt_count: opts.attempt,
			processing_started_at: opts.now,
			last_error: null,
			updated_at: opts.now
		})
		.eq('highlight_id', opts.highlightId)
		.in('status', ['pending', 'failed'])
		.select('highlight_id')
		.maybeSingle();

	if (error) throw error;
	return Boolean(data);
}

async function embedClaimedHighlight(
	supabase: SupabaseClient,
	opts: { highlightId: string; ownerId: string; documentId: string; model: string; attempt: number }
): Promise<void> {
	const source = await fetchEmbeddingSource(supabase, {
		highlightId: opts.highlightId,
		ownerId: opts.ownerId,
		documentId: opts.documentId
	});
	const document = firstRelatedRow(source.documents);
	const enrichedInput = buildHighlightEmbeddingInput({
		document,
		highlight: source,
		annotations: source.annotations ?? []
	});
	const embedded = await embedWithTelemetry(supabase, {
		ownerId: opts.ownerId,
		documentId: opts.documentId,
		highlightId: opts.highlightId,
		model: opts.model,
		text: enrichedInput,
		attempt: opts.attempt
	});

	await writeEmbeddingSuccess(supabase, {
		highlightId: opts.highlightId,
		model: opts.model,
		embedding: embedded.embedding,
		enrichedInput,
		attempt: opts.attempt,
		now: new Date().toISOString()
	});
}

async function embedWithTelemetry(
	supabase: SupabaseClient,
	opts: {
		ownerId: string;
		documentId: string;
		highlightId: string;
		model: string;
		text: string;
		attempt: number;
	}
): Promise<LLMEmbedResult> {
	const provider = getLLMProvider();
	try {
		const embedded = await provider.embed({
			operation: 'embed',
			ownerId: opts.ownerId,
			documentId: opts.documentId,
			highlightId: opts.highlightId,
			model: opts.model,
			text: opts.text
		});

		await recordEmbeddingTelemetry(supabase, {
			ownerId: opts.ownerId,
			documentId: opts.documentId,
			highlightId: opts.highlightId,
			provider: embedded.telemetry.provider,
			model: embedded.telemetry.model,
			usage: embedded.telemetry.usage,
			latencyMs: embedded.telemetry.latencyMs,
			costUsd: embedded.telemetry.costUsd ?? embedded.telemetry.estimatedCostUsd,
			providerMetadata: embedded.telemetry.providerMetadata,
			status: 'completed'
		});

		return embedded;
	} catch (error) {
		await recordEmbeddingTelemetry(supabase, {
			ownerId: opts.ownerId,
			documentId: opts.documentId,
			highlightId: opts.highlightId,
			provider: 'openrouter',
			model: opts.model,
			status: 'failed',
			errorMessage: embeddingErrorMessage(error, {
				highlightId: opts.highlightId,
				documentId: opts.documentId,
				ownerId: opts.ownerId,
				model: opts.model,
				attempt: opts.attempt
			})
		});
		throw error;
	}
}

async function fetchEmbeddingSource(
	supabase: SupabaseClient,
	opts: { highlightId: string; ownerId: string; documentId: string }
): Promise<HighlightEmbeddingSourceRow> {
	const { data, error } = await supabase
		.from('highlights')
		.select(
			'id, document_id, owner_id, kind, page_number, text, comment, screenshot_path, documents!inner(title), annotations(body, source, created_at)'
		)
		.eq('id', opts.highlightId)
		.eq('owner_id', opts.ownerId)
		.eq('document_id', opts.documentId)
		.single();

	if (error) throw error;
	return data as HighlightEmbeddingSourceRow;
}

async function writeEmbeddingSuccess(
	supabase: SupabaseClient,
	opts: {
		highlightId: string;
		model: string;
		embedding: number[];
		enrichedInput: string;
		attempt: number;
		now: string;
	}
): Promise<void> {
	const { error } = await supabase
		.from('highlight_embeddings')
		.update({
			model: opts.model,
			embedding: formatVector(opts.embedding),
			enriched_input: opts.enrichedInput,
			status: 'success',
			attempt_count: opts.attempt,
			last_error: null,
			processing_started_at: null,
			next_retry_at: null,
			updated_at: opts.now
		})
		.eq('highlight_id', opts.highlightId);

	if (error) throw error;
}

async function writeEmbeddingFailure(
	supabase: SupabaseClient,
	opts: {
		highlightId: string;
		model: string;
		documentId: string;
		ownerId: string;
		attempt: number;
		error: unknown;
		now: Date;
	}
): Promise<void> {
	const terminal = opts.attempt >= MAX_ATTEMPTS;
	const retryAt = terminal ? null : new Date(opts.now.getTime() + retryDelayMs(opts.attempt)).toISOString();
	const { error } = await supabase
		.from('highlight_embeddings')
		.update({
			model: opts.model,
			embedding: null,
			status: terminal ? 'failed' : 'pending',
			attempt_count: opts.attempt,
			last_error: embeddingErrorMessage(opts.error, {
				highlightId: opts.highlightId,
				documentId: opts.documentId,
				ownerId: opts.ownerId,
				model: opts.model,
				attempt: opts.attempt
			}),
			processing_started_at: null,
			next_retry_at: retryAt,
			updated_at: opts.now.toISOString()
		})
		.eq('highlight_id', opts.highlightId);

	if (error) throw error;
}

function collectAnnotationText(
	annotations: EmbeddingAnnotationSource[],
	source: 'human' | 'ai'
): string[] {
	return annotations
		.filter((annotation) => annotation.source === source)
		.sort((a, b) => a.created_at.localeCompare(b.created_at))
		.map((annotation) => cleanText(annotation.body))
		.filter((body): body is string => Boolean(body));
}

function cleanText(value: string | null | undefined): string | null {
	const cleaned = value?.trim().replace(/\s+\n/g, '\n').replace(/\n\s+/g, '\n').replace(/[ \t]+/g, ' ');
	return cleaned ? cleaned : null;
}

function firstRelatedRow<T>(value: T | T[]): T {
	return Array.isArray(value) ? value[0] : value;
}

function formatVector(embedding: number[]): string {
	return `[${embedding.join(',')}]`;
}

function retryDelayMs(attempt: number): number {
	return 2 ** Math.max(attempt - 1, 0) * 1_000;
}

export function embeddingErrorMessage(
	error: unknown,
	context: {
		highlightId: string;
		documentId: string;
		ownerId: string;
		model: string;
		attempt: number;
	}
): string {
	return errorMessage(error, {
		operation: 'process highlight embedding',
		params: {
			highlightId: context.highlightId,
			documentId: context.documentId,
			ownerId: context.ownerId,
			model: context.model,
			attempt: context.attempt
		}
	});
}

function normalizeUsage(usage: LLMUsage | undefined): LLMUsage {
	if (!usage) return {};

	return {
		promptTokens:
			typeof usage.promptTokens === 'number' && Number.isFinite(usage.promptTokens)
				? usage.promptTokens
				: undefined,
		completionTokens:
			typeof usage.completionTokens === 'number' && Number.isFinite(usage.completionTokens)
				? usage.completionTokens
				: undefined,
		totalTokens:
			typeof usage.totalTokens === 'number' && Number.isFinite(usage.totalTokens)
				? usage.totalTokens
				: undefined
	};
}
