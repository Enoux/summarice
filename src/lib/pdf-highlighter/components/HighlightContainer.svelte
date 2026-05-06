<script lang="ts">
	//import { pdfHighlighterUtils } from '$lib/pdf-highlighter/components/pdfHighlighterUtils.shared.svelte.ts';
	import AreaHighlight from '$lib/pdf-highlighter/components/AreaHighlight.svelte';
	import TextHighlight from '$lib/pdf-highlighter/components/TextHighlight.svelte';
	import MonitoredHighlightContainer from '$lib/pdf-highlighter/components/MonitoredHighlightContainer.svelte';

	import { getContext } from 'svelte';
	import type {
		CommentedHighlight,
		HighlightAdjustmentDraft,
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
		adjustmentDraft?: HighlightAdjustmentDraft | null;
		onUpdateAdjustmentDraft?: (draft: HighlightAdjustmentDraft) => void;
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
		highlightMixBlendMode = 'normal',
		adjustmentDraft,
		onUpdateAdjustmentDraft
	}: HighlightContainerProps = $props();

	//context set in HighLightLayer
	let { highlight, viewportToScaled, screenshot, highlightBindings }: HighlightUtilsContext =
		getContext('highlightUtils'); //HighlightContext

	//const { toggleEditInProgress } = pdfHighlighterUtils; //usePdfHighlighterContext();
	const isAdjustingThisHighlight = $derived(adjustmentDraft?.highlightId === highlight.id);
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
				if (!isAdjustingThisHighlight || !adjustmentDraft) return;
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
				onUpdateAdjustmentDraft?.({
					...adjustmentDraft,
					position: edit.position,
					image: edit.content.image
				});
				//toggleEditInProgress(false);
			}}
			bounds={highlightBindings.textLayer}
			onContextMenu={(event) => onContextMenu?.(event, highlight)}
			onClick={(event) => onClick?.(event, highlight)}
			{pdfHighlighterUtils}
			highlightMixBlendMode={pdfHighlighterUtils.highlightMixBlendMode ?? highlightMixBlendMode}
			isDraggable={isAdjustingThisHighlight}
		/>
	{/if}
</MonitoredHighlightContainer>
