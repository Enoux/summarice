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
	import {
		HOVER_BRIDGE_STOP_EVENT,
		HOVER_TIP_LEAVE_EVENT,
		TIP_CONTAINER_SELECTOR
	} from '$lib/pdf-highlighter/lib/tip-hover-contract';
	import {
		buildBridgePolygon,
		createHoverBridgeTracker,
		domRectToBridgeRect,
		type BridgeRect
	} from '$lib/ui/hover-bridge-geometry';

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

	const DEBUG_HOVER_BRIDGE = false;
	const BRIDGE_GAP = 10;
	let highlightContainerEl = $state<HTMLElement | null>(null);
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

	function getHighlightBodyRect(container: HTMLElement): BridgeRect | null {
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

	function exitBridge() {
		pdfHighlighterUtils.setTip?.({ show: false });
		onMouseLeave?.();
	}

	const bridgeTracker = createHoverBridgeTracker({
		gap: BRIDGE_GAP,
		getSourceRect: () => {
			if (!highlightContainerEl) return null;
			return getHighlightBodyRect(highlightContainerEl);
		},
		getTargetRect: () => {
			const tipNode = document.querySelector<HTMLElement>(TIP_CONTAINER_SELECTOR);
			if (!tipNode) return null;
			return domRectToBridgeRect(tipNode.getBoundingClientRect());
		},
		onExitBridge: exitBridge,
		onPointerMove: (moveEvent) => {
			const target = moveEvent.target instanceof Element ? moveEvent.target : null;
			if (target?.closest(TIP_CONTAINER_SELECTOR)) {
				return 'ignore';
			}
			const targetHighlight = target?.closest<HTMLElement>('.highlight_container');
			if (targetHighlight && targetHighlight !== highlightContainerEl) {
				return 'close';
			}
			return 'continue';
		}
	});

	function stopBridgeTracking() {
		bridgeTracker.stop();
		debugBridgePoints = null;
		debugHighlightBody = null;
		debugTipBody = null;
	}

	function startBridgeTracking(container: HTMLElement, event: MouseEvent) {
		highlightContainerEl = container;

		if (DEBUG_HOVER_BRIDGE) {
			const highlightRect = getHighlightBodyRect(container);
			const tipNode = document.querySelector<HTMLElement>(TIP_CONTAINER_SELECTOR);
			if (highlightRect && tipNode) {
				const tipRect = tipNode.getBoundingClientRect();
				const bridgePolygon = buildBridgePolygon(highlightRect, domRectToBridgeRect(tipRect), BRIDGE_GAP);
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
		}

		bridgeTracker.start(event);
	}

	function handleExternalBridgeStop() {
		stopBridgeTracking();
	}

	function handleTipLeave(event: Event) {
		const customEvent = event as CustomEvent<{ clientX: number; clientY: number }>;
		if (
			bridgeTracker.shouldStayOpen(customEvent.detail.clientX, customEvent.detail.clientY)
		) {
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
	bind:this={highlightContainerEl}
	id={highlightTip?.content?.highlight?.id
		? `highlight-${highlightTip.content.highlight.id}`
		: undefined}
	onmouseover={(event: MouseEvent) => {
		const target = event.currentTarget as HTMLElement;
		const from = event.relatedTarget as HTMLElement;
		if (target.contains(from)) return; // Ignore internal moves

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

		// Set global hover state
		pdfHighlighterUtils.setHoveredHighlightId?.(highlightId ?? null);

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
	onmouseout={(event: MouseEvent & { currentTarget: EventTarget & HTMLElement }) => {
		const target = event.currentTarget as HTMLElement;
		const to = event.relatedTarget as HTMLElement;
		if (target.contains(to)) return; // Ignore internal moves

		const nextTarget = event.relatedTarget as HTMLElement | null;
		const movedIntoTip = !!nextTarget?.closest(TIP_CONTAINER_SELECTOR);

		if (!movedIntoTip) {
			startBridgeTracking(event.currentTarget, event);
		}

		// Clear global hover state if not moving into tip
		if (!movedIntoTip) {
			pdfHighlighterUtils.setHoveredHighlightId?.(null);
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
