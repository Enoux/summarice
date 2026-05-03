import { describe, expect, it } from 'vitest';
import { HighlightsModel } from '$lib/pdf-highlighter';
import type { CommentedHighlight } from '$lib/pdf-highlighter/types';
import {
	applyPersistedHighlight,
	buildOptimisticHighlight,
	type PersistedHighlightResponse
} from './highlight-client';

describe('highlight client helpers', () => {
	it('creates optimistic highlights immediately with provisional text state', () => {
		const store = new HighlightsModel<CommentedHighlight>([]);
		const optimistic = buildOptimisticHighlight(
			{
				type: 'text',
				content: { text: 'Selected from PDF.js' },
				position: {
					boundingRect: {
						x1: 10,
						y1: 10,
						x2: 30,
						y2: 20,
						width: 612,
						height: 792,
						pageNumber: 1
					},
					rects: []
				},
				color_index: 0
			},
			{
				id: 'hl-1',
				ordinal: 1,
				decorative: false,
				colorHex: '#ffcc00'
			}
		);

		store.addHighlight(optimistic);

		expect(store.getHighlightById('hl-1')).toMatchObject({
			id: 'hl-1',
			content: { text: 'Selected from PDF.js' },
			text_status: 'provisional'
		});
	});

	it('updates the existing sidebar excerpt in place when refined text comes back', () => {
		const store = new HighlightsModel<CommentedHighlight>([
			buildOptimisticHighlight(
				{
					id: 'hl-2',
					type: 'text',
					content: { text: 'Original selection' },
					position: {
						boundingRect: {
							x1: 10,
							y1: 10,
							x2: 30,
							y2: 20,
							width: 612,
							height: 792,
							pageNumber: 1
						},
						rects: []
					},
					color_index: 0
				},
				{
					id: 'hl-2',
					ordinal: 2,
					decorative: false,
					colorHex: '#ffcc00'
				}
			)
		]);
		const persisted: PersistedHighlightResponse = {
			id: 'hl-2',
			type: 'text',
			content: { text: 'Refined excerpt from LiteParse' },
			position: {
				boundingRect: {
					x1: 10,
					y1: 10,
					x2: 30,
					y2: 20,
					width: 612,
					height: 792,
					pageNumber: 1
				},
				rects: []
			},
			ordinal: 2,
			color_index: 0,
			display_color: '#ffcc00',
			text_status: 'refined',
			annotations: []
		};

		applyPersistedHighlight(store, persisted);

		expect(store.getHighlightById('hl-2')).toMatchObject({
			id: 'hl-2',
			content: { text: 'Refined excerpt from LiteParse' },
			text_status: 'refined'
		});
	});
});
