export type FastSearchPreviewPlacement = {
	horizontal: 'right' | 'left';
	vertical: 'below' | 'above';
};

export type FastSearchPreviewPosition = {
	left: number;
	top: number;
	placement: FastSearchPreviewPlacement;
};

export function clampFastSearchPreviewPosition(
	clientX: number,
	clientY: number,
	previewWidth: number,
	previewHeight: number,
	offsetX: number,
	offsetY: number
): FastSearchPreviewPosition {
	const margin = 8;
	let horizontal: FastSearchPreviewPlacement['horizontal'] = 'right';
	let vertical: FastSearchPreviewPlacement['vertical'] = 'below';
	let left = clientX + offsetX;
	let top = clientY + offsetY;

	if (left + previewWidth + margin > window.innerWidth) {
		left = clientX - previewWidth - offsetX;
		horizontal = 'left';
	}
	if (top + previewHeight + margin > window.innerHeight) {
		top = clientY - previewHeight - offsetY;
		vertical = 'above';
	}

	left = Math.max(margin, Math.min(left, window.innerWidth - previewWidth - margin));
	top = Math.max(margin, Math.min(top, window.innerHeight - previewHeight - margin));

	return {
		left,
		top,
		placement: { horizontal, vertical }
	};
}

export function fastSearchPreviewPlacementKey(placement: FastSearchPreviewPlacement): string {
	return `${placement.horizontal}:${placement.vertical}`;
}
