import { describe, expect, it } from 'vitest';
import { mergePdfHighlighterUtils } from './pdf-highlighter-utils-merge';

describe('mergePdfHighlighterUtils', () => {
	it('keeps fresh viewer-bound functions ahead of stale parent functions', () => {
		const staleScroll = () => 'stale';
		const freshScroll = () => 'fresh';

		const merged = mergePdfHighlighterUtils({
			baseUtils: {
				scrollToHighlight: freshScroll,
				currentScaleValue: 'auto'
			},
			incomingUtils: {
				scrollToHighlight: staleScroll,
				selectedTool: 'hand'
			}
		});

		expect(merged.scrollToHighlight).toBe(freshScroll);
		expect(merged.selectedTool).toBe('hand');
		expect(merged.currentScaleValue).toBe('auto');
	});
});
