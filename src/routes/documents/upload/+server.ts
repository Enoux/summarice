import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { uploadDocumentFile } from '$lib/server/document-upload/upload-document';

export const POST: RequestHandler = async ({ locals, request }) => {
	if (!locals.user) error(401, 'Unauthorized');

	const formData = await request.formData().catch(() => null);
	const entry = formData?.get('file');

	if (!(entry instanceof File)) {
		error(400, 'Missing PDF file');
	}

	if (!entry.name.toLowerCase().endsWith('.pdf')) {
		error(400, 'Only PDF uploads are supported');
	}

	try {
		const result = await uploadDocumentFile(locals.supabase, locals.user.id, entry);
		return json(result);
	} catch (e) {
		console.error('[documents/upload POST]', e);
		error(500, e instanceof Error ? e.message : 'Failed to upload document');
	}
};
