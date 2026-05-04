type TipPositionRect = {
	left: number;
	top: number;
	width: number;
	height: number;
};

type TipPoint = {
	x: number;
	y: number;
};

type TipPositioningArgs = {
	highlightRect: TipPositionRect;
	pageOffset: { left: number; top: number };
	containerScroll: { left: number; top: number };
	containerSize: { width: number; height: number };
	popupSize: { width: number; height: number };
	entryPoint?: TipPoint;
	isNewSelection: boolean;
	useCommentEditorPlacement?: boolean;
};

// Hover placement uses the editor's minimum height so hover and edit stay on the same side.
export const DEFAULT_COMMENT_EDITOR_PLACEMENT_HEIGHT = 152;

const clamp = (value: number, left: number, right: number) => Math.min(Math.max(value, left), right);

export function getTipPosition({
	highlightRect,
	pageOffset,
	containerScroll,
	containerSize,
	popupSize,
	entryPoint,
	isNewSelection,
	useCommentEditorPlacement = false
}: TipPositioningArgs) {
	const highlightTop = highlightRect.top + pageOffset.top;
	const highlightBottom = highlightTop + highlightRect.height;
	const highlightLeft = pageOffset.left + highlightRect.left;
	const highlightRight = highlightLeft + highlightRect.width;
	const highlightCenter = highlightLeft + highlightRect.width / 2;

	const placementHeight = useCommentEditorPlacement
		? Math.max(popupSize.height, DEFAULT_COMMENT_EDITOR_PLACEMENT_HEIGHT)
		: popupSize.height;

	const aboveFits = highlightTop - placementHeight - 10 >= containerScroll.top;
	const visibleBottom = containerScroll.top + containerSize.height;
	const belowFits = highlightBottom + placementHeight <= visibleBottom;

	let placeBelow = !aboveFits;
	if (entryPoint && aboveFits && belowFits) {
		const distanceToTop = Math.abs(entryPoint.y - highlightTop);
		const distanceToBottom = Math.abs(entryPoint.y - highlightBottom);
		placeBelow = distanceToBottom < distanceToTop;
	} else if (!aboveFits && !belowFits) {
		placeBelow = highlightTop - placementHeight - 10 < containerScroll.top;
	}

	const gap = isNewSelection ? 0 : 5;
	const top = placeBelow ? highlightBottom + gap : highlightTop - popupSize.height - gap;

	const preferredCenter = entryPoint
		? clamp(entryPoint.x, highlightLeft, highlightRight)
		: highlightCenter;
	const left = clamp(
		preferredCenter - popupSize.width / 2,
		containerScroll.left,
		containerSize.width - popupSize.width + containerScroll.left - 20
	);

	return { top, left };
}
