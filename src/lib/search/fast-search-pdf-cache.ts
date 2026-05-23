import { GlobalWorkerOptions, getDocument } from 'pdfjs-dist';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import pdfWorkerUrl from '$lib/pdf-worker-url';
import { renderPageThumbnail } from '$lib/pdf-highlighter/hooks/thumbnails';
import type { ThumbnailData } from '$lib/pdf-highlighter/types';

export const FAST_SEARCH_PREVIEW_RENDER_WIDTH = 420;
export const FAST_SEARCH_PREVIEW_IMAGE_QUALITY = 0.9;
const MAX_CACHED_PDF_DOCUMENTS = 4;

let workerInitialized = false;
const pdfUrlByDocumentId = new Map<string, string>();
const pdfUrlInFlight = new Map<string, Promise<string>>();
const pdfDocuments = new Map<string, PDFDocumentProxy>();
const pdfDocumentInFlight = new Map<string, Promise<PDFDocumentProxy>>();
const pdfAccessOrder: string[] = [];

function ensurePdfWorkerInitialized(): void {
	if (workerInitialized) {
		return;
	}
	GlobalWorkerOptions.workerSrc = pdfWorkerUrl;
	workerInitialized = true;
}

function touchDocumentAccess(documentId: string): void {
	const existingIndex = pdfAccessOrder.indexOf(documentId);
	if (existingIndex >= 0) {
		pdfAccessOrder.splice(existingIndex, 1);
	}
	pdfAccessOrder.push(documentId);

	while (pdfAccessOrder.length > MAX_CACHED_PDF_DOCUMENTS) {
		const evictId = pdfAccessOrder.shift();
		if (!evictId) {
			break;
		}
		const evicted = pdfDocuments.get(evictId);
		pdfDocuments.delete(evictId);
		pdfUrlByDocumentId.delete(evictId);
		if (evicted) {
			void evicted.destroy();
		}
	}
}

async function fetchDocumentPdfUrl(documentId: string): Promise<string> {
	const cached = pdfUrlByDocumentId.get(documentId);
	if (cached) {
		return cached;
	}

	const inFlight = pdfUrlInFlight.get(documentId);
	if (inFlight) {
		return inFlight;
	}

	const request = fetch(`/documents/${documentId}/pdf-url`).then(async (response) => {
		const payload = (await response.json()) as { pdfUrl?: string; message?: string };
		if (!response.ok || !payload.pdfUrl) {
			throw new Error(
				payload.message ?? `Failed to fetch PDF URL for document ${documentId} (${response.status})`
			);
		}
		pdfUrlByDocumentId.set(documentId, payload.pdfUrl);
		return payload.pdfUrl;
	});

	pdfUrlInFlight.set(documentId, request);
	try {
		return await request;
	} finally {
		pdfUrlInFlight.delete(documentId);
	}
}

async function loadPdfDocument(documentId: string): Promise<PDFDocumentProxy> {
	const cached = pdfDocuments.get(documentId);
	if (cached) {
		touchDocumentAccess(documentId);
		return cached;
	}

	const inFlight = pdfDocumentInFlight.get(documentId);
	if (inFlight) {
		return inFlight;
	}

	ensurePdfWorkerInitialized();

	const loadPromise = fetchDocumentPdfUrl(documentId).then(async (pdfUrl) => {
		const loadingTask = getDocument(pdfUrl);
		const pdfDocument = await loadingTask.promise;
		pdfDocuments.set(documentId, pdfDocument);
		touchDocumentAccess(documentId);
		return pdfDocument;
	});

	pdfDocumentInFlight.set(documentId, loadPromise);
	try {
		return await loadPromise;
	} finally {
		pdfDocumentInFlight.delete(documentId);
	}
}

export async function loadFastSearchPageThumbnail(
	documentId: string,
	pageNumber: number
): Promise<ThumbnailData> {
	const pdfDocument = await loadPdfDocument(documentId);
	return renderPageThumbnail(
		pdfDocument,
		pageNumber,
		FAST_SEARCH_PREVIEW_RENDER_WIDTH,
		FAST_SEARCH_PREVIEW_IMAGE_QUALITY
	);
}
