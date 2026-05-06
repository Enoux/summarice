import { getRequestEvent, query } from '$app/server';
import { error } from '@sveltejs/kit';
import { z } from 'zod';

const UuidSchema = z.string().uuid();

export const getCurrentSummary = query(UuidSchema, async (documentId) => {
	const { locals } = getRequestEvent();
	const { supabase, user } = locals;
	if (!user) error(401, 'Unauthorized');

	const { data, error: summaryError } = await supabase
		.from('summaries')
		.select(
			'id, document_id, owner_id, version, is_current, markdown, tags, entities, open_questions, model, prompt_tokens, completion_tokens, created_at'
		)
		.eq('document_id', documentId)
		.eq('owner_id', user.id)
		.eq('is_current', true)
		.maybeSingle();

	if (summaryError) {
		console.error('[summary remote] getCurrentSummary', summaryError);
		error(500, 'Could not load current summary');
	}

	return data;
});

export const listSummaryVersions = query(UuidSchema, async (documentId) => {
	const { locals } = getRequestEvent();
	const { supabase, user } = locals;
	if (!user) error(401, 'Unauthorized');

	const { data, error: versionsError } = await supabase
		.from('summaries')
		.select('id, version, created_at')
		.eq('document_id', documentId)
		.eq('owner_id', user.id)
		.order('version', { ascending: false });

	if (versionsError) {
		console.error('[summary remote] listSummaryVersions', versionsError);
		error(500, 'Could not load summary versions');
	}

	return data ?? [];
});

export const getSummaryVersion = query(UuidSchema, async (summaryId) => {
	const { locals } = getRequestEvent();
	const { supabase, user } = locals;
	if (!user) error(401, 'Unauthorized');

	const { data, error: summaryError } = await supabase
		.from('summaries')
		.select(
			'id, document_id, owner_id, version, is_current, markdown, tags, entities, open_questions, model, prompt_tokens, completion_tokens, created_at'
		)
		.eq('id', summaryId)
		.eq('owner_id', user.id)
		.single();

	if (summaryError || !data) {
		console.error('[summary remote] getSummaryVersion', summaryError);
		error(404, 'Summary version not found');
	}

	return data;
});
