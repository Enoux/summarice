import type { SupabaseClient } from '@supabase/supabase-js';
import {
	commentedHighlightToCreatePayload,
	type HighlightRow,
	rowToCommentedHighlight
} from '$lib/domain/highlight-mapper';
import type { CommentedHighlight, Highlight } from '$lib/pdf-highlighter/types';

type SupabaseErrorLike = {
	code?: string;
	message?: string;
};

function isMissingRelationError(err: unknown, relation: string): boolean {
	const e = err as SupabaseErrorLike | null;
	if (!e) return false;
	return e.code === 'PGRST205' && (e.message ?? '').includes(`'public.${relation}'`);
}

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

export async function deleteHighlightById(supabase: SupabaseClient, highlightId: string) {
	const { error } = await supabase.from('highlights').delete().eq('id', highlightId);
	if (error) throw error;
}
