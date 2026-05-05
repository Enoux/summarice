import { describe, expect, it } from 'vitest';
import type { LTWHP } from '../types';
import trimClientRectsToText from './trim-client-rects-to-text';

type RectLike = Pick<DOMRect, 'left' | 'top' | 'right' | 'bottom' | 'width' | 'height'>;

function makeDomRect({ left, top, width, height }: Omit<LTWHP, 'pageNumber'>): RectLike {
	return {
		left,
		top,
		width,
		height,
		right: left + width,
		bottom: top + height
	};
}

function makePage(pageRect: RectLike) {
	return {
		scrollTop: 0,
		scrollLeft: 0,
		getBoundingClientRect: () => pageRect
	} as HTMLElement;
}

function makeSpanRects(...rects: RectLike[]) {
	return {
		getClientRects: () => rects
	} as unknown as Element;
}

function makeTextLayer(spans: Element[]) {
	return {
		querySelectorAll: (selector: string) => (selector === 'span' ? spans : [])
	} as unknown as HTMLElement;
}

describe('trimClientRectsToText', () => {
	const pageRect = makeDomRect({ left: 0, top: 0, width: 800, height: 1000 });

	it('trims trailing whitespace against text spans', () => {
		const rects: LTWHP[] = [{ left: 100, top: 50, width: 140, height: 16, pageNumber: 1 }];
		const textLayer = makeTextLayer([makeSpanRects(makeDomRect({ left: 100, top: 50, width: 110, height: 16 }))]);

		expect(trimClientRectsToText(rects, makePage(pageRect), textLayer)).toEqual([
			{ left: 100, top: 50, width: 110, height: 16, pageNumber: 1 }
		]);
	});

	it('trims leading whitespace against text spans', () => {
		const rects: LTWHP[] = [{ left: 80, top: 50, width: 130, height: 16, pageNumber: 1 }];
		const textLayer = makeTextLayer([makeSpanRects(makeDomRect({ left: 100, top: 50, width: 110, height: 16 }))]);

		expect(trimClientRectsToText(rects, makePage(pageRect), textLayer)).toEqual([
			{ left: 100, top: 50, width: 110, height: 16, pageNumber: 1 }
		]);
	});

	it('trims each visual line independently', () => {
		const rects: LTWHP[] = [
			{ left: 90, top: 50, width: 130, height: 16, pageNumber: 1 },
			{ left: 120, top: 72, width: 150, height: 16, pageNumber: 1 }
		];
		const textLayer = makeTextLayer([
			makeSpanRects(makeDomRect({ left: 100, top: 50, width: 100, height: 16 })),
			makeSpanRects(makeDomRect({ left: 130, top: 72, width: 120, height: 16 }))
		]);

		expect(trimClientRectsToText(rects, makePage(pageRect), textLayer)).toEqual([
			{ left: 100, top: 50, width: 100, height: 16, pageNumber: 1 },
			{ left: 130, top: 72, width: 120, height: 16, pageNumber: 1 }
		]);
	});

	it('preserves internal spaces between matched spans', () => {
		const rects: LTWHP[] = [{ left: 100, top: 50, width: 90, height: 16, pageNumber: 1 }];
		const textLayer = makeTextLayer([
			makeSpanRects(makeDomRect({ left: 100, top: 50, width: 30, height: 16 })),
			makeSpanRects(makeDomRect({ left: 150, top: 50, width: 40, height: 16 }))
		]);

		expect(trimClientRectsToText(rects, makePage(pageRect), textLayer)).toEqual(rects);
	});

	it('returns original rects when no matching span geometry exists', () => {
		const rects: LTWHP[] = [{ left: 100, top: 50, width: 90, height: 16, pageNumber: 1 }];

		expect(trimClientRectsToText(rects, makePage(pageRect), makeTextLayer([]))).toEqual(rects);
		expect(
			trimClientRectsToText(
				rects,
				makePage(pageRect),
				makeTextLayer([makeSpanRects(makeDomRect({ left: 100, top: 120, width: 90, height: 16 }))])
			)
		).toEqual(rects);
	});

	it('drops only effectively empty trimmed rects', () => {
		const rects: LTWHP[] = [{ left: 100, top: 50, width: 8, height: 16, pageNumber: 1 }];
		const textLayer = makeTextLayer([makeSpanRects(makeDomRect({ left: 107.5, top: 50, width: 0.2, height: 16 }))]);

		expect(trimClientRectsToText(rects, makePage(pageRect), textLayer)).toEqual([]);
	});
});
