import { describe, expect, it } from 'vitest';
import { refineHighlightText } from './highlight-text-refiner';

describe('refineHighlightText', () => {
	it('selects intersecting LiteParse boxes and joins them in reading order', () => {
		const result = refineHighlightText({
			provisionalText: 'Alpha Beta',
			position: {
				boundingRect: {
					x1: 95,
					y1: 96,
					x2: 210,
					y2: 116,
					width: 612,
					height: 792,
					pageNumber: 1
				},
				rects: [
					{
						x1: 95,
						y1: 96,
						x2: 145,
						y2: 116,
						width: 612,
						height: 792,
						pageNumber: 1
					},
					{
						x1: 150,
						y1: 96,
						x2: 210,
						y2: 116,
						width: 612,
						height: 792,
						pageNumber: 1
					}
				]
			},
			layout: {
				width: 612,
				height: 792,
				textItems: [
					{ text: 'Beta', x: 150, y: 100, width: 30, height: 10 },
					{ text: 'Alpha', x: 100, y: 100, width: 35, height: 10 },
					{ text: 'Gamma', x: 320, y: 200, width: 45, height: 10 }
				]
			}
		});

		expect(result).toEqual({
			text: 'Alpha Beta',
			text_status: 'refined'
		});
	});

	it('falls back to the provisional selection when layout matching is too weak', () => {
		const result = refineHighlightText({
			provisionalText: 'Fallback text',
			position: {
				boundingRect: {
					x1: 10,
					y1: 10,
					x2: 40,
					y2: 20,
					width: 612,
					height: 792,
					pageNumber: 1
				},
				rects: []
			},
			layout: {
				width: 612,
				height: 792,
				textItems: [{ text: 'Far away', x: 300, y: 400, width: 60, height: 10 }]
			}
		});

		expect(result).toEqual({
			text: 'Fallback text',
			text_status: 'fallback'
		});
	});
});
