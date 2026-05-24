<script lang="ts">
	import type { DeepLibrarySearchMode } from '$lib/search/deep-library-search-types';
	import { cn } from '$lib/utils.js';

	const CHIP_BASE_CLASS =
		'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-sm font-medium leading-tight transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';

	let {
		searchMode = $bindable('fast' as DeepLibrarySearchMode),
		class: className
	}: {
		searchMode?: DeepLibrarySearchMode;
		class?: string;
	} = $props();

	const isAiSearchEnabled = $derived(searchMode === 'deep');

	function toggleAiSearch(): void {
		searchMode = isAiSearchEnabled ? 'fast' : 'deep';
	}
</script>

<button
	type="button"
	role="switch"
	aria-checked={isAiSearchEnabled}
	aria-label="Summarice AI"
	class={cn(
		CHIP_BASE_CLASS,
		isAiSearchEnabled
			? 'border-primary/30 bg-primary/5 text-foreground shadow-sm'
			: 'border-dashed border-border/80 bg-muted/40 text-muted-foreground hover:bg-muted hover:text-foreground',
		className
	)}
	onclick={toggleAiSearch}
>
	<img
		src="/summarice.svg"
		alt=""
		class="size-3 shrink-0 object-contain"
		aria-hidden="true"
	/>
	<span>Summarice AI</span>
</button>
