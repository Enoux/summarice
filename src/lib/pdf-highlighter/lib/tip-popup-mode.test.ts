import { describe, expect, it } from 'vitest';
import { getTipPopupMode } from './tip-popup-mode';
import type {
	Highlight,
	HighlightAdjustmentDraft,
	HighlightPopupActionState
} from '$lib/pdf-highlighter/types';

describe('getTipPopupMode', () => {
	it('returns hidden when there is no active highlight', () => {
		expect(getTipPopupMode({ pinned: false })).toBe('hidden');
	});

	it('returns new-selection for an unpersisted selection', () => {
		const activeHighlight: Highlight = { content: { text: 'Selected text' } };

		expect(getTipPopupMode({ activeHighlight, pinned: false })).toBe('new-selection');
	});

	it('prioritizes adjust-highlight when the draft targets the active highlight', () => {
		const activeHighlight: Highlight = { id: 'hl-1', content: { text: 'Saved' } };
		const adjustmentDraft: HighlightAdjustmentDraft = {
			highlightId: 'hl-1',
			originalPosition: {
				boundingRect: { x1: 0, y1: 0, x2: 1, y2: 1, width: 1, height: 1, pageNumber: 1 },
				rects: []
			},
			position: {
				boundingRect: { x1: 0, y1: 0, x2: 1, y2: 1, width: 1, height: 1, pageNumber: 1 },
				rects: []
			}
		};
		const actionState: HighlightPopupActionState = {
			pendingReExplainHighlightId: 'hl-1'
		};

		expect(getTipPopupMode({ activeHighlight, pinned: true, adjustmentDraft, actionState })).toBe(
			'adjust-highlight'
		);
	});

	it('returns confirm-reexplain before the normal existing highlight modes', () => {
		const activeHighlight: Highlight = { id: 'hl-1', content: { text: 'Saved' } };
		const actionState: HighlightPopupActionState = {
			pendingReExplainHighlightId: 'hl-1'
		};

		expect(getTipPopupMode({ activeHighlight, pinned: false, actionState })).toBe(
			'confirm-reexplain'
		);
		expect(getTipPopupMode({ activeHighlight, pinned: true, actionState })).toBe(
			'confirm-reexplain'
		);
	});

	it('returns existing-hover for unpinned existing highlights', () => {
		const activeHighlight: Highlight = { id: 'hl-1', content: { text: 'Saved' } };

		expect(getTipPopupMode({ activeHighlight, pinned: false })).toBe('existing-hover');
	});

	it('returns existing-edit for pinned existing highlights', () => {
		const activeHighlight: Highlight = { id: 'hl-1', content: { text: 'Saved' } };

		expect(getTipPopupMode({ activeHighlight, pinned: true })).toBe('existing-edit');
	});
});
