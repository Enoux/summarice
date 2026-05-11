import { error, isHttpError, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { deleteDocumentForUser } from '$lib/server/document-upload/delete-document';

export const DELETE: RequestHandler = async ({ locals, params }) => {
	if (!locals.user) error(401, 'Unauthorized');

	const documentId = params.id?.trim();
	if (!documentId) error(400, 'Missing document id');

	try {
		const result = await deleteDocumentForUser(locals.supabase, {
			documentId,
			userId: locals.user.id
		});

		if (!result.deleted) {
			error(404, 'Document not found');
		}

		return json({
			ok: true,
			...(result.warnings.length > 0 ? { warnings: result.warnings } : {})
		});
	} catch (e) {
		if (isHttpError(e)) throw e;
		console.error('[documents/[id] DELETE]', e);
		error(500, 'Failed to delete document');
	}
};
