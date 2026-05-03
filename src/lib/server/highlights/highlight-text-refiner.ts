import type { Scaled, ScaledPosition } from '$lib/pdf-highlighter/types';
import type { StoredPageLayout } from '$lib/server/ingestion/liteparse-pages';

export type HighlightTextStatus = 'provisional' | 'refined' | 'fallback';

type Rect = { x1: number; y1: number; x2: number; y2: number };

function scaledToPageRect(rect: Scaled, layout: StoredPageLayout): Rect {
	const width = rect.width || layout.width;
	const height = rect.height || layout.height;

	return {
		x1: (rect.x1 / width) * layout.width,
		y1: (rect.y1 / height) * layout.height,
		x2: (rect.x2 / width) * layout.width,
		y2: (rect.y2 / height) * layout.height
	};
}

function rectIntersectionArea(a: Rect, b: Rect) {
	const xOverlap = Math.max(0, Math.min(a.x2, b.x2) - Math.max(a.x1, b.x1));
	const yOverlap = Math.max(0, Math.min(a.y2, b.y2) - Math.max(a.y1, b.y1));
	return xOverlap * yOverlap;
}

function normalizeExcerpt(text: string) {
	return text
		.replace(/\s+([,.;:!?])/g, '$1')
		.replace(/([(\[])\s+/g, '$1')
		.replace(/\s+/g, ' ')
		.trim();
}

export function refineHighlightText(opts: {
	provisionalText: string;
	position: ScaledPosition;
	layout: StoredPageLayout | null | undefined;
}): { text: string; text_status: Exclude<HighlightTextStatus, 'provisional'> } {
	const { provisionalText, position, layout } = opts;
	if (!layout) {
		return { text: provisionalText, text_status: 'fallback' };
	}

	const selectionRects = (position.rects?.length ? position.rects : [position.boundingRect]).map((rect) =>
		scaledToPageRect(rect, layout)
	);

	const matches = layout.textItems
		.map((item) => {
			const itemRect = {
				x1: item.x,
				y1: item.y,
				x2: item.x + item.width,
				y2: item.y + item.height
			};
			const overlap = selectionRects.reduce(
				(max, selectionRect) => Math.max(max, rectIntersectionArea(selectionRect, itemRect)),
				0
			);
			const area = Math.max(item.width * item.height, 1);
			return { item, overlapRatio: overlap / area };
		})
		.filter(({ item, overlapRatio }) => overlapRatio >= 0.2 && item.text.trim().length > 0)
		.sort((a, b) => {
			const rowDelta = Math.abs(a.item.y - b.item.y);
			if (rowDelta > 4) return a.item.y - b.item.y;
			return a.item.x - b.item.x;
		});

	if (matches.length === 0) {
		return { text: provisionalText, text_status: 'fallback' };
	}

	return {
		text: normalizeExcerpt(matches.map(({ item }) => item.text).join(' ')),
		text_status: 'refined'
	};
}
