import { describe, expect, it } from 'vitest';

import { applyHighlightSelection } from './highlight-selection';

describe('applyHighlightSelection', () => {
	it('selects the requested highlight and opens the sidebar', () => {
		expect(
			applyHighlightSelection({ selectedHighlightId: null, sidebarOpen: false }, 'hl-1')
		).toEqual({
			selectedHighlightId: 'hl-1',
			sidebarOpen: true
		});
	});

	it('keeps the same highlight selected on repeated selection instead of collapsing it', () => {
		expect(
			applyHighlightSelection({ selectedHighlightId: 'hl-1', sidebarOpen: true }, 'hl-1')
		).toEqual({
			selectedHighlightId: 'hl-1',
			sidebarOpen: true
		});
	});
});
