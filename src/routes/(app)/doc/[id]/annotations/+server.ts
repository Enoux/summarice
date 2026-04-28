import { error, json } from '@sveltejs/kit';
import { z } from 'zod';
import {
	createAnnotation,
	deleteAnnotation,
	updateAnnotation
} from '$lib/server/highlights/highlight-service';
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

export const POST: RequestHandler = async ({ locals: { supabase, user }, request }) => {
	if (!user) error(401, 'Unauthorized');

	const parsed = CreateAnnotationSchema.safeParse(await request.json().catch(() => null));
	if (!parsed.success) error(400, parsed.error.issues[0]?.message ?? 'Invalid request body');

	const { highlight_id, body, source } = parsed.data;

	try {
		const data = await createAnnotation(supabase, { highlight_id, owner_id: user.id, body, source });
		return json(data);
	} catch (e) {
		console.error('[annotations POST]', e);		
		error(500, 'Failed to create annotation');
	}
};

export const PATCH: RequestHandler = async ({ locals: { supabase, user }, request }) => {
	if (!user) error(401, 'Unauthorized');

	const parsed = UpdateAnnotationSchema.safeParse(await request.json().catch(() => null));
	if (!parsed.success) error(400, parsed.error.issues[0]?.message ?? 'Invalid request body');

	const { id, body } = parsed.data;

	try {
		const data = await updateAnnotation(supabase, id, body);
		return json(data);
	} catch (e) {
		console.error('[annotations PATCH]', e);
		error(500, 'Failed to update annotation');
	}
};

export const DELETE: RequestHandler = async ({ locals: { supabase, user }, url }) => {
	if (!user) error(401, 'Unauthorized');

	const id = url.searchParams.get('id');
	if (!id) error(400, 'Missing id');

	try {
		await deleteAnnotation(supabase, id);
		return json({ ok: true });
	} catch (e) {
		console.error('[annotations DELETE]', e);
		error(500, 'Failed to delete annotation');
	}
};
