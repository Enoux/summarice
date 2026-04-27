<script lang="ts">
	import type { PdfHighlighterUtils } from '$lib/pdf-highlighter/types';
	import { ZoomOut, ZoomIn, RotateCcw } from '@lucide/svelte';
	import { Button } from '$lib/components/ui/button';
	import { Slider } from '$lib/components/ui/slider';
	import * as Tooltip from '$lib/components/ui/tooltip';

	interface Props {
		utils: Partial<PdfHighlighterUtils>;
	}

	let { utils }: Props = $props();

	const scale = $derived.by(() => {
		const s = utils.currentScale;
		if (typeof s === 'number' && !Number.isNaN(s)) {
			return Math.min(3, Math.max(0.5, s));
		}
		return 1;
	});

	function applyZoom(v: number) {
		const rounded = Math.round(v * 10) / 10;
		utils.setCurrentScaleValue?.(rounded);
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
					onclick={() => applyZoom(Math.max(0.5, scale - 0.1))}
				>
					<ZoomOut class="size-4" />
				</Button>
			{/snippet}
		</Tooltip.Trigger>
		<Tooltip.Content side="bottom">Zoom out</Tooltip.Content>
	</Tooltip.Root>
	<Slider
		min={0.5}
		max={3}
		step={0.05}
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
					onclick={() => applyZoom(Math.min(3, scale + 0.1))}
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
