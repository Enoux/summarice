import { describe, expect, it } from 'vitest';
import {
	buildHighlightPromptContext,
	formatHighlightPromptContextForModel
} from './highlight-prompt-context';

describe('buildHighlightPromptContext', () => {
	it('includes decorative hint when useColorsDecoratively is true', () => {
		const ctx = buildHighlightPromptContext({
			categoryLabels: { '1': 'Idea' },
			useColorsDecoratively: true
		});
		expect(ctx.decorativeColors).toBe(true);
		const text = formatHighlightPromptContextForModel(ctx);
		expect(text.toLowerCase()).toContain('decorative');
		expect(text.toLowerCase()).not.toContain('slot 1');
	});

	it('lists category slots when semantic mode', () => {
		const ctx = buildHighlightPromptContext({
			categoryLabels: {
				'1': 'Key idea',
				'2': 'Definition',
				'3': 'Evidence',
				'4': 'Question',
				'5': 'Contradiction'
			},
			useColorsDecoratively: false
		});
		expect(ctx.decorativeColors).toBe(false);
		if (!ctx.decorativeColors) {
			expect(ctx.categoryLines.length).toBe(5);
			expect(ctx.categoryLines[0]).toContain('Slot 1');
		}
		const text = formatHighlightPromptContextForModel(ctx);
		expect(text.toLowerCase()).toContain('category');
		expect(text).toContain('Slot 5');
	});
});
