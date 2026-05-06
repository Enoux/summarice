import { error } from '@sveltejs/kit';
import { getLLMProvider } from '$lib/server/ai';
import type { LLMUsage } from '$lib/server/ai/types';
import { env } from '$lib/server/env';
import {
	buildFigureInterpretationPrompt,
	patchFinalFigureInterpretation,
	recordFigureInterpretationTelemetry
} from '$lib/server/figures/figure-interpretation';
import type { RequestHandler } from './$types';

const encoder = new TextEncoder();

export const GET: RequestHandler = async ({ locals: { supabase, user }, params, url, request }) => {
	if (!user) error(401, 'Unauthorized');

	const annotationId = url.searchParams.get('annotationId');
	const highlightId = url.searchParams.get('highlightId');
	if (!annotationId || !highlightId) error(400, 'Missing annotationId or highlightId');

	let prompt: Awaited<ReturnType<typeof buildFigureInterpretationPrompt>>;
	try {
		prompt = await buildFigureInterpretationPrompt(supabase, {
			documentId: params.id,
			highlightId,
			annotationId,
			ownerId: user.id
		});
	} catch (e) {
		console.error('[figure-interpretation stream setup]', e);
		error(400, e instanceof Error ? e.message : 'Could not prepare figure interpretation');
	}

	if (!env.OPENROUTER_API_KEY) error(500, 'OPENROUTER_API_KEY is not configured');

	const provider = getLLMProvider();
	const llm = provider.stream({
		operation: 'figure_interpretation',
		ownerId: user.id,
		documentId: params.id,
		highlightId: prompt.highlightId,
		system: prompt.system,
		messages: prompt.messages,
		model: env.OPENROUTER_FIGURE_MODEL,
		abortSignal: request.signal
	});

	const stream = new ReadableStream<Uint8Array>({
		async start(controller) {
			let markdown = '';

			const send = (event: string, data: unknown) => {
				controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
			};

			try {
				send('ready', { annotationId: prompt.annotationId, highlightId: prompt.highlightId });

				let usage: LLMUsage | undefined;
				for await (const chunk of llm) {
					if (chunk.type === 'text') {
						markdown += chunk.text;
						send('delta', { text: chunk.text });
					}
					if (chunk.type === 'finish') {
						usage = chunk.usage;
					}
				}

				const telemetry = await llm.telemetry.catch(() => undefined);
				const annotation = await patchFinalFigureInterpretation(supabase, {
					annotationId: prompt.annotationId,
					markdown
				});

				await recordFigureInterpretationTelemetry(supabase, {
					ownerId: user.id,
					documentId: params.id,
					highlightId: prompt.highlightId,
					annotationId: prompt.annotationId,
					provider: telemetry?.provider ?? 'openrouter',
					model: telemetry?.model ?? env.OPENROUTER_FIGURE_MODEL ?? 'default',
					usage: telemetry?.usage ?? usage,
					latencyMs: telemetry?.latencyMs,
					costUsd: telemetry?.costUsd,
					providerMetadata: telemetry?.providerMetadata,
					status: 'completed'
				});

				send('done', { annotation });
			} catch (e) {
				if (e instanceof Error && e.name === 'AbortError') {
					if (request.signal.aborted && !request.signal.reason?.message?.includes('timeout')) {
						// Client disconnected — connection is gone, nothing to send.
						return;
					}
					// 60s timeout — surface a terminal error chunk to any still-connected client.
					send('error', { message: 'AI request timed out' });
					await recordFigureInterpretationTelemetry(supabase, {
						ownerId: user.id,
						documentId: params.id,
						highlightId: prompt.highlightId,
						annotationId: prompt.annotationId,
						provider: 'openrouter',
						model: env.OPENROUTER_FIGURE_MODEL ?? 'default',
						status: 'failed',
						errorMessage: 'AI request timed out (60s)'
					});
					return;
				}
				console.error('[figure-interpretation stream]', e);
				await recordFigureInterpretationTelemetry(supabase, {
					ownerId: user.id,
					documentId: params.id,
					highlightId: prompt.highlightId,
					annotationId: prompt.annotationId,
					provider: 'openrouter',
					model: env.OPENROUTER_FIGURE_MODEL ?? 'default',
					status: 'failed',
					errorMessage: e instanceof Error ? e.message : 'Unknown stream error'
				});
				send('error', { message: 'Figure interpretation failed' });
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
