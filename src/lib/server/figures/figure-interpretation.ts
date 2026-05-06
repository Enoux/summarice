import type { SupabaseClient } from '@supabase/supabase-js';
import type { ModelMessage } from 'ai';
import {
	createAnnotation,
	deleteAnnotation,
	updateAnnotation
} from '$lib/server/highlights/highlight-service';
import type { LLMUsage } from '$lib/server/ai/types';

export type FigureInterpretationDraft = {
	annotationId: string;
	highlightId: string;
	streamUrl: string;
	annotation: {
		id: string;
		highlight_id: string;
		owner_id: string;
		body: string;
		source: 'ai';
		created_at?: string;
		updated_at?: string;
	};
};

type HighlightFigureSource = {
	id: string;
	document_id: string;
	owner_id: string;
	page_number: number;
	screenshot_path: string | null;
	bounding_box: unknown;
};

export async function createFigureInterpretationDraft(
	supabase: SupabaseClient,
	opts: { documentId: string; highlightId: string; ownerId: string }
): Promise<FigureInterpretationDraft> {
	const highlight = await fetchOwnedAreaHighlight(supabase, opts);
	const { data: existingAnnotations } = await supabase
		.from('annotations')
		.select('*')
		.eq('highlight_id', highlight.id)
		.eq('owner_id', opts.ownerId)
		.eq('source', 'ai')
		.order('created_at', { ascending: true })
		.limit(20);
	const existing = existingAnnotations?.[0];
	await Promise.all(
		(existingAnnotations ?? []).slice(1).map((row) => deleteAnnotation(supabase, row.id))
	);

	const annotation = existing
		? await updateAnnotation(supabase, existing.id as string, 'Generating figure interpretation...')
		: await createAnnotation(supabase, {
				highlight_id: highlight.id,
				owner_id: opts.ownerId,
				body: 'Generating figure interpretation...',
				source: 'ai'
			});

	return {
		annotationId: annotation.id as string,
		highlightId: highlight.id,
		annotation: annotation as FigureInterpretationDraft['annotation'],
		streamUrl: `/doc/${opts.documentId}/figure-interpretation/stream?annotationId=${encodeURIComponent(
			annotation.id as string
		)}&highlightId=${encodeURIComponent(highlight.id)}`
	};
}

export async function buildFigureInterpretationPrompt(
	supabase: SupabaseClient,
	opts: { documentId: string; highlightId: string; annotationId: string; ownerId: string }
): Promise<{
	system: string;
	messages: ModelMessage[];
	annotationId: string;
	highlightId: string;
}> {
	const highlight = await fetchOwnedAreaHighlight(supabase, opts);
	await assertOwnedAnnotation(supabase, {
		annotationId: opts.annotationId,
		highlightId: highlight.id,
		ownerId: opts.ownerId
	});

	if (!highlight.screenshot_path) {
		throw new Error('Area highlight does not have a stored screenshot');
	}

	const { data, error } = await supabase.storage
		.from('highlight-screenshots')
		.createSignedUrl(highlight.screenshot_path, 600);
	if (error || !data?.signedUrl) {
		throw new Error('Could not sign figure screenshot');
	}

	return {
		annotationId: opts.annotationId,
		highlightId: highlight.id,
		system: `You are an expert scientific figure analyst. Your job is to interpret figures captured from PDFs — charts, diagrams, plots, schematics, tables, and illustrations.

Rules:
- Base your interpretation solely on what is visible in the screenshot.
- STRICTLY NO MARKDOWN SYNTAX (no bold, no italics, no headers).
- Output a single, cohesive paragraph that can be inserted into a note component.
- If the screenshot is blurry, too small, or does not clearly contain a figure (chart, diagram, table, etc.), do not interpret it. Instead, respond with exactly: "This screenshot does not appear to contain a clear figure. Please try retaking the area highlight for better results."
- Be precise but concise. Avoid filler phrases like "This figure shows...".`,
		messages: [
			{
				role: 'user',
				content: [
					{
						type: 'text',
						text: 'Examine this screenshot. If it is a clear figure, provide a 2-4 sentence interpretation. If it is not a figure or is unclear, provide the prescribed failure message.'
					},
					{
						type: 'image',
						image: new URL(data.signedUrl),
						mediaType: mediaTypeFromPath(highlight.screenshot_path)
					}
				]
			}
		]
	};
}

export async function patchFinalFigureInterpretation(
	supabase: SupabaseClient,
	opts: { annotationId: string; markdown: string }
) {
	return updateAnnotation(
		supabase,
		opts.annotationId,
		opts.markdown.trim() || 'No interpretation generated.'
	);
}

export async function recordFigureInterpretationTelemetry(
	supabase: SupabaseClient,
	opts: {
		ownerId: string;
		documentId: string;
		highlightId: string;
		annotationId: string;
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
		highlight_id: opts.highlightId,
		annotation_id: opts.annotationId,
		provider: opts.provider,
		model: opts.model,
		use_case: 'figure_interpretation',
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
		console.warn('[figure-interpretation telemetry]', error);
	}
}

async function fetchOwnedAreaHighlight(
	supabase: SupabaseClient,
	opts: { documentId: string; highlightId: string; ownerId: string }
): Promise<HighlightFigureSource> {
	const { data, error } = await supabase
		.from('highlights')
		.select('id, document_id, owner_id, page_number, screenshot_path, bounding_box')
		.eq('id', opts.highlightId)
		.eq('document_id', opts.documentId)
		.eq('owner_id', opts.ownerId)
		.eq('kind', 'area')
		.single();

	if (error || !data) {
		throw new Error('Area highlight not found');
	}

	return data as HighlightFigureSource;
}

async function assertOwnedAnnotation(
	supabase: SupabaseClient,
	opts: { annotationId: string; highlightId: string; ownerId: string }
) {
	const { data, error } = await supabase
		.from('annotations')
		.select('id')
		.eq('id', opts.annotationId)
		.eq('highlight_id', opts.highlightId)
		.eq('owner_id', opts.ownerId)
		.eq('source', 'ai')
		.single();

	if (error || !data) {
		throw new Error('AI annotation draft not found');
	}
}

function mediaTypeFromPath(path: string): string {
	const lower = path.toLowerCase();
	if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg';
	if (lower.endsWith('.webp')) return 'image/webp';
	return 'image/png';
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
