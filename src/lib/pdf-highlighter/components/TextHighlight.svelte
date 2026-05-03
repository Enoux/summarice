<script lang="ts" module>
	import type {
		ViewportHighlight,
		PdfHighlighterUtils as TPdfHighlighterUtils
	} from '$lib/pdf-highlighter/types';

	/**
	 * The props type for {@link TextHighlight}.
	 *
	 * @category Component Properties
	 */
	export interface TextHighlightProps {
		/**
		 * Highlight to render over text.
		 */
		highlight: ViewportHighlight;

		/**
		 * Callback triggered whenever the user clicks on the part of a highlight.
		 *
		 * @param event - Mouse event associated with click.
		 */
		onClick?(event: MouseEvent): void;

		/**
		 * Indicates whether the component is autoscrolled into view, affecting
		 * default theming.
		 */
		//isScrolledTo: boolean;

		/**
		 * Callback triggered whenever the user tries to open context menu on highlight.
		 *
		 * @param event - Mouse event associated with click.
		 */
		onContextMenu?(event: MouseEvent): void;

		pdfHighlighterUtils: Partial<TPdfHighlighterUtils>;
		highlightMixBlendMode?: string;
	}
</script>

<script lang="ts">
	//TODO: DRY?
	import { debounce } from '$lib/pdf-highlighter/utils';

	/**
	 * A component for displaying a highlighted text area.
	 *
	 * @category Component
	 */
	let {
		highlight,
		onClick,
		onContextMenu,
		pdfHighlighterUtils,
		highlightMixBlendMode = 'normal'
	}: TextHighlightProps = $props();

	const { rects } = highlight.position;

	const scrolledToColor = pdfHighlighterUtils.scrolledTo_color;
	const color = $derived.by(() => {
		if (highlight.display_color) return highlight.display_color;
		if (highlight.color_index !== undefined && highlight.color_index !== null) {
			return pdfHighlighterUtils.colors?.[highlight.color_index] ?? 'lightgrey';
		}
		return pdfHighlighterUtils.colors?.[0] ?? 'yellow';
	});
	const isInteractionBlocked = $derived(
		Boolean(pdfHighlighterUtils.isHighlightInteractionBlocked?.(highlight.id))
	);

	//style={{ ...rect, ...style }}

	let isAllowTextSelection = $state(false);
	const allowTextSelection = debounce(() => {
		//console.log(delay)
		//if (!pdfHighlighterUtils.isAllowTextSelectionInHl()) return;
		if ((pdfHighlighterUtils.textSelectionDelay ?? 0) < 0) return;
		isAllowTextSelection = true;
	}, pdfHighlighterUtils.textSelectionDelay ?? 0);
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
	class="TextHighlight"
	class:is-active={pdfHighlighterUtils.hoveredHighlightId === highlight.id}
	oncontextmenu={(event) => {
		if (isInteractionBlocked) {
			event.preventDefault();
			event.stopPropagation();
			return;
		}
		onContextMenu?.(event);
	}}
>
	<div class="TextHighlight__parts">
		{#each rects as rect (rect.left + ',' + rect.top + ',' + rect.width + ',' + rect.height)}
			<!-- svelte-ignore a11y_click_events_have_key_events -->
			<div
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
				onpointerdown={(e) => {
					if (isInteractionBlocked) {
						e.preventDefault();
						e.stopPropagation();
						return;
					}
					if (!isAllowTextSelection) {
						e.preventDefault();
						e.stopPropagation();
					} else {
						if (highlight.id) {
							pdfHighlighterUtils.setCurrentHighlightId?.(highlight.id);
						}
						if (typeof highlight.z_index !== 'number') highlight.z_index = 0;
						pdfHighlighterUtils.setCurrentHighlightZIndex?.(highlight.z_index);
					}
				}}
				onpointerup={(e) => {
					e.preventDefault();
					e.stopPropagation();
				}}
				onclick={(e) => {
					e.preventDefault();
					e.stopPropagation();
					if (isInteractionBlocked) return;
					onClick?.(e);
				}}
				style="width:{rect.width}px; height: {rect.height}px; left: {rect.left}px; top: {rect.top}px; background: {pdfHighlighterUtils.scrolledToHighlightIdRef ===
					highlight.id && scrolledToColor
					? scrolledToColor
					: color}; cursor: {isAllowTextSelection
					? 'text'
					: 'pointer'}; opacity: {isAllowTextSelection
					? '0.8'
					: '1'}; mix-blend-mode: {highlightMixBlendMode};"
				class="{pdfHighlighterUtils.scrolledToHighlightIdRef === highlight.id
					? 'TextHighlight__part--scrolledTo'
					: ''} TextHighlight__part"
				class:is-dimmed={pdfHighlighterUtils.hoveredHighlightId &&
					pdfHighlighterUtils.hoveredHighlightId !== highlight.id}
			></div>
		{/each}
	</div>
</div>

<style>
	.TextHighlight {
		position: absolute;
		pointer-events: none;
	}

	.TextHighlight__parts {
		opacity: 1;
		pointer-events: none;
	}

	.TextHighlight__part {
		cursor: pointer;
		position: absolute;
		pointer-events: auto;
		background: rgba(255, 226, 143, 1);
		transition:
			background 1s,
			opacity 0.2s ease-in-out,
			filter 0.2s ease-in-out;
	}
	.TextHighlight.is-active .TextHighlight__part {
		filter: contrast(1.1) brightness(1.1);
	}
	.TextHighlight__part.is-dimmed {
		opacity: 0.15 !important;
	}
	.TextHighlight__part--scrolledTo {
		transition: opacity 0.2s ease-in-out;
	}
</style>
