<script lang="ts" module>
	import type {
		ViewportHighlight,
		LTWHP,
		PdfHighlighterUtils as TPdfHighlighterUtils
	} from '$lib/pdf-highlighter/types';

	export interface AreaHighlightProps {
		/**
		 * The highlight to be rendered as an {@link AreaHighlight}.
		 */
		highlight: ViewportHighlight;

		/**
		 * Callback triggered whenever the user clicks on the part of a highlight.
		 *
		 * @param event - Mouse event associated with click.
		 */
		onClick?(event: MouseEvent): void;

		/**
		 * A callback triggered whenever the highlight area is either finished
		 * being moved or resized.
		 *
		 * @param rect - The updated highlight area.
		 */
		onChange?(rect: LTWHP): void;

		/**
		 * Has the highlight been auto-scrolled into view? By default, this will render the highlight red.
		 */
		//isScrolledTo?: boolean;

		/**
		 * Bounds on the highlight area. This is useful for preventing the user
		 * moving the highlight off the viewer/page.
		 */
		bounds?: Element;

		/**
		 * A callback triggered whenever a context menu is opened on the highlight area.
		 *
		 * @param event - The mouse event associated with the context menu.
		 */
		onContextMenu?(event: MouseEvent): void;

		/**
		 * Event called whenever the user tries to move or resize an {@link AreaHighlight}.
		 */
		//onEditStart?(): void;

		pdfHighlighterUtils: Partial<TPdfHighlighterUtils>;
		highlightMixBlendMode?: string;
		isDraggable?: boolean;
	}
</script>

<script lang="ts">
	//TODO: custom styling
	//TODO: DRY?
	import { debounce } from '$lib/pdf-highlighter/utils';
	import RND from '$lib/pdf-highlighter/components/RND.svelte';
	import type { LTWH } from '$lib/pdf-highlighter/types';
	import { resolveHighlightColor } from '$lib/highlights/color-slots';

	/**
	 * The props type for {@link AreaHighlight}.
	 *
	 * @category Component Properties
	 */

	/**
	 * Renders a resizeable and interactive rectangular area for a highlight.
	 *
	 * @category Component
	 */
	let {
		highlight,
		onChange,
		bounds,
		onContextMenu,
		//onEditStart,
		pdfHighlighterUtils,
		highlightMixBlendMode = 'normal',
		onClick,
		isDraggable = false
	}: AreaHighlightProps = $props();

	const currentThemeMode = $derived(pdfHighlighterUtils.viewerTheme?.mode ?? 'light');
	const color = $derived.by(() => {
		if (highlight.display_color) {
			return resolveHighlightColor(highlight.display_color, currentThemeMode);
		}
		if (highlight.color_index !== undefined && highlight.color_index !== null) {
			return pdfHighlighterUtils.colors?.[highlight.color_index] ?? 'lightgrey';
		}
		return pdfHighlighterUtils.colors?.[0] ?? 'yellow';
	});
	const isInteractionBlocked = $derived(
		Boolean(pdfHighlighterUtils.isHighlightInteractionBlocked?.(highlight.id))
	);

	let isAllowTextSelection = $state(false);
	//let delay = pdfHighlighterUtils.textSelectionDelay;
	const allowTextSelection = debounce(() => {
		if ((pdfHighlighterUtils.textSelectionDelay ?? 0) < 0) return;
		isAllowTextSelection = true;
	}, pdfHighlighterUtils.textSelectionDelay ?? 0);
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
	oncontextmenu={(event) => {
		if (isInteractionBlocked) {
			event.preventDefault();
			event.stopPropagation();
			return;
		}
		onContextMenu?.(event);
	}}
	style="mix-blend-mode: {highlightMixBlendMode}"
	class={isAllowTextSelection ? 'AreaHighlight allowSelect' : 'AreaHighlight'}
	class:is-active={pdfHighlighterUtils.hoveredHighlightId === highlight.id}
	class:is-adjusting={isDraggable}
	class:is-dimmed={pdfHighlighterUtils.hoveredHighlightId &&
		pdfHighlighterUtils.hoveredHighlightId !== highlight.id}
	onmouseenter={() => {
		if (isInteractionBlocked) return;
		pdfHighlighterUtils.setHoveredHighlightId?.(highlight.id ?? null);
		if (pdfHighlighterUtils.selectedTool === 'text_selection') {
			allowTextSelection();
		}
	}}
	onmouseleave={() => {
		pdfHighlighterUtils.setHoveredHighlightId?.(null);
		allowTextSelection.cancel();
		isAllowTextSelection = false;
	}}
>
	{#key highlight.position.boundingRect}
		<RND
			{highlight}
			{pdfHighlighterUtils}
			{isAllowTextSelection}
			{allowTextSelection}
			boundingRect={highlight.position.boundingRect}
			onDragOrResizeStop={(data: LTWH) => {
				const boundingRect = {
					...highlight.position.boundingRect,
					top: data.top,
					left: data.left,
					width: data.width,
					height: data.height
					//pageNumber: getPageFromElement(ref)?.number || -1,
				};

				onChange?.(boundingRect);
			}}
			{bounds}
			{color}
			onClick={(event: MouseEvent) => {
				if (isInteractionBlocked) {
					event.preventDefault();
					event.stopPropagation();
					return;
				}
				onClick?.(event);
			}}
			{isDraggable}
		></RND>
	{/key}
</div>

<style>
	.AreaHighlight {
		pointer-events: auto;
		transition:
			opacity 0.2s ease-in-out,
			filter 0.2s ease-in-out;
	}

	.AreaHighlight.is-active {
		filter: contrast(1.1) brightness(1.1);
	}

	.AreaHighlight.is-adjusting {
		outline: 2px solid var(--primary, #2563eb);
		outline-offset: 3px;
		border-radius: 4px;
		filter: contrast(1.15) brightness(1.08);
	}

	.AreaHighlight.is-dimmed {
		opacity: 0.15 !important;
	}

	.allowSelect {
		cursor: text;
		opacity: 0.8;
		user-select: text;
	}
</style>
