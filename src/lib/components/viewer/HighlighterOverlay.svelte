<script lang="ts">
	import { fly, fade } from 'svelte/transition';
	import { Button } from '$lib/components/ui/button';
	import { Settings, ChevronDown } from '@lucide/svelte';
	import { cn } from '$lib/utils';

	interface Props {
		activeColor: string;
		activeColorName: string;
		categoryLabels: string[];
		colors: string[];
		decorative: boolean;
		onColorSelect?: (index: number) => void;
	}

	let {
		activeColor,
		activeColorName,
		categoryLabels,
		colors,
		decorative,
		onColorSelect
	}: Props = $props();

	let isExpanded = $state(false);
</script>

<div
	transition:fly={{ y: -6, duration: 200 }}
	class="absolute left-1/2 top-full z-50 -translate-x-1/2 pt-1.5"
>
	<div
		class="w-fit min-w-[140px] overflow-hidden rounded-xl border border-border bg-popover shadow-md ring-1 ring-black/5"
	>
		<!-- Color Row + Toggle -->
		<div class="flex items-center gap-2.5 p-2 px-3">
			<div class="flex items-center justify-center gap-1.5">
				{#each colors as color, i}
					<button
						type="button"
						class={cn(
							"size-5 rounded-full border border-border transition-all hover:scale-110 active:scale-95",
							activeColor === color ? "ring-1 ring-border ring-offset-1 ring-offset-popover scale-110 shadow-sm" : "opacity-80 hover:opacity-100"
						)}
						style="background-color: {color}"
						onclick={() => onColorSelect?.(i)}
						title={categoryLabels[i] || `Slot ${i + 1}`}
						aria-label={categoryLabels[i] || `Slot ${i + 1}`}
					></button>
				{/each}
			</div>

			<div class="h-4 w-[1px] bg-border/50"></div>

			<button 
				type="button"
				class="flex size-5 items-center justify-center rounded-full text-muted-foreground transition-all hover:bg-muted hover:text-foreground"
				onclick={() => (isExpanded = !isExpanded)}
				aria-label="Toggle semantics"
			>
				<ChevronDown 
					class={cn("size-3.5 transition-transform duration-200", isExpanded && "rotate-180")} 
				/>
			</button>
		</div>

		<!-- Expanded Mapping UI -->
		{#if isExpanded}
			<div transition:fade={{ duration: 150 }} class="border-t border-border bg-muted/20">
				<div class="grid grid-cols-1 divide-y divide-border/50 px-1 py-1 min-w-[180px]">
					{#each colors as color, i}
						<button
							type="button"
							class={cn(
								"group flex items-center justify-between px-2 py-1.5 transition-colors hover:bg-accent/50 text-left rounded-md",
								activeColor === color && "bg-accent/80"
							)}
							onclick={() => onColorSelect?.(i)}
						>
							<div class="flex items-center gap-2">
								<div class="size-3 rounded-full shadow-sm border border-border" style="background-color: {color}"></div>
								<span class="text-xs font-medium">
									{categoryLabels[i] || `Slot ${i + 1}`}
								</span>
							</div>
							{#if activeColor === color}
								<div class="size-1.5 rounded-full bg-primary"></div>
							{/if}
						</button>
					{/each}
				</div>

				<div class="border-t border-border p-2">
					<Button
						variant="outline"
						size="sm"
						class="h-8 w-full justify-center gap-2 bg-background text-[11px] font-medium shadow-xs hover:bg-accent rounded-lg border-muted-foreground/20"
					>
						<Settings class="size-3" />
						Configure
					</Button>
				</div>
			</div>
		{/if}
	</div>
</div>

