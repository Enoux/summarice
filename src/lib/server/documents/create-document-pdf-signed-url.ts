import type { SupabaseClient } from '@supabase/supabase-js';

export const VIEWER_DOCUMENT_PDF_SIGNED_URL_TTL_SECONDS = 43200;
export const PREVIEW_DOCUMENT_PDF_SIGNED_URL_TTL_SECONDS = 3600;

export type DocumentPdfSignedUrlErrorCode = 'not_found' | 'missing_file' | 'sign_failed';

export class DocumentPdfSignedUrlError extends Error {
	readonly code: DocumentPdfSignedUrlErrorCode;

	constructor(code: DocumentPdfSignedUrlErrorCode, message: string) {
		super(message);
		this.name = 'DocumentPdfSignedUrlError';
		this.code = code;
	}
}

export async function createDocumentPdfSignedUrl(
	supabase: SupabaseClient,
	opts: {
		documentId: string;
		userId: string;
		ttlSeconds: number;
	}
): Promise<string> {
	const { data: document, error: docError } = await supabase
		.from('documents')
		.select('storage_path, owner_id')
		.eq('id', opts.documentId)
		.single();

	if (docError || !document) {
		throw new DocumentPdfSignedUrlError('not_found', 'Document not found');
	}

	if (document.owner_id !== opts.userId) {
		throw new DocumentPdfSignedUrlError('not_found', 'Document not found');
	}

	const storagePath = document.storage_path;
	if (typeof storagePath !== 'string' || storagePath.length === 0) {
		throw new DocumentPdfSignedUrlError('missing_file', 'Document file is missing');
	}

	const { data, error: signError } = await supabase.storage
		.from('documents')
		.createSignedUrl(storagePath, opts.ttlSeconds);

	if (signError || !data?.signedUrl) {
		throw new DocumentPdfSignedUrlError('sign_failed', 'Could not generate signed URL');
	}

	return data.signedUrl;
}
