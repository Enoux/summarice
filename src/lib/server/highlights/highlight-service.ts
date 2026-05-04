import { randomUUID } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
	commentedHighlightToCreatePayload,
	type HighlightRow,
	rowToCommentedHighlight
} from '$lib/features/highlights/domain/highlight-mapper';
import type { CommentedHighlight, Highlight } from '$lib/pdf-highlighter/types';
import type { ScaledPosition } from '$lib/pdf-highlighter/types';
import {
	refineHighlightText,
	type HighlightTextStatus
} from '$lib/server/highlights/highlight-text-refiner';
import {
	createHighlightScreenshotSignedUrl,
	removeHighlightScreenshot,
	uploadHighlightScreenshot
} from '$lib/server/highlights/screenshot-storage';
import type { StoredPageLayout } from '$lib/server/ingestion/liteparse-pages';

type SupabaseErrorLike = {
	code?: string;
	message?: string;
};

function isMissingRelationError(err: unknown, relation: string): boolean {
	const e = err as SupabaseErrorLike | null;
	if (!e) return false;
	return e.code === 'PGRST205' && (e.message ?? '').includes(`'public.${relation}'`);
}

// ─── User Settings ────────────────────────────────────────────────────────────

export async function ensureUserSettingsRow(supabase: SupabaseClient, userId: string) {
	const { data: existing, error: readErr } = await supabase
		.from('user_settings')
		.select('id')
		.eq('id', userId)
		.maybeSingle();
	if (readErr) {
		if (isMissingRelationError(readErr, 'user_settings')) return;
		throw readErr;
	}
	if (existing) return;
	const { error: insertErr } = await supabase.from('user_settings').insert({ id: userId });
	if (insertErr && !isMissingRelationError(insertErr, 'user_settings')) {
		throw insertErr;
	}
}

export async function fetchUserSettings(supabase: SupabaseClient, userId: string) {
	const { data, error } = await supabase
		.from('user_settings')
		.select('*')
		.eq('id', userId)
		.maybeSingle();
	if (error) {
		if (isMissingRelationError(error, 'user_settings')) return null;
		throw error;
	}
	return data;
}

// ─── Highlights ───────────────────────────────────────────────────────────────

export async function fetchHighlightsForDocument(
	supabase: SupabaseClient,
	documentId: string
): Promise<HighlightRow[]> {
	const { data, error } = await supabase
		.from('highlights')
		.select('*, annotations(*)')
		.eq('document_id', documentId)
		.order('ordinal', { ascending: true });
	if (error) throw error;
	return (data ?? []) as HighlightRow[];
}

export async function createHighlightRpc(
	supabase: SupabaseClient,
	h: Highlight,
	opts: {
		documentId: string;
		decorative: boolean;
		colorHex: string;
		screenshotPath?: string | null;
	}
) {
	const payload = commentedHighlightToCreatePayload(h as CommentedHighlight, {
		documentId: opts.documentId,
		decorative: opts.decorative,
		colorHex: opts.colorHex,
		screenshotPath: opts.screenshotPath
	});
	const { data, error } = await supabase.rpc('create_highlight', payload);
	if (error) throw error;
	return rowToCommentedHighlight(data as HighlightRow);
}

async function resolveHighlightText(
	supabase: SupabaseClient,
	documentId: string,
	highlight: CommentedHighlight
): Promise<{ text: string; text_status: Exclude<HighlightTextStatus, 'provisional'> }> {
	if (highlight.type !== 'text' || !highlight.position) {
		return {
			text: highlight.content?.text ?? '',
			text_status: 'fallback'
		};
	}

	const pageNumber = highlight.position.boundingRect.pageNumber;
	const provisionalText = highlight.content?.text ?? '';

	const { data, error } = await supabase
		.from('document_pages')
		.select('layout')
		.eq('document_id', documentId)
		.eq('page_number', pageNumber)
		.maybeSingle();

	if (error) {
		return { text: provisionalText, text_status: 'fallback' };
	}

	return refineHighlightText({
		provisionalText,
		position: highlight.position,
		layout: (data?.layout as StoredPageLayout | null | undefined) ?? null
	});
}

