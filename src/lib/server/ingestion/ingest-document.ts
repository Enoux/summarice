import type { SupabaseClient } from '@supabase/supabase-js';
import { extractPdfOutline } from './pdf-outline';
import { liteParseResultToPages } from './liteparse-pages';
import { parsePdfWithLiteParse } from './liteparse-adapter';

const TEXT_DENSITY_THRESHOLD = 50;

function sanitizeFilename(name: string) {
	return name.replace(/[^a-zA-Z0-9.-]/g, '_');
}

function cloneBytes(bytes: Uint8Array) {
	return new Uint8Array(bytes);
}

export async function ingestDocumentFile(
	supabase: SupabaseClient,
	userId: string,
	file: File
) {
	const sourceBytes = new Uint8Array(await file.arrayBuffer());
	const parsed = await parsePdfWithLiteParse(cloneBytes(sourceBytes));
	const pages = liteParseResultToPages(parsed);
	const pageCount = pages.length;
	const totalTextLength = pages.reduce((sum, page) => sum + page.text.length, 0);
	const avgTextDensity = pageCount === 0 ? 0 : totalTextLength / pageCount;

	if (avgTextDensity < TEXT_DENSITY_THRESHOLD) {
		throw new Error(
			'Scanned PDF detected. This document does not have a text layer and cannot be ingested.'
		);
	}

	const storagePath = `${userId}/${Date.now()}-${sanitizeFilename(file.name)}`;
	const outline = await extractPdfOutline(cloneBytes(sourceBytes)).catch(() => []);

	const { error: uploadError } = await supabase.storage
		.from('documents')
		.upload(storagePath, cloneBytes(sourceBytes), {
			contentType: file.type || 'application/pdf'
		});

	if (uploadError) throw uploadError;

	const { data: documentId, error: rpcError } = await supabase.rpc('ingest_document', {
		p_title: file.name,
		p_page_count: pageCount,
		p_has_text_layer: true,
		p_outline: outline,
		p_storage_path: storagePath,
		p_pages: pages
	});

	if (rpcError) {
		await supabase.storage.from('documents').remove([storagePath]);
		throw rpcError;
	}

	return {
		documentId,
		pageCount,
		title: file.name
	};
}
