import { describe, expect, it } from 'vitest';
import { HighlightsModel } from './HighlightsModel.svelte';
import type { CommentedHighlight } from './types';

const highlight = (id: string): CommentedHighlight => ({
	id,
	type: 'text',
	content: { text: id },
	position: {
		boundingRect: {
			x1: 0,
			y1: 0,
			x2: 10,
			y2: 10,
			width: 100,
			height: 100,
			pageNumber: 1
		},
		rects: []
	}
});

describe('HighlightsModel active tip interaction state', () => {
	it('blocks non-active highlight interaction while a tip is open', () => {
		const store = new HighlightsModel<CommentedHighlight>([highlight('a'), highlight('b')]);

		expect(store.isHighlightInteractionBlocked('b')).toBe(false);

		store.setActiveTipHighlightId('a', false);

		expect(store.hasActiveTip).toBe(true);
		expect(store.activeTipHighlightId).toBe('a');
		expect(store.isHighlightInteractionBlocked('a')).toBe(false);
		expect(store.isHighlightInteractionBlocked('b')).toBe(true);
	});

	it('does not let hover steal spotlight from a pinned comment editor', () => {
		const store = new HighlightsModel<CommentedHighlight>([highlight('a'), highlight('b')]);

		store.setActiveTipHighlightId('a', true);
		store.setHoveredHighlightId('b');

		expect(store.hoveredHighlightId).toBe('a');
		expect(store.activeTipPinned).toBe(true);
	});
});
