import { describe, expect, it } from 'vitest';
import {
	DEFAULT_COMMENT_EDITOR_PLACEMENT_HEIGHT,
	getTipPosition
} from './tip-positioning';

describe('getTipPosition', () => {
	const baseArgs = {
		highlightRect: {
			left: 100,
			top: 200,
			width: 80,
			height: 20
		},
		pageOffset: {
			left: 40,
			top: 300
		},
		containerScroll: {
			left: 0,
			top: 0
		},
		containerSize: {
			width: 400,
			height: 600
		},
		popupSize: {
			width: 120,
			height: 80
		}
	};

	it('places the popup above when there is enough room above', () => {
		const result = getTipPosition({
			...baseArgs,
			isNewSelection: false
		});

		expect(result.top).toBe(415);
	});

	it('places the popup below when the space above does not fit', () => {
		const result = getTipPosition({
			...baseArgs,
			containerScroll: { left: 0, top: 450 },
			isNewSelection: false
		});

		expect(result.top).toBe(525);
	});

	it('chooses the side nearest the entry point when both directions fit', () => {
		const above = getTipPosition({
			...baseArgs,
			entryPoint: { x: 160, y: 505 },
			isNewSelection: false
		});
		const below = getTipPosition({
			...baseArgs,
			entryPoint: { x: 160, y: 518 },
			isNewSelection: false
		});

		expect(above.top).toBe(415);
		expect(below.top).toBe(525);
	});

	it('defaults consistently when neither side fully fits', () => {
		const result = getTipPosition({
			...baseArgs,
			containerScroll: { left: 0, top: 450 },
			containerSize: { width: 400, height: 100 },
			isNewSelection: false
		});

		expect(result.top).toBe(525);
	});

	it('uses the inflated editor placement height for existing hover side decisions', () => {
		const result = getTipPosition({
			...baseArgs,
			containerScroll: { left: 0, top: 385 },
			containerSize: { width: 400, height: 160 },
			isNewSelection: false,
			useCommentEditorPlacement: true
		});

		expect(DEFAULT_COMMENT_EDITOR_PLACEMENT_HEIGHT).toBeGreaterThan(baseArgs.popupSize.height);
		expect(result.top).toBe(525);
	});

	it('uses the measured popup height for the final top position', () => {
		const result = getTipPosition({
			...baseArgs,
			containerScroll: { left: 0, top: 0 },
			containerSize: { width: 400, height: 420 },
			isNewSelection: false
		});

		expect(result.top).toBe(415);
	});

	it('uses a zero gap for new selections and five pixels for existing highlights', () => {
		const existing = getTipPosition({
			...baseArgs,
			containerSize: { width: 400, height: 420 },
			isNewSelection: false
		});
		const freshSelection = getTipPosition({
			...baseArgs,
			containerSize: { width: 400, height: 420 },
			isNewSelection: true
		});

		expect(existing.top).toBe(415);
		expect(freshSelection.top).toBe(420);
	});

	it('clamps horizontally to the visible container with the trailing 20px margin', () => {
		const leftClamped = getTipPosition({
			...baseArgs,
			containerScroll: { left: 10, top: 0 },
			containerSize: { width: 240, height: 600 },
			entryPoint: { x: -500, y: 510 },
			isNewSelection: false
		});
		const rightClamped = getTipPosition({
			...baseArgs,
			containerScroll: { left: 10, top: 0 },
			containerSize: { width: 240, height: 600 },
			entryPoint: { x: 500, y: 510 },
			isNewSelection: false
		});

		expect(leftClamped.left).toBe(80);
		expect(rightClamped.left).toBe(110);
	});
});
