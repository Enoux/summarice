import type { PdfScaleValue } from '$lib/pdf-highlighter/types';

export const MIN_ZOOM_SCALE = 0.1;
export const MAX_ZOOM_SCALE = 3;
export const ZOOM_STEP = 0.1;

export function normalizeZoomScale(value: number): number {
	if (!Number.isFinite(value)) return 1;
	const clamped = Math.min(MAX_ZOOM_SCALE, Math.max(MIN_ZOOM_SCALE, value));
	return Math.round(clamped * 10) / 10;
}

export function normalizeZoomValue(value: PdfScaleValue): PdfScaleValue {
	return typeof value === 'number' ? normalizeZoomScale(value) : value;
}

export function zoomOut(currentScale: number): number {
	return normalizeZoomScale(currentScale - ZOOM_STEP);
}

export function zoomIn(currentScale: number): number {
	return normalizeZoomScale(currentScale + ZOOM_STEP);
}

export function isPresetZoomValue(value: PdfScaleValue | undefined): boolean {
	return typeof value === 'string';
}
