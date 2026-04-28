import { json } from '@sveltejs/kit';
import {
	createAnnotation,
	deleteAnnotation,
	updateAnnotation
} from '$lib/server/highlights/highlight-service';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ locals: { supabase, user }, request }) => {
	if (!user) return new Response('Unauthorized', { status: 401 });
	const { highlight_id, body, source = 'human' } = await request.json();
	try {
		const data = await createAnnotation(supabase, {
			highlight_id,
			owner_id: user.id,
			body,
			source
		});
		return json(data);
	} catch (e: any) {
		return new Response(e.message, { status: 500 });
	}
};

export const PATCH: RequestHandler = async ({ locals: { supabase, user }, request }) => {
	if (!user) return new Response('Unauthorized', { status: 401 });
	const { id, body } = await request.json();
	try {
		const data = await updateAnnotation(supabase, id, body);
		return json(data);
	} catch (e: any) {
		return new Response(e.message, { status: 500 });
	}
};

export const DELETE: RequestHandler = async ({ locals: { supabase, user }, url }) => {
	if (!user) return new Response('Unauthorized', { status: 401 });
	const id = url.searchParams.get('id');
	if (!id) return new Response('Missing id', { status: 400 });
	try {
		await deleteAnnotation(supabase, id);
		return json({ success: true });
	} catch (e: any) {
		return new Response(e.message, { status: 500 });
	}
};
