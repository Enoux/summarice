import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import type { CommentedHighlight } from '$lib/pdf-highlighter/types';
import { createHighlightRpc, deleteHighlightById } from '$lib/server/highlights/highlight-service';

export const POST: RequestHandler = async ({ locals, params, request }) => {
	if (!locals.user) error(401, 'Unauthorized');

	let body: {
		highlight: CommentedHighlight;
		decorative: boolean;
		colorHex: string;
	};
	try {
		body = await request.json();
	} catch {
		error(400, 'Invalid JSON');
	}

	const { highlight, decorative, colorHex } = body;
	if (!highlight?.position?.boundingRect || typeof colorHex !== 'string') {
		error(400, 'Invalid payload');
	}

	try {
		const created = await createHighlightRpc(locals.supabase, highlight, {
			documentId: params.id,
			decorative: !!decorative,
			colorHex
		});
		return json(created);
	} catch (e) {
		console.error(e);
		error(500, 'Failed to create highlight');
	}
};

export const PATCH: RequestHandler = async ({ locals, request }) => {
	if (!locals.user) error(401, 'Unauthorized');

	let body: {
		id: string;
		category?: number | null;
		color?: string;
		comment?: string | null;
	};
	try {
		body = await request.json();
	} catch {
		error(400, 'Invalid JSON');
	}

	if (!body.id) error(400, 'Missing id');

	try {
		const patch: Record<string, unknown> = {};
		if (body.comment !== undefined) {
			patch.comment =
				body.comment && String(body.comment).trim() ? String(body.comment).trim() : null;
		}
		if (body.category !== undefined) patch.category = body.category;
		if (body.color !== undefined) patch.color = body.color;
		if (Object.keys(patch).length > 0) {
			const { error: upErr } = await locals.supabase
				.from('highlights')
				.update(patch)
				.eq('id', body.id);
			if (upErr) throw upErr;
		}
		return json({ ok: true });
	} catch (e) {
		console.error(e);
		error(500, 'Failed to update highlight');
	}
};

export const DELETE: RequestHandler = async ({ locals, url }) => {
	if (!locals.user) error(401, 'Unauthorized');
	const id = url.searchParams.get('id');
	if (!id) error(400, 'Missing id');
	try {
		await deleteHighlightById(locals.supabase, id);
		return json({ ok: true });
	} catch (e) {
		console.error(e);
		error(500, 'Failed to delete highlight');
	}
};
