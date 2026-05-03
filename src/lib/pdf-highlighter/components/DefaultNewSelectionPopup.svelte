<script lang="ts">
	import type { Highlight } from '../types';
	import { Copy, Sparkles, Check } from '@lucide/svelte';
	import { fade, fly } from 'svelte/transition';

	let {
		highlight,
		colors,
		onAddHighlight,
		clearTextSelection,
		onClose,
		selectedTool
	}: {
		highlight: Highlight;
		colors: string[];
		onAddHighlight: (highlight: Highlight) => void;
		clearTextSelection: () => void;
		onClose: () => void;
		selectedTool?: string;
	} = $props();

	let copied = $state(false);

	function handleCopy() {
		if (highlight.content?.text) {
			navigator.clipboard.writeText(highlight.content.text);
			copied = true;
			setTimeout(() => {
				copied = false;
			}, 1200);
		}
	}
</script>

<div class="Highlight__popup">
	{#if selectedTool !== 'text_selection'}
		{#each colors as color, index (color + index)}
			<button
				type="button"
				class="color"
				aria-label="New highlight color {index + 1}"
				onclick={() => {
					if (!highlight.id) {
						highlight.color_index = index;
						onAddHighlight(highlight);
					}
				}}
				style="background-color: {color}"
				onpointerdown={(e) => {
					e.preventDefault();
					e.stopPropagation();
				}}
				onpointerup={(e) => {
					e.preventDefault();
					e.stopPropagation();
				}}
			></button>
		{/each}
	{/if}

	<button class="TipButton" class:copied onclick={handleCopy}>
		<div class="icon-container">
			{#if copied}
				<div class="icon-abs" in:fly={{ y: 10, duration: 300 }} out:fade={{ duration: 150 }}>
					<Check size={14} class="text-green-500" />
				</div>
			{:else}
				<div class="icon-abs" in:fly={{ y: -10, duration: 300 }} out:fade={{ duration: 150 }}>
					<Copy size={14} />
				</div>
			{/if}
		</div>

		<div class="text-animate-wrapper" style="grid-template-columns: {copied ? '1fr' : '1fr'};">
			<div class="text-inner">
				{#if copied}
					<span class="button-text" in:fade={{ duration: 200, delay: 100 }}>Copied</span>
				{:else}
					<span class="button-text" in:fade={{ duration: 200, delay: 100 }}>Copy</span>
				{/if}
			</div>
		</div>
	</button>

	<div class="separator"></div>

	<button class="TipButton disabled" disabled>
		<div class="icon-wrapper">
			<Sparkles size={14} />
		</div>
		<span class="button-text">Ask AI</span>
	</button>
</div>