export async function createHighlightWithResolvedText(
	supabase: SupabaseClient,
	highlight: CommentedHighlight,
	opts: {
		documentId: string;
		userId: string;
		decorative: boolean;
		colorHex: string;
	}
) {
	const resolution = await resolveHighlightText(supabase, opts.documentId, highlight).catch(() => ({
		text: highlight.content?.text ?? '',
		text_status: 'fallback' as const
	}));

	const highlightId = highlight.id ?? randomUUID();
	const screenshot =
		highlight.type === 'area'
			? await uploadHighlightScreenshot(supabase, {
					userId: opts.userId,
					documentId: opts.documentId,
					highlightId,
					imageDataUrl: highlight.content?.image
				})
			: null;

	let created: CommentedHighlight;
	try {
		created = await createHighlightRpc(
			supabase,
			{
				...highlight,
				id: highlight.id ?? (screenshot ? highlightId : undefined),
				content: {
					...highlight.content,
					text: resolution.text
				}
			},
			{ ...opts, screenshotPath: screenshot?.path ?? null }
		);
	} catch (error) {
		await removeHighlightScreenshot(supabase, screenshot?.path ?? null);
		throw error;
	}

	return {
		...created,
		content:
			created.type === 'area' && screenshot?.signedUrl
				? { ...created.content, image: screenshot.signedUrl }
				: created.content,
		text_status: resolution.text_status
	};
}

export async function rowToCommentedHighlightWithScreenshot(
	supabase: SupabaseClient,
	row: HighlightRow
) {
	const screenshotUrl = await createHighlightScreenshotSignedUrl(supabase, row.screenshot_path);
	return rowToCommentedHighlight(row, { screenshotUrl });
}

export async function updateHighlight(
	supabase: SupabaseClient,
	id: string,
	documentId: string,
	patch: { category?: number | null; color?: string; comment?: string | null }
) {
	const update: Record<string, unknown> = {};
	if (patch.comment !== undefined) update.comment = patch.comment?.trim() || null;
	if (patch.category !== undefined) update.category = patch.category;
	if (patch.color !== undefined) update.color = patch.color;
	if (Object.keys(update).length === 0) return;
	const { error } = await supabase
		.from('highlights')
		.update(update)
		.eq('id', id)
		.eq('document_id', documentId);
	if (error) throw error;
}

export async function updateAreaHighlightScreenshot(
	supabase: SupabaseClient,
	opts: {
		id: string;
		documentId: string;
		userId: string;
		position: ScaledPosition;
		imageDataUrl: string;
	}
) {
	const { data: existing, error: readError } = await supabase
		.from('highlights')
		.select('*')
		.eq('id', opts.id)
		.eq('document_id', opts.documentId)
		.eq('owner_id', opts.userId)
		.eq('kind', 'area')
		.single();
	if (readError || !existing) throw readError ?? new Error('Area highlight not found');

	const previousScreenshotPath = (existing as HighlightRow).screenshot_path;
	const nextPath = `${opts.userId}/${opts.documentId}/${opts.id}-${Date.now()}.png`;
	const uploaded = await uploadHighlightScreenshot(supabase, {
		userId: opts.userId,
		documentId: opts.documentId,
		highlightId: opts.id,
		imageDataUrl: opts.imageDataUrl,
		path: nextPath
	});
	if (!uploaded) throw new Error('Invalid PNG screenshot');

	let updated: HighlightRow;
	try {
		const { data, error } = await supabase
			.from('highlights')
			.update({
				bounding_box: opts.position,
				page_number: opts.position.boundingRect.pageNumber,
				screenshot_path: uploaded.path
			})
			.eq('id', opts.id)
			.eq('document_id', opts.documentId)
			.eq('owner_id', opts.userId)
			.eq('kind', 'area')
			.select('*, annotations(*)')
			.single();
		if (error || !data) throw error ?? new Error('Area highlight update failed');
		updated = data as HighlightRow;
	} catch (error) {
		await removeHighlightScreenshot(supabase, uploaded.path);
		throw error;
	}

	await removeHighlightScreenshot(supabase, previousScreenshotPath);
	const screenshotUrl = await createHighlightScreenshotSignedUrl(supabase, updated.screenshot_path);
	return rowToCommentedHighlight(updated, { screenshotUrl });
}

export async function deleteHighlightById(supabase: SupabaseClient, highlightId: string) {
	const { error } = await supabase.from('highlights').delete().eq('id', highlightId);
	if (error) throw error;
}

// ─── Annotations ──────────────────────────────────────────────────────────────

export async function createAnnotation(
	supabase: SupabaseClient,
	opts: { highlight_id: string; owner_id: string; body: string; source: 'human' | 'ai' }
) {
	const { data, error } = await supabase.from('annotations').insert(opts).select().single();
	if (error) throw error;
	return data;
}

export async function updateAnnotation(supabase: SupabaseClient, id: string, body: string) {
	const { data, error } = await supabase
		.from('annotations')
		.update({ body })
		.eq('id', id)
		.select()
		.single();
	if (error) throw error;
	return data;
}

export async function deleteAnnotation(supabase: SupabaseClient, id: string) {
	const { error } = await supabase.from('annotations').delete().eq('id', id);
	if (error) throw error;
}
