import { error } from '@sveltejs/kit';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { ModelMessage } from 'ai';

import { getLLMProvider } from '$lib/server/ai';
import type { LLMUsage } from '$lib/server/ai/types';
import { env } from '$lib/server/env';
import { assertWithinLimit } from '$lib/server/limits/assertWithinLimit';
import { buildSummaryPrompt } from '$lib/server/summary/build-summary-prompt';
import { summarySchema, type SummarySchema } from '$lib/server/summary/summary-schema';
import { validateAndExtractCitations } from '$lib/server/summary/validate-citations';

import type { RequestHandler } from './$types';

const encoder = new TextEncoder();

export const POST: RequestHandler = async ({ locals: { supabase, user }, params, request }) => {
	if (!user) error(401, 'Unauthorized');
	if (!params.id) error(400, 'Missing document id');

	let prompt: Awaited<ReturnType<typeof buildSummaryPrompt>>;
	try {
		await assertWithinLimit({ ownerId: user.id, operation: 'summary_generate' });
		prompt = await buildSummaryPrompt(supabase, {
			documentId: params.id,
			ownerId: user.id
		});
	} catch (e) {
		console.error('[summary stream setup]', e);
		error(400, e instanceof Error ? e.message : 'Could not prepare summary prompt');
	}

	if (!env.OPENROUTER_API_KEY) error(500, 'OPENROUTER_API_KEY is not configured');

	const provider = getLLMProvider();
	const model = prompt.model;
	const llm = provider.streamObject<SummarySchema>({
		operation: 'summary_generate',
		ownerId: user.id,
		documentId: params.id,
		system: prompt.system,
		messages: withOpenRouterCacheControl(prompt.messages),
		model,
		schema: summarySchema,
		temperature: 0.2,
		abortSignal: request.signal
	});

	const stream = new ReadableStream<Uint8Array>({
		async start(controller) {
			let markdown = '';

			const send = (event: string, data: unknown) => {
				controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
			};

			try {
				send('ready', { documentId: params.id });

				for await (const partial of llm.partialObjectStream) {
					const nextMarkdown = typeof partial.markdown === 'string' ? partial.markdown : markdown;
					const delta = nextMarkdown.startsWith(markdown)
						? nextMarkdown.slice(markdown.length)
						: nextMarkdown;

					markdown = nextMarkdown;
					if (delta) {
						send('delta', { partial_markdown: delta });
					}
				}

				const [finalObject, telemetry] = await Promise.all([
					llm.finalObject,
					llm.telemetry.catch(() => undefined)
				]);
				const finalMarkdown = finalObject.markdown.trim() || markdown.trim();
				const validated = validateAndExtractCitations(finalMarkdown, prompt.ordinalWhitelist);

				const { data: summary, error: rpcError } = await supabase.rpc('generate_summary_finalize', {
					p_document_id: params.id,
					p_markdown: validated.cleanedMarkdown,
					p_tags: finalObject.tags,
					p_entities: finalObject.entities,
					p_open_questions: finalObject.open_questions,
					p_model: telemetry?.model ?? model,
					p_prompt_tokens: telemetry?.usage.promptTokens ?? null,
					p_completion_tokens: telemetry?.usage.completionTokens ?? null,
					p_citations: validated.citations
				});

				if (rpcError || !summary) {
					throw new Error(rpcError?.message ?? 'Could not finalize summary');
				}

				await recordSummaryTelemetry(supabase, {
					ownerId: user.id,
					documentId: params.id,
					provider: telemetry?.provider ?? 'openrouter',
					model: telemetry?.model ?? model,
					usage: telemetry?.usage,
					latencyMs: telemetry?.latencyMs,
					costUsd: telemetry?.costUsd,
					providerMetadata: telemetry?.providerMetadata,
					status: 'completed'
				});

				send('done', {
					summary,
					citations: validated.citations
				});
			} catch (e) {
				if (e instanceof Error && e.name === 'AbortError') {
					if (request.signal.aborted && !request.signal.reason?.message?.includes('timeout')) {
						return;
					}
					send('error', { message: 'AI request timed out' });
					await recordSummaryTelemetry(supabase, {
						ownerId: user.id,
						documentId: params.id,
						provider: 'openrouter',
						model,
						status: 'failed',
						errorMessage: 'AI request timed out (60s)'
					});
					return;
				}

				console.error('[summary stream]', e);
				await recordSummaryTelemetry(supabase, {
					ownerId: user.id,
					documentId: params.id,
					provider: 'openrouter',
					model,
					status: 'failed',
					errorMessage: e instanceof Error ? e.message : 'Unknown stream error'
				});
				send('error', { message: 'Summary generation failed' });
			} finally {
				controller.close();
			}
		}
	});

	return new Response(stream, {
		headers: {
			'Content-Type': 'text/event-stream',
			'Cache-Control': 'no-cache, no-transform',
			Connection: 'keep-alive'
		}
	});
};

function withOpenRouterCacheControl(messages: ModelMessage[]): ModelMessage[] {
	if (messages.length === 0) return messages;

	const [first, ...rest] = messages;
	return [
		{
			...first,
			providerOptions: {
				...(first.providerOptions ?? {}),
				openrouter: {
					...((first.providerOptions?.openrouter as Record<string, unknown> | undefined) ?? {}),
					cacheControl: 'ephemeral'
				}
			}
		},
		...rest
	] as ModelMessage[];
}

async function recordSummaryTelemetry(
	supabase: SupabaseClient,
	opts: {
		ownerId: string;
		documentId: string;
		provider: string;
		model: string;
		usage?: LLMUsage;
		latencyMs?: number;
		costUsd?: number;
		providerMetadata?: unknown;
		status: 'completed' | 'failed';
		errorMessage?: string;
	}
) {
	const usage = normalizeUsage(opts.usage);
	const { error } = await supabase.from('llm_calls').insert({
		owner_id: opts.ownerId,
		document_id: opts.documentId,
		provider: opts.provider,
		model: opts.model,
		use_case: 'summary_generate',
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
		console.warn('[summary telemetry]', error);
	}
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
