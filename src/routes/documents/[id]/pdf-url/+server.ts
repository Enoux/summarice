import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import {
	createDocumentPdfSignedUrl,
	DocumentPdfSignedUrlError,
	PREVIEW_DOCUMENT_PDF_SIGNED_URL_TTL_SECONDS
} from '$lib/server/documents/create-document-pdf-signed-url';

export const GET: RequestHandler = async ({ locals, params }) => {
	if (!locals.user) {
		error(401, 'Unauthorized');
	}

	const documentId = params.id?.trim();
	if (!documentId) {
		error(400, 'Missing document id');
	}

	try {
		const pdfUrl = await createDocumentPdfSignedUrl(locals.supabase, {
			documentId,
			userId: locals.user.id,
			ttlSeconds: PREVIEW_DOCUMENT_PDF_SIGNED_URL_TTL_SECONDS
		});
		return json({ pdfUrl });
	} catch (e) {
		if (e instanceof DocumentPdfSignedUrlError) {
			if (e.code === 'not_found') {
				error(404, e.message);
			}
			if (e.code === 'missing_file') {
				error(500, e.message);
			}
			error(500, e.message);
		}
		console.error('[documents/[id]/pdf-url GET]', e);
		error(500, 'Could not generate signed URL');
	}
};
