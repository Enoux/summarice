import type { SupabaseClient } from '@supabase/supabase-js';
import {
	commentedHighlightToCreatePayload,
	type HighlightRow,
	rowToCommentedHighlight
} from '$lib/domain/highlight-mapper';
import type { CommentedHighlight, Highlight } from '$lib/pdf-highlighter/types';
import {
	refineHighlightText,
	type HighlightTextStatus
} from '$lib/server/highlights/highlight-text-refiner';
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
	}
) {
	const payload = commentedHighlightToCreatePayload(h as CommentedHighlight, {
		documentId: opts.documentId,
		decorative: opts.decorative,
		colorHex: opts.colorHex
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
		decorative: boolean;
		colorHex: string;
	}
) {
	const resolution = await resolveHighlightText(supabase, opts.documentId, highlight).catch(() => ({
		text: highlight.content?.text ?? '',
		text_status: 'fallback' as const
	}));

	const created = await createHighlightRpc(
		supabase,
		{
			...highlight,
			content: {
				...highlight.content,
				text: resolution.text
			}
		},
		opts
	);

	return {
		...created,
		text_status: resolution.text_status
	};
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

export async function deleteHighlightById(supabase: SupabaseClient, highlightId: string) {
	const { error } = await supabase.from('highlights').delete().eq('id', highlightId);
	if (error) throw error;
}

// ─── Annotations ──────────────────────────────────────────────────────────────

export async function createAnnotation(
	supabase: SupabaseClient,
	opts: { highlight_id: string; owner_id: string; body: string; source: 'human' | 'ai' }
) {
	const { data, error } = await supabase
		.from('annotations')
		.insert(opts)
		.select()
		.single();
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
