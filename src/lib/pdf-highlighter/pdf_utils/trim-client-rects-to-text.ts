import type { LTWHP } from '../types';

type RectLike = Pick<DOMRect, 'left' | 'top' | 'right' | 'bottom' | 'width' | 'height'>;

const MIN_TRIMMED_WIDTH = 1;
const LINE_CENTER_TOLERANCE = 6;

function toPageRelativeRect(rect: RectLike, page: HTMLElement, pageNumber: number): LTWHP {
	const pageRect = page.getBoundingClientRect();

	return {
		left: rect.left + page.scrollLeft - pageRect.left,
		top: rect.top + page.scrollTop - pageRect.top,
		width: rect.width,
		height: rect.height,
		pageNumber
	};
}

function verticalOverlap(a: LTWHP, b: LTWHP): number {
	const top = Math.max(a.top, b.top);
	const bottom = Math.min(a.top + a.height, b.top + b.height);
	return Math.max(0, bottom - top);
}

function lineCenterDistance(a: LTWHP, b: LTWHP): number {
	return Math.abs(a.top + a.height / 2 - (b.top + b.height / 2));
}

function isSameVisualLine(rect: LTWHP, spanRect: LTWHP): boolean {
	if (rect.pageNumber !== spanRect.pageNumber) return false;
	if (verticalOverlap(rect, spanRect) > 0) return true;

	const tolerance = Math.max(
		LINE_CENTER_TOLERANCE,
		Math.min(rect.height, spanRect.height) / 2
	);
	return lineCenterDistance(rect, spanRect) <= tolerance;
}

function collectSpanRects(page: HTMLElement, textLayer: HTMLElement, pageNumber: number): LTWHP[] {
	return Array.from(textLayer.querySelectorAll('span')).flatMap((span) => {
		const clientRects = typeof span.getClientRects === 'function' ? Array.from(span.getClientRects()) : [];
		return clientRects
			.filter((rect) => rect.width > 0 && rect.height > 0)
			.map((rect) => toPageRelativeRect(rect, page, pageNumber));
	});
}

export default function trimClientRectsToText(
	rects: LTWHP[],
	page: HTMLElement | null | undefined,
	textLayer: HTMLElement | null | undefined
): LTWHP[] {
	if (!page || !textLayer || rects.length === 0) return rects;

	const pageNumber = rects[0]?.pageNumber;
	if (pageNumber == null) return rects;

	const spanRects = collectSpanRects(page, textLayer, pageNumber);
	if (spanRects.length === 0) return rects;

	return rects.flatMap((rect) => {
		const lineSpans = spanRects.filter((spanRect) => isSameVisualLine(rect, spanRect));
		if (lineSpans.length === 0) return [rect];

		const matchedLeft = Math.min(...lineSpans.map((spanRect) => spanRect.left));
		const matchedRight = Math.max(...lineSpans.map((spanRect) => spanRect.left + spanRect.width));
		const trimmedLeft = Math.max(rect.left, matchedLeft);
		const trimmedRight = Math.min(rect.left + rect.width, matchedRight);
		const trimmedWidth = trimmedRight - trimmedLeft;

		if (trimmedWidth < MIN_TRIMMED_WIDTH) return [];

		return [
			{
				...rect,
				left: trimmedLeft,
				width: trimmedWidth
			}
		];
	});
}
