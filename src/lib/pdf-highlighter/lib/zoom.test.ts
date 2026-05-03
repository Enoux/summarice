import { describe, expect, it } from 'vitest';
import {
	MAX_ZOOM_SCALE,
	MIN_ZOOM_SCALE,
	normalizeZoomScale,
	normalizeZoomValue,
	zoomOut,
	zoomIn
} from './zoom';

describe('zoom helpers', () => {
	it('clamps numeric zoom to the PDF viewer bounds', () => {
		expect(normalizeZoomScale(0.01)).toBe(MIN_ZOOM_SCALE);
		expect(normalizeZoomScale(10)).toBe(MAX_ZOOM_SCALE);
	});

	it('rounds numeric zoom to stable tenth increments', () => {
		expect(normalizeZoomScale(1.04)).toBe(1);
		expect(normalizeZoomScale(1.06)).toBe(1.1);
		expect(normalizeZoomScale(0.14)).toBe(0.1);
	});

	it('preserves preset zoom values', () => {
		expect(normalizeZoomValue('auto')).toBe('auto');
		expect(normalizeZoomValue('page-fit')).toBe('page-fit');
	});

	it('steps zoom in and out inside the configured bounds', () => {
		expect(zoomOut(0.15)).toBe(MIN_ZOOM_SCALE);
		expect(zoomIn(2.95)).toBe(MAX_ZOOM_SCALE);
		expect(zoomOut(1)).toBe(0.9);
		expect(zoomIn(1)).toBe(1.1);
	});
});
