import { error, json } from '@sveltejs/kit';
import { z } from 'zod';
import {
	createAnnotation,
	deleteAnnotation,
	updateAnnotation
} from '$lib/server/highlights/highlight-service';
import { isAppNotFoundError } from '$lib/server/app-errors';
import {
	configuredEmbeddingModel,
	markEmbeddingPending,
	triggerEmbeddingProcessing
} from '$lib/server/embeddings/highlight-embedding-service';
import type { RequestHandler } from './$types';

const CreateAnnotationSchema = z.object({
	highlight_id: z.string().uuid(),
	body: z.string().min(1, 'Body cannot be empty'),
	source: z.enum(['human', 'ai']).default('human')
});

const UpdateAnnotationSchema = z.object({
	id: z.string().uuid(),
	body: z.string().min(1, 'Body cannot be empty')
});

export const POST: RequestHandler = async ({ fetch, locals: { supabase, user }, params, request }) => {
	if (!user) error(401, 'Unauthorized');

	const parsed = CreateAnnotationSchema.safeParse(await request.json().catch(() => null));
	if (!parsed.success) error(400, parsed.error.issues[0]?.message ?? 'Invalid request body');

	const { highlight_id, body, source } = parsed.data;

	try {
		const data = await createAnnotation(supabase, { highlight_id, owner_id: user.id, body, source });
		await markEmbeddingPending(supabase, {
			highlightId: String(data.highlight_id),
			model: configuredEmbeddingModel()
		});
		triggerEmbeddingProcessing(fetch, { documentId: params.id });
		return json(data);
	} catch (e) {
		console.error('[annotations POST]', e);		
		error(500, 'Failed to create annotation');
	}
};

export const PATCH: RequestHandler = async ({ fetch, locals: { supabase, user }, params, request }) => {
	if (!user) error(401, 'Unauthorized');

	const parsed = UpdateAnnotationSchema.safeParse(await request.json().catch(() => null));
	if (!parsed.success) error(400, parsed.error.issues[0]?.message ?? 'Invalid request body');

	const { id, body } = parsed.data;

	try {
		const data = await updateAnnotation(supabase, id, body);
		await markEmbeddingPending(supabase, {
			highlightId: String(data.highlight_id),
			model: configuredEmbeddingModel()
		});
		triggerEmbeddingProcessing(fetch, { documentId: params.id });
		return json(data);
	} catch (e) {
		console.error('[annotations PATCH]', e);
		error(500, 'Failed to update annotation');
	}
};

export const DELETE: RequestHandler = async ({ fetch, locals: { supabase, user }, params, url }) => {
	if (!user) error(401, 'Unauthorized');

	const id = url.searchParams.get('id');
	if (!id) error(400, 'Missing id');

	try {
		const deleted = await deleteAnnotation(supabase, id, { documentId: params.id, userId: user.id });
		if (deleted?.highlight_id) {
			await markEmbeddingPending(supabase, {
				highlightId: String(deleted.highlight_id),
				model: configuredEmbeddingModel()
			});
			triggerEmbeddingProcessing(fetch, { documentId: params.id });
		}
		return json({ ok: true });
	} catch (e) {
		if (isAppNotFoundError(e)) error(404, e.message);
		console.error('[annotations DELETE]', e);
		error(500, 'Failed to delete annotation');
	}
};
