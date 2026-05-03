type HighlightScrollTargetInput = {
	containerScrollTop: number;
	containerTop: number;
	containerHeight: number;
	pageTop: number;
	highlightTop: number;
	maxScrollTop?: number;
	tolerance?: number;
};

const HIGHLIGHT_VIEWPORT_OFFSET = 0.25;
const DEFAULT_SCROLL_TOLERANCE = 2;

export function getHighlightScrollTarget({
	containerScrollTop,
	containerTop,
	containerHeight,
	pageTop,
	highlightTop,
	maxScrollTop
}: HighlightScrollTargetInput): number {
	const target =
		containerScrollTop +
		(pageTop - containerTop) +
		highlightTop -
		containerHeight * HIGHLIGHT_VIEWPORT_OFFSET;

	const lowerBounded = Math.max(0, target);
	return typeof maxScrollTop === 'number'
		? Math.min(lowerBounded, Math.max(0, maxScrollTop))
		: lowerBounded;
}

export function getHighlightScrollTargetState(input: HighlightScrollTargetInput): {
	targetTop: number;
	shouldScroll: boolean;
} {
	const targetTop = getHighlightScrollTarget(input);
	const tolerance = input.tolerance ?? DEFAULT_SCROLL_TOLERANCE;

	return {
		targetTop,
		shouldScroll: Math.abs(targetTop - input.containerScrollTop) > tolerance
	};
}
