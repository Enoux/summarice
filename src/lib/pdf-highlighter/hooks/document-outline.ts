import type { PDFDocumentProxy } from 'pdfjs-dist';
import type { PdfOutlineItemRaw, ProcessedOutlineItem } from '../types';

async function processOutlineItems(
	pdfDocument: PDFDocumentProxy,
	items: PdfOutlineItemRaw[],
	level: number
): Promise<ProcessedOutlineItem[]> {
	const processed: ProcessedOutlineItem[] = [];

	for (let i = 0; i < items.length; i++) {
		const item = items[i];
		if (!item) continue;
		let pageNumber = 1;

		if (item.dest) {
			try {
				const dest =
					typeof item.dest === 'string' ? await pdfDocument.getDestination(item.dest) : item.dest;

				if (dest && Array.isArray(dest) && dest[0]) {
					// PDF.js destination ref — typed loosely across versions
					const pageIndex = await pdfDocument.getPageIndex(dest[0] as never);
					pageNumber = pageIndex + 1;
				}
			} catch {
				/* keep default */
			}
		}

		const children = item.items?.length
			? await processOutlineItems(pdfDocument, item.items, level + 1)
			: [];

		processed.push({
			id: `outline-${level}-${i}`,
			title: item.title,
			pageNumber,
			dest: item.dest,
			level,
			bold: item.bold,
			italic: item.italic,
			children
		});
	}

	return processed;
}

export function flattenOutline(items: ProcessedOutlineItem[]): ProcessedOutlineItem[] {
	const result: ProcessedOutlineItem[] = [];
	for (const item of items) {
		result.push(item);
		if (item.children.length) {
			result.push(...flattenOutline(item.children));
		}
	}
	return result;
}

export async function loadDocumentOutline(
	pdfDocument: PDFDocumentProxy
): Promise<{ outline: ProcessedOutlineItem[]; error: Error | null }> {
	try {
		const rawOutline = await pdfDocument.getOutline();
		if (!rawOutline || rawOutline.length === 0) {
			return { outline: [], error: null };
		}
		const outline = await processOutlineItems(pdfDocument, rawOutline as PdfOutlineItemRaw[], 0);
		return { outline, error: null };
	} catch (e) {
		return {
			outline: [],
			error: e instanceof Error ? e : new Error('Failed to load outline')
		};
	}
}
