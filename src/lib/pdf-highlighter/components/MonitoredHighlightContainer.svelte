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
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
	class="highlight_container"
	id={highlightTip?.content?.highlight?.id
		? `highlight-${highlightTip.content.highlight.id}`
		: undefined}
	onmouseenter={() => {
		onMouseEnter?.();
		//if (isEditingOrHighlighting()) return;
		if (highlightTip) {
			// MouseMonitor the highlightTip to prevent it from disappearing if the mouse is over it and not the highlight.
			const hid = highlightTip.content?.highlight?.id ?? highlightTip.content?.id;
			pdfHighlighterUtils.setTip?.({
				show: true,
				tip: highlightTip,
				tip_id: hid
			});
		}
	}}
	onmouseleave={(event: MouseEvent) => {
		const nextTarget = event.relatedTarget as HTMLElement | null;
		const movedIntoTip = !!nextTarget?.closest('.hl_tip_container');

		if (!movedIntoTip) {
			pdfHighlighterUtils.setTip?.({
				show: false
			});
		}

		if (!highlightTip && !movedIntoTip) onMouseLeave?.();
	}}
>
	{@render children()}
</div>
