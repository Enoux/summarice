import { describe, expect, it } from 'vitest';
import { liteParseResultToPages } from './liteparse-pages';

describe('liteParseResultToPages', () => {
	it('converts LiteParse output into upload pages with normalized per-page text', () => {
		const pages = liteParseResultToPages({
			pages: [
				{
					pageNum: 1,
					width: 612,
					height: 792,
					text: '  Alpha\n\nBeta   gamma  ',
					textItems: []
				},
				{
					pageNum: 2,
					width: 612,
					height: 792,
					text: '\nDelta\t epsilon ',
					textItems: []
				}
			]
		});

		expect(pages).toEqual([
			{
				page_number: 1,
				text: 'Alpha Beta gamma',
				layout: {
					width: 612,
					height: 792,
					textItems: []
				}
			},
			{
				page_number: 2,
				text: 'Delta epsilon',
				layout: {
					width: 612,
					height: 792,
					textItems: []
				}
			}
		]);
	});

	it('persists LiteParse layout boxes for each page', () => {
		const pages = liteParseResultToPages({
			pages: [
				{
					pageNum: 3,
					width: 500,
					height: 700,
					text: 'Key idea',
					textItems: [
						{
							text: 'Key',
							x: 72,
							y: 120,
							width: 24,
							height: 10,
							fontName: 'Times-Roman',
							fontSize: 11
						},
						{
							text: 'idea',
							x: 102,
							y: 120,
							width: 28,
							height: 10,
							confidence: 0.98
						}
					]
				}
			]
		});

		expect(pages[0]?.layout).toEqual({
			width: 500,
			height: 700,
			textItems: [
				{
					text: 'Key',
					x: 72,
					y: 120,
					width: 24,
					height: 10,
					fontName: 'Times-Roman',
					fontSize: 11
				},
				{
					text: 'idea',
					x: 102,
					y: 120,
					width: 28,
					height: 10,
					confidence: 0.98
				}
			]
		});
	});
});
