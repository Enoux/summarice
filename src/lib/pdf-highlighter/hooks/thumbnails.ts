import type { PDFDocumentProxy } from 'pdfjs-dist';
import type { ThumbnailData } from '../types';

const CACHE_SIZE = 40;
const MAX_CONCURRENT_RENDERS = 2;

type CachedThumbnail = Omit<ThumbnailData, 'isLoading'>;
type RenderTask = {
	run: () => Promise<ThumbnailData>;
	resolve: (value: ThumbnailData) => void;
	reject: (reason?: unknown) => void;
};

let activeRenders = 0;
const renderQueue: RenderTask[] = [];

const thumbnailCache = new WeakMap<PDFDocumentProxy, Map<string, CachedThumbnail>>();
const inFlightRenders = new WeakMap<PDFDocumentProxy, Map<string, Promise<ThumbnailData>>>();

function getCacheKey(pageNumber: number, thumbnailWidth: number, imageQuality: number): string {
	return `${pageNumber}:${thumbnailWidth}:${imageQuality}`;
}

function getDocumentCache(pdfDocument: PDFDocumentProxy): Map<string, CachedThumbnail> {
	const existing = thumbnailCache.get(pdfDocument);
	if (existing) return existing;
	const next = new Map<string, CachedThumbnail>();
	thumbnailCache.set(pdfDocument, next);
	return next;
}

function getInFlightMap(pdfDocument: PDFDocumentProxy): Map<string, Promise<ThumbnailData>> {
	const existing = inFlightRenders.get(pdfDocument);
	if (existing) return existing;
	const next = new Map<string, Promise<ThumbnailData>>();
	inFlightRenders.set(pdfDocument, next);
	return next;
}

function updateLru(
	cache: Map<string, CachedThumbnail>,
	cacheKey: string,
	thumbnail: CachedThumbnail
): void {
	if (cache.has(cacheKey)) {
		cache.delete(cacheKey);
	}
	cache.set(cacheKey, thumbnail);
	while (cache.size > CACHE_SIZE) {
		const oldest = cache.keys().next().value;
		if (!oldest) break;
		cache.delete(oldest);
	}
}

function drainQueue(): void {
	while (activeRenders < MAX_CONCURRENT_RENDERS && renderQueue.length > 0) {
		const task = renderQueue.shift();
		if (!task) return;
		activeRenders += 1;
		void task
			.run()
			.then(task.resolve)
			.catch(task.reject)
			.finally(() => {
				activeRenders -= 1;
				drainQueue();
			});
	}
}

function enqueueRender(run: () => Promise<ThumbnailData>): Promise<ThumbnailData> {
	return new Promise<ThumbnailData>((resolve, reject) => {
		renderQueue.push({ run, resolve, reject });
		drainQueue();
	});
}

export async function renderPageThumbnail(
	pdfDocument: PDFDocumentProxy,
	pageNumber: number,
	thumbnailWidth = 200,
	imageQuality = 0.8
): Promise<ThumbnailData> {
	const cacheKey = getCacheKey(pageNumber, thumbnailWidth, imageQuality);
	const cache = getDocumentCache(pdfDocument);
	const cached = cache.get(cacheKey);
	if (cached) {
		updateLru(cache, cacheKey, cached);
		return { ...cached, isLoading: false };
	}

	const inFlight = getInFlightMap(pdfDocument);
	const existingRender = inFlight.get(cacheKey);
	if (existingRender) {
		return existingRender;
	}

	const renderPromise = enqueueRender(async () => {
		try {
			const page = await pdfDocument.getPage(pageNumber);
			const viewport = page.getViewport({ scale: 1 });
			const scale = thumbnailWidth / viewport.width;
			const scaledViewport = page.getViewport({ scale });

			const canvas = document.createElement('canvas');
			canvas.width = scaledViewport.width;
			canvas.height = scaledViewport.height;
			const context = canvas.getContext('2d');
			if (!context) {
				return { pageNumber, dataUrl: null, isLoading: false, error: 'Canvas context unavailable' };
			}
			await page.render({ canvasContext: context, viewport: scaledViewport }).promise;
			const dataUrl = canvas.toDataURL('image/jpeg', imageQuality);
			canvas.width = 0;
			canvas.height = 0;
			const result: ThumbnailData = { pageNumber, dataUrl, isLoading: false };
			updateLru(cache, cacheKey, { pageNumber, dataUrl, error: result.error });
			return result;
		} catch (error) {
			return {
				pageNumber,
				dataUrl: null,
				isLoading: false,
				error: error instanceof Error ? error.message : 'Failed to load'
			};
		}
	});
	inFlight.set(cacheKey, renderPromise);
	return renderPromise.finally(() => {
		inFlight.delete(cacheKey);
	});
}
