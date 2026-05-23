export type BridgePoint = { x: number; y: number };

export type BridgeRect = {
	left: number;
	right: number;
	top: number;
	bottom: number;
};

export function domRectToBridgeRect(rect: DOMRect): BridgeRect {
	return {
		left: rect.left,
		right: rect.right,
		top: rect.top,
		bottom: rect.bottom
	};
}

export function pointInRect(point: BridgePoint, rect: BridgeRect): boolean {
	return (
		point.x >= rect.left &&
		point.x <= rect.right &&
		point.y >= rect.top &&
		point.y <= rect.bottom
	);
}

export function pointInPolygon(point: BridgePoint, polygon: BridgePoint[]): boolean {
	let inside = false;
	for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
		const pi = polygon[i];
		const pj = polygon[j];
		const intersects =
			pi.y > point.y !== pj.y > point.y &&
			point.x < ((pj.x - pi.x) * (point.y - pi.y)) / (pj.y - pi.y) + pi.x;
		if (intersects) inside = !inside;
	}
	return inside;
}

export function buildBridgePolygon(
	sourceRect: BridgeRect,
	targetRect: BridgeRect,
	gap: number
): BridgePoint[] {
	const targetAbove = targetRect.bottom <= sourceRect.top;
	const sourceEdgeY = targetAbove ? sourceRect.top : sourceRect.bottom;
	const targetEdgeY = targetAbove ? targetRect.bottom : targetRect.top;
	return [
		{ x: sourceRect.left - gap, y: sourceEdgeY },
		{ x: sourceRect.right + gap, y: sourceEdgeY },
		{ x: targetRect.right + gap, y: targetEdgeY },
		{ x: targetRect.left - gap, y: targetEdgeY }
	];
}

export function isPointInBridge(
	point: BridgePoint,
	sourceRect: BridgeRect,
	targetRect: BridgeRect,
	gap: number
): boolean {
	if (pointInRect(point, sourceRect)) {
		return true;
	}
	if (pointInRect(point, targetRect)) {
		return true;
	}
	return pointInPolygon(point, buildBridgePolygon(sourceRect, targetRect, gap));
}

export type HoverBridgePointerMoveResult = 'ignore' | 'close' | 'continue';

export type CreateHoverBridgeTrackerOptions = {
	getSourceRect: () => BridgeRect | null;
	getTargetRect: () => BridgeRect | null;
	gap: number;
	onExitBridge: () => void;
	onPointerMove?: (event: PointerEvent) => HoverBridgePointerMoveResult;
};

export type HoverBridgeTracker = {
	start: (event: { clientX: number; clientY: number }) => void;
	stop: () => void;
	isActive: () => boolean;
	shouldStayOpen: (x: number, y: number) => boolean;
};

export function createHoverBridgeTracker(
	options: CreateHoverBridgeTrackerOptions
): HoverBridgeTracker {
	let bridgePointerMove: ((event: PointerEvent) => void) | null = null;
	let bridgeShouldStayOpen: ((x: number, y: number) => boolean) | null = null;

	function stop() {
		if (bridgePointerMove) {
			document.removeEventListener('pointermove', bridgePointerMove);
			bridgePointerMove = null;
		}
		bridgeShouldStayOpen = null;
	}

	function shouldStayOpen(x: number, y: number): boolean {
		if (!bridgeShouldStayOpen) return false;
		return bridgeShouldStayOpen(x, y);
	}

	function start(event: { clientX: number; clientY: number }) {
		stop();

		const sourceRect = options.getSourceRect();
		const targetRect = options.getTargetRect();
		if (!sourceRect || !targetRect) {
			options.onExitBridge();
			return;
		}

		bridgeShouldStayOpen = (x: number, y: number) =>
			isPointInBridge({ x, y }, sourceRect, targetRect, options.gap);

		if (!bridgeShouldStayOpen(event.clientX, event.clientY)) {
			options.onExitBridge();
			return;
		}

		bridgePointerMove = (moveEvent: PointerEvent) => {
			const pointerResult = options.onPointerMove?.(moveEvent) ?? 'continue';
			if (pointerResult === 'ignore') {
				return;
			}
			if (pointerResult === 'close') {
				stop();
				options.onExitBridge();
				return;
			}
			if (!bridgeShouldStayOpen!(moveEvent.clientX, moveEvent.clientY)) {
				stop();
				options.onExitBridge();
			}
		};
		document.addEventListener('pointermove', bridgePointerMove);
	}

	return {
		start,
		stop,
		isActive: () => bridgePointerMove !== null,
		shouldStayOpen
	};
}
