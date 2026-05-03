import { loadDocumentOutline } from '$lib/pdf-highlighter/hooks/document-outline';

export async function extractPdfOutline(bytes: Uint8Array) {
	const { getDocument } = await import('pdfjs-dist/legacy/build/pdf.mjs');
	const loadingTask = getDocument({
		data: bytes,
		disableWorker: true
	} as never);
	const pdf = await loadingTask.promise;
	const { outline } = await loadDocumentOutline(pdf as never);
	return outline ?? [];
}
