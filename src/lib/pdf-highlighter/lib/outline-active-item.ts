import type { ProcessedOutlineItem } from '../types';

export type OutlineViewLocation = {
	pageNumber: number;
	top: number;
	left: number;
};

/** Reading line sits this many CSS px below the viewport top. */
export const OUTLINE_READING_LINE_OFFSET_PX = 48;

const PDF_TO_CSS_UNITS = 96 / 72;

/** Convert CSS pixels to PDF user-space units for a page at the given viewport scale. */
export function cssPxToPdfUnits(cssPx: number, pageScale: number): number {
	if (pageScale <= 0) {
		return 0;
	}
	return cssPx / (pageScale * PDF_TO_CSS_UNITS);
}

/** PDF user-space Y used when a bookmark has no vertical destination (page-top). */
const PAGE_TOP_PDF_Y = Number.MAX_VALUE;

export type ResolveActiveOutlineItemOptions = {
	viewLocation: OutlineViewLocation;
	/** Reading-line offset converted from CSS px to PDF user-space units. */
	readingOffsetPdf: number;
	pinnedId?: string | null;
};

function itemPdfY(item: ProcessedOutlineItem): number {
	return item.pdfTop ?? PAGE_TOP_PDF_Y;
}

function isItemAtOrAboveReadingLine(
	item: ProcessedOutlineItem,
	viewLocation: OutlineViewLocation,
	readingLineTop: number
): boolean {
	if (item.pageNumber < viewLocation.pageNumber) {
		return true;
	}
	if (item.pageNumber > viewLocation.pageNumber) {
		return false;
	}
	return itemPdfY(item) >= readingLineTop;
}

/**
 * Scroll-spy: last outline item whose bookmark destination is at or above the reading line.
 */
export function resolveActiveOutlineItem(
	flat: ProcessedOutlineItem[],
	options: ResolveActiveOutlineItemOptions
): ProcessedOutlineItem | null {
	if (flat.length === 0) {
		return null;
	}

	const { viewLocation, readingOffsetPdf, pinnedId } = options;

	if (pinnedId) {
		const pinned = flat.find((item) => item.id === pinnedId);
		if (pinned) {
			return pinned;
		}
	}

	const readingLineTop = viewLocation.top - readingOffsetPdf;

	let active: ProcessedOutlineItem | null = null;
	for (const item of flat) {
		if (isItemAtOrAboveReadingLine(item, viewLocation, readingLineTop)) {
			active = item;
		}
	}

	return active ?? flat[0] ?? null;
}
