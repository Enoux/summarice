import { describe, expect, it } from 'vitest';
import {
	DEFAULT_SLOT_HEX,
	LIGHT_HIGHLIGHT_SLOT_HEX,
	canonicalHighlightPalette,
	resolveHighlightColor,
	resolveHighlightPalette
} from './highlight-categories';

describe('highlight categories color authority', () => {
	it('keeps the light palette exactly unchanged', () => {
		expect(LIGHT_HIGHLIGHT_SLOT_HEX).toEqual(DEFAULT_SLOT_HEX);
		expect(canonicalHighlightPalette()).toEqual([
			'#facc15',
			'#22c55e',
			'#3b82f6',
			'#ec4899',
			'#f97316'
		]);
		expect(resolveHighlightPalette('light')).toEqual(canonicalHighlightPalette());
	});

	it('derives the expected dark semantic palette', () => {
		expect(resolveHighlightPalette('dark')).toEqual([
			'#f3ce56',
			'#4fc06d',
			'#4c85e3',
			'#de5c98',
			'#eb7e42'
		]);
	});

	it('returns canonical light colors unchanged in light mode', () => {
		expect(resolveHighlightColor('#facc15', 'light')).toBe('#facc15');
	});

	it('derives canonical colors for dark mode', () => {
		expect(resolveHighlightColor('#facc15', 'dark')).toBe('#f3ce56');
	});

	it('accepts decorative custom hex colors and transforms them in dark mode', () => {
		expect(resolveHighlightColor('#8b5cf6', 'dark')).toMatch(/^#[0-9a-f]{6}$/);
		expect(resolveHighlightColor('#8b5cf6', 'dark')).not.toBe('#8b5cf6');
	});

	it('returns unsupported colors unchanged', () => {
		expect(resolveHighlightColor('rgb(255, 0, 0)', 'dark')).toBe('rgb(255, 0, 0)');
		expect(resolveHighlightColor('#xyzxyz', 'dark')).toBe('#xyzxyz');
	});
});
