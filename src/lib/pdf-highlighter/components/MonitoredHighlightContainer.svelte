<script lang="ts" module>
	import type { Snippet } from 'svelte';
	import type {
		Tip,
		PdfHighlighterUtils as TPdfHighlighterUtils
	} from '$lib/pdf-highlighter/types';

	/**
	 * The props type for {@link MonitoredHighlightContainer}.
	 *
	 * @category Component Properties
	 */
	export interface MonitoredHighlightContainerProps {
		/**
		 * A callback triggered whenever the mouse hovers over a highlight.
		 */
		onMouseEnter?(): void;

		/**
		 * What tip to automatically display whenever a mouse hovers over a highlight.
		 * The tip will persist even as the user puts their mouse over it and not the
		 * highlight, but will disappear once it no longer hovers both.
		 */
		highlightTip?: Tip;

		/**
		 * A callback triggered whenever the mouse completely moves out from both the
		 * highlight (children) and any highlightTip.
		 */
		onMouseLeave?(): void;

		/**
		 * Component to monitor mouse activity over. This should be a highlight within the {@link PdfHighlighter}.
		 */
		children: Snippet;

		pdfHighlighterUtils: Partial<TPdfHighlighterUtils>;
	}
</script>

<script lang="ts">
	import { onDestroy } from 'svelte';

	/**
	 * A container for a highlight component that monitors whether a mouse is over a
	 * highlight and over some secondary highlight tip. It will display the tip
	 * whenever the mouse is over the highlight and it will hide the tip only when
	 * the mouse has left the highlight AND the tip.
	 *
	 * @category Component
	 */
	let {
		onMouseEnter,
		highlightTip,
		onMouseLeave,
		children,
		pdfHighlighterUtils
	}: MonitoredHighlightContainerProps = $props();

	//const { isEditingOrHighlighting } = pdfHighlighterUtils;
	//let tipContainerState = setContext('tipContainerState', highlightTip);
	const DEBUG_HOVER_BRIDGE = false;
	const HOVER_BRIDGE_STOP_EVENT = 'pdf-highlighter:hover-bridge-stop';
	const HOVER_TIP_LEAVE_EVENT = 'pdf-highlighter:hover-tip-leave';
	let bridgePointerMove: ((event: PointerEvent) => void) | null = null;
	let bridgeShouldStayOpen: ((x: number, y: number) => boolean) | null = null;
	let debugBridgePoints = $state<string | null>(null);
	let debugHighlightBody = $state<{ left: number; top: number; width: number; height: number } | null>(
		null
	);
	let debugTipBody = $state<{ left: number; top: number; width: number; height: number } | null>(null);
	const highlightId = $derived(highlightTip?.content?.highlight?.id ?? highlightTip?.content?.id);
	const ownsVisibleHoverTip = $derived(
		Boolean(
			highlightId &&
				pdfHighlighterUtils.activeTipHighlightId === highlightId &&
				!pdfHighlighterUtils.activeTipPinned
		)
	);

	function stopBridgeTracking() {
		if (bridgePointerMove) {
			document.removeEventListener('pointermove', bridgePointerMove);
			bridgePointerMove = null;
		}
		bridgeShouldStayOpen = null;
		debugBridgePoints = null;
		debugHighlightBody = null;
		debugTipBody = null;
	}

	function getHighlightBodyRect(container: HTMLElement) {
		const parts = Array.from(
			container.querySelectorAll<HTMLElement>('.TextHighlight__part, .AreaHighlight')
		);
		const rects = (parts.length ? parts : [container])
			.map((node) => node.getBoundingClientRect())
			.filter((rect) => rect.width > 0 && rect.height > 0);

		if (rects.length === 0) return null;

		return {
			left: Math.min(...rects.map((rect) => rect.left)),
			right: Math.max(...rects.map((rect) => rect.right)),
			top: Math.min(...rects.map((rect) => rect.top)),
			bottom: Math.max(...rects.map((rect) => rect.bottom))
		};
	}

	function buildBridgePolygon(
		highlightRect: { left: number; right: number; top: number; bottom: number },
		tipRect: DOMRect
	) {
		const gap = 10;
		const tipAbove = tipRect.bottom <= highlightRect.top;
		const highlightEdgeY = tipAbove ? highlightRect.top : highlightRect.bottom;
		const tipEdgeY = tipAbove ? tipRect.bottom : tipRect.top;
		return [
			{ x: highlightRect.left - gap, y: highlightEdgeY },
			{ x: highlightRect.right + gap, y: highlightEdgeY },
			{ x: tipRect.right + gap, y: tipEdgeY },
			{ x: tipRect.left - gap, y: tipEdgeY }
		];
	}

	function pointInPolygon(point: { x: number; y: number }, polygon: { x: number; y: number }[]) {
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

	function pointInRect(
		point: { x: number; y: number },
		rect: { left: number; right: number; top: number; bottom: number }
	) {
		return (
			point.x >= rect.left && point.x <= rect.right && point.y >= rect.top && point.y <= rect.bottom
		);
	}

	function isPointInBridge(
		point: { x: number; y: number },
		highlightRect: { left: number; right: number; top: number; bottom: number },
		tipRect: DOMRect
	) {
		if (pointInRect(point, highlightRect)) {
			return true;
		}

		if (pointInRect(point, tipRect)) {
			return true;
		}

		return pointInPolygon(point, buildBridgePolygon(highlightRect, tipRect));
	}

	function startBridgeTracking(container: HTMLElement, event: MouseEvent) {
		stopBridgeTracking();

		const tipNode = document.querySelector<HTMLElement>('.hl_tip_container');
		const highlightRect = getHighlightBodyRect(container);
		if (!tipNode || !highlightRect) {
			pdfHighlighterUtils.setTip?.({ show: false });
			onMouseLeave?.();
			return;
		}

		const tipRect = tipNode.getBoundingClientRect();
		const bridgePolygon = buildBridgePolygon(highlightRect, tipRect);
		if (DEBUG_HOVER_BRIDGE) {
			debugBridgePoints = bridgePolygon.map((point) => `${point.x},${point.y}`).join(' ');
			debugHighlightBody = {
				left: highlightRect.left,
				top: highlightRect.top,
				width: highlightRect.right - highlightRect.left,
				height: highlightRect.bottom - highlightRect.top
			};
			debugTipBody = {
				left: tipRect.left,
				top: tipRect.top,
				width: tipRect.width,
				height: tipRect.height
			};
		}
		bridgeShouldStayOpen = (x: number, y: number) =>
			isPointInBridge({ x, y }, highlightRect, tipRect);

		if (!bridgeShouldStayOpen(event.clientX, event.clientY)) {
			pdfHighlighterUtils.setTip?.({ show: false });
			onMouseLeave?.();
			return;
		}

		bridgePointerMove = (moveEvent: PointerEvent) => {
			const target = moveEvent.target instanceof Element ? moveEvent.target : null;
			if (target?.closest('.hl_tip_container')) {
				return;
			}
			const targetHighlight = target?.closest<HTMLElement>('.highlight_container');
			if (targetHighlight && targetHighlight !== container) {
				stopBridgeTracking();
				pdfHighlighterUtils.setTip?.({ show: false });
				onMouseLeave?.();
				return;
			}
			if (!bridgeShouldStayOpen!(moveEvent.clientX, moveEvent.clientY)) {
				stopBridgeTracking();
				pdfHighlighterUtils.setTip?.({ show: false });
				onMouseLeave?.();
			}
		};
		document.addEventListener('pointermove', bridgePointerMove);
	}

	function handleExternalBridgeStop() {
		stopBridgeTracking();
	}

	function handleTipLeave(event: Event) {
		const customEvent = event as CustomEvent<{ clientX: number; clientY: number }>;
		if (bridgeShouldStayOpen && bridgeShouldStayOpen(customEvent.detail.clientX, customEvent.detail.clientY)) {
			event.preventDefault();
		}
	}

	$effect(() => {
		document.addEventListener(HOVER_BRIDGE_STOP_EVENT, handleExternalBridgeStop);
		document.addEventListener(HOVER_TIP_LEAVE_EVENT, handleTipLeave);
		return () => {
			document.removeEventListener(HOVER_BRIDGE_STOP_EVENT, handleExternalBridgeStop);
			document.removeEventListener(HOVER_TIP_LEAVE_EVENT, handleTipLeave);
		};
	});

	$effect(() => {
		if (!ownsVisibleHoverTip) stopBridgeTracking();
	});

	onDestroy(stopBridgeTracking);
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
	class="highlight_container"
	id={highlightTip?.content?.highlight?.id
		? `highlight-${highlightTip.content.highlight.id}`
		: undefined}
	onmouseenter={(event: MouseEvent) => {
		if (
			highlightId &&
			pdfHighlighterUtils.activeTipPinned &&
			pdfHighlighterUtils.activeTipHighlightId !== highlightId
		) {
			return;
		}

		if (ownsVisibleHoverTip) {
			stopBridgeTracking();
			onMouseEnter?.();
			return;
		}

		document.dispatchEvent(new CustomEvent(HOVER_BRIDGE_STOP_EVENT));
		stopBridgeTracking();
		onMouseEnter?.();
		//if (isEditingOrHighlighting()) return;
		if (highlightTip) {
			// MouseMonitor the highlightTip to prevent it from disappearing if the mouse is over it and not the highlight.
			pdfHighlighterUtils.setTip?.({
				show: true,
				tip: highlightTip,
				tip_id: highlightId,
				entryPoint: {
					clientX: event.clientX,
					clientY: event.clientY
				}
			});
		}
	}}
	onmouseleave={(event: MouseEvent & { currentTarget: EventTarget & HTMLElement }) => {
		const nextTarget = event.relatedTarget as HTMLElement | null;
		const movedIntoTip = !!nextTarget?.closest('.hl_tip_container');

		if (!movedIntoTip) {
			startBridgeTracking(event.currentTarget, event);
		}

		if (!highlightTip && !movedIntoTip) onMouseLeave?.();
	}}
>
	{@render children()}
</div>

{#if DEBUG_HOVER_BRIDGE && ownsVisibleHoverTip && debugBridgePoints}
	<svg
		class="hover-bridge-debug"
		aria-hidden="true"
	>
		<polygon points={debugBridgePoints} />
		{#if debugHighlightBody}
			<rect
				x={debugHighlightBody.left}
				y={debugHighlightBody.top}
				width={debugHighlightBody.width}
				height={debugHighlightBody.height}
			/>
		{/if}
		{#if debugTipBody}
			<rect
				class="tip-debug"
				x={debugTipBody.left}
				y={debugTipBody.top}
				width={debugTipBody.width}
				height={debugTipBody.height}
			/>
		{/if}
	</svg>
{/if}

<style>
	.hover-bridge-debug {
		position: fixed;
		inset: 0;
		z-index: 9999;
		width: 100vw;
		height: 100vh;
		pointer-events: none;
	}

	.hover-bridge-debug polygon {
		fill: rgba(59, 130, 246, 0.16);
		stroke: rgba(59, 130, 246, 0.75);
		stroke-width: 1.5;
	}

	.hover-bridge-debug rect {
		fill: rgba(34, 197, 94, 0.12);
		stroke: rgba(34, 197, 94, 0.8);
		stroke-width: 1.5;
	}

	.hover-bridge-debug rect.tip-debug {
		fill: rgba(168, 85, 247, 0.1);
		stroke: rgba(168, 85, 247, 0.75);
	}
</style>
