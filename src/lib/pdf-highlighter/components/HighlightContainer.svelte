<script lang="ts">
	//import { pdfHighlighterUtils } from '$lib/pdf-highlighter/components/pdfHighlighterUtils.shared.svelte.ts';
	import AreaHighlight from '$lib/pdf-highlighter/components/AreaHighlight.svelte';
	import TextHighlight from '$lib/pdf-highlighter/components/TextHighlight.svelte';
	import MonitoredHighlightContainer from '$lib/pdf-highlighter/components/MonitoredHighlightContainer.svelte';

	import { getContext } from 'svelte';
	import type {
		CommentedHighlight,
		Tip,
		ViewportHighlight,
		PdfHighlighterUtils as TPdfHighlighterUtils,
		LTWHP,
		Scaled
	} from '$lib/pdf-highlighter/types';

	interface HighlightContainerProps {
		editHighlight: (idToUpdate: string, edit: Partial<CommentedHighlight>) => void;
		onContextMenu?: (event: MouseEvent, highlight: ViewportHighlight<CommentedHighlight>) => void;
		onClick?: (event: MouseEvent, highlight: ViewportHighlight<CommentedHighlight>) => void;
		pdfHighlighterUtils: Partial<TPdfHighlighterUtils>;
		highlightMixBlendMode?: string;
	}

	interface HighlightUtilsContext {
		highlight: ViewportHighlight<CommentedHighlight>;
		viewportToScaled: (rect: LTWHP) => Scaled;
		screenshot: (boundingRect: LTWHP) => string;
		highlightBindings: { textLayer?: Element };
	}

	let {
		editHighlight,
		onContextMenu,
		onClick,
		pdfHighlighterUtils,
		highlightMixBlendMode = 'normal'
	}: HighlightContainerProps = $props();

	//context set in HighLightLayer
	let { highlight, viewportToScaled, screenshot, highlightBindings }: HighlightUtilsContext =
		getContext('highlightUtils'); //HighlightContext

	//const { toggleEditInProgress } = pdfHighlighterUtils; //usePdfHighlighterContext();
	let highlightTip: Tip = $state({
		position: highlight.position,
		content: { highlight }
	});
	//onMount(() => {
	//console.log('H.container mount');
	//return console.log('H.container unmount');
	//});
</script>

<MonitoredHighlightContainer {highlightTip} {pdfHighlighterUtils}>
	{#if highlight.type === 'text'}
		<TextHighlight
			{highlight}
			onContextMenu={(event) => onContextMenu?.(event, highlight)}
			onClick={(event) => {
				onClick?.(event, highlight);
			}}
			{pdfHighlighterUtils}
			highlightMixBlendMode={pdfHighlighterUtils.highlightMixBlendMode ?? highlightMixBlendMode}
		/>
	{:else}
		<AreaHighlight
			{highlight}
			onChange={(boundingRect) => {
				if (!highlight.id) return;
				const edit = {
					position: {
						boundingRect: viewportToScaled(boundingRect),
						rects: []
					},
					content: {
						image: screenshot(boundingRect)
					}
				};
				editHighlight(highlight.id, edit);
				//toggleEditInProgress(false);
			}}
			bounds={highlightBindings.textLayer}
			onContextMenu={(event) => onContextMenu?.(event, highlight)}
			onClick={(event) => onClick?.(event, highlight)}
			{pdfHighlighterUtils}
			highlightMixBlendMode={pdfHighlighterUtils.highlightMixBlendMode ?? highlightMixBlendMode}
			isDraggable={false}
		/>
	{/if}
</MonitoredHighlightContainer>
