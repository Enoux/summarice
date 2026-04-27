import { GlobalWorkerOptions, getDocument } from 'pdfjs-dist';
import workerSrc from '$lib/pdf-worker-url';
import { loadDocumentOutline } from '$lib/pdf-highlighter/hooks/document-outline';
import type { SupabaseClient } from '@supabase/supabase-js';

if (typeof window !== 'undefined') {
	GlobalWorkerOptions.workerSrc = workerSrc;
}

export type IngestionStage = 'uploading' | 'extracting' | 'parsing' | 'committing' | 'ready' | 'error';

export interface IngestionProgress {
	stage: IngestionStage;
	progress: number; // 0-100
	message?: string;
}

const TEXT_DENSITY_THRESHOLD = 50; // chars per page average

/**
 * Ingests a PDF file: uploads to storage, extracts text/outline, and commits to DB.
 */
export async function ingest(
	file: File,
	supabase: SupabaseClient,
	onProgress?: (progress: IngestionProgress) => void
) {
	try {
		// 1. Uploading
		onProgress?.({ stage: 'uploading', progress: 10, message: 'Uploading PDF to storage...' });
		
		const { data: { user } } = await supabase.auth.getUser();
		if (!user) throw new Error('User not authenticated');

		// Sanitize filename for storage
		const sanitizedName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
		const storagePath = `${user.id}/${Date.now()}-${sanitizedName}`;
		
		const { error: uploadError } = await supabase.storage
			.from('documents')
			.upload(storagePath, file);

		if (uploadError) throw uploadError;

		// 2. Extracting Text
		onProgress?.({ stage: 'extracting', progress: 30, message: 'Extracting text from pages...' });
		
		const arrayBuffer = await file.arrayBuffer();
		const loadingTask = getDocument({ data: arrayBuffer });
		const pdf = await loadingTask.promise;

		const pageCount = pdf.numPages;
		const pages: { page_number: number; text: string }[] = [];
		let totalTextLength = 0;

		for (let i = 1; i <= pageCount; i++) {
			const page = await pdf.getPage(i);
			const textContent = await page.getTextContent();
			const text = textContent.items
				.map((item: any) => item.str)
				.join(' ')
				.replace(/\s+/g, ' ')
				.trim();

			pages.push({ page_number: i, text });
			totalTextLength += text.length;

			onProgress?.({
				stage: 'extracting',
				progress: 30 + (i / pageCount) * 40,
				message: `Extracted page ${i}/${pageCount}...`
			});
		}

		// Check text density
		const avgTextDensity = totalTextLength / pageCount;
		if (avgTextDensity < TEXT_DENSITY_THRESHOLD) {
			// Reject scanned PDF
			await supabase.storage.from('documents').remove([storagePath]);
			throw new Error('Scanned PDF detected. This document does not have a text layer and cannot be ingested.');
		}

		// 3. Parsing Outline
		onProgress?.({ stage: 'parsing', progress: 80, message: 'Parsing document outline...' });
		const { outline } = await loadDocumentOutline(pdf);

		// 4. Committing to DB
		onProgress?.({ stage: 'committing', progress: 90, message: 'Finalizing ingestion...' });
		
		// Use the ingest_document RPC for transactional insert
		const { data: documentId, error: rpcError } = await supabase.rpc('ingest_document', {
			p_title: file.name,
			p_page_count: pageCount,
			p_has_text_layer: true,
			p_outline: outline || [],
			p_storage_path: storagePath,
			p_pages: pages
		});

		if (rpcError) {
			// Cleanup storage on DB failure
			await supabase.storage.from('documents').remove([storagePath]);
			throw rpcError;
		}

		onProgress?.({ stage: 'ready', progress: 100, message: 'Document is ready!' });
		
		return { documentId, pageCount, title: file.name };
	} catch (error) {
		console.error('Ingestion failed:', error);
		onProgress?.({
			stage: 'error',
			progress: 0,
			message: error instanceof Error ? error.message : 'Unknown error occurred'
		});
		throw error;
	}
}
