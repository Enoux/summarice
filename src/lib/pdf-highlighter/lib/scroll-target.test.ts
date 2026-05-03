import { describe, expect, it } from 'vitest';
import { getHighlightScrollTarget, getHighlightScrollTargetState } from './scroll-target';

describe('getHighlightScrollTarget', () => {
	it('places the highlight 25% from the top of the PDF viewport', () => {
		const target = getHighlightScrollTarget({
			containerScrollTop: 1200,
			containerTop: 100,
			containerHeight: 800,
			pageTop: -300,
			highlightTop: 500
		});

		expect(target).toBe(1200 + (-300 - 100) + 500 - 800 * 0.25);
	});

	it('does not return a negative scroll target', () => {
		const target = getHighlightScrollTarget({
			containerScrollTop: 20,
			containerTop: 0,
			containerHeight: 800,
			pageTop: 0,
			highlightTop: 50
		});

		expect(target).toBe(0);
	});

	it('does not scroll when the highlight is already aligned', () => {
		const state = getHighlightScrollTargetState({
			containerScrollTop: 800,
			containerTop: 100,
			containerHeight: 800,
			pageTop: -300,
			highlightTop: 600
		});

		expect(state).toEqual({
			targetTop: 800,
			shouldScroll: false
		});
	});

	it('scrolls when the highlight is outside the alignment tolerance', () => {
		const state = getHighlightScrollTargetState({
			containerScrollTop: 797,
			containerTop: 100,
			containerHeight: 800,
			pageTop: -297,
			highlightTop: 600
		});

		expect(state).toEqual({
			targetTop: 800,
			shouldScroll: true
		});
	});

	it('clamps the target to the maximum scroll position', () => {
		const state = getHighlightScrollTargetState({
			containerScrollTop: 900,
			containerTop: 0,
			containerHeight: 800,
			pageTop: 0,
			highlightTop: 900,
			maxScrollTop: 1000
		});

		expect(state).toEqual({
			targetTop: 1000,
			shouldScroll: true
		});
	});
});
