<script lang="ts">
	import type { PdfHighlighterUtils } from '$lib/pdf-highlighter/types';
	import { ZoomOut, ZoomIn, RotateCcw } from '@lucide/svelte';
	import { Button } from '$lib/components/ui/button';
	import { Slider } from '$lib/components/ui/slider';
	import * as Tooltip from '$lib/components/ui/tooltip';
	import {
		MAX_ZOOM_SCALE,
		MIN_ZOOM_SCALE,
		ZOOM_STEP,
		normalizeZoomScale,
		zoomIn,
		zoomOut
	} from '$lib/pdf-highlighter/lib/zoom';

	interface Props {
		utils: Partial<PdfHighlighterUtils>;
	}

	let { utils }: Props = $props();

	const scale = $derived.by(() => {
		const s = utils.currentScale;
		if (typeof s === 'number' && !Number.isNaN(s)) {
			return normalizeZoomScale(s);
		}
		return 1;
	});

	function applyZoom(v: number) {
		utils.setCurrentScaleValue?.(normalizeZoomScale(v));
	}
</script>

<div class="flex items-center gap-2 rounded-lg border bg-muted/40 px-2 py-1">
	<Tooltip.Root>
		<Tooltip.Trigger>
			{#snippet child({ props })}
				<Button
					{...props}
					variant="ghost"
					size="icon"
					class="size-8"
					aria-label="Zoom out"
					onclick={() => applyZoom(zoomOut(scale))}
				>
					<ZoomOut class="size-4" />
				</Button>
			{/snippet}
		</Tooltip.Trigger>
		<Tooltip.Content side="bottom">Zoom out</Tooltip.Content>
	</Tooltip.Root>
	<Slider
		min={MIN_ZOOM_SCALE}
		max={MAX_ZOOM_SCALE}
		step={ZOOM_STEP}
		value={scale}
		onValueChange={applyZoom}
		aria-label="Zoom"
		class="w-28"
	/>
	<Tooltip.Root>
		<Tooltip.Trigger>
			{#snippet child({ props })}
				<Button
					{...props}
					variant="ghost"
					size="icon"
					class="size-8"
					aria-label="Zoom in"
					onclick={() => applyZoom(zoomIn(scale))}
				>
					<ZoomIn class="size-4" />
				</Button>
			{/snippet}
		</Tooltip.Trigger>
		<Tooltip.Content side="bottom">Zoom in</Tooltip.Content>
	</Tooltip.Root>
	<span class="w-10 text-center text-xs text-muted-foreground tabular-nums"
		>{scale.toFixed(2)}×</span
	>
	<Tooltip.Root>
		<Tooltip.Trigger>
			{#snippet child({ props })}
				<Button
					{...props}
					variant="ghost"
					size="icon"
					class="size-8"
					aria-label="Reset zoom"
					onclick={() => utils.setCurrentScaleValue?.('auto')}
				>
					<RotateCcw class="size-4" />
				</Button>
			{/snippet}
		</Tooltip.Trigger>
		<Tooltip.Content side="bottom">Fit page</Tooltip.Content>
	</Tooltip.Root>
</div>
