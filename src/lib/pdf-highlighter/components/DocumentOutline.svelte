<script lang="ts">
	import type { ProcessedOutlineItem } from '$lib/pdf-highlighter/types';
	import OutlineItem from './OutlineItem.svelte';

	interface Props {
		outline: ProcessedOutlineItem[] | null;
		isLoading?: boolean;
		currentPage?: number;
		onNavigate: (item: ProcessedOutlineItem) => void;
	}

	let { outline, isLoading = false, currentPage = 1, onNavigate }: Props = $props();
</script>

<div class="flex min-h-0 flex-1 flex-col overflow-hidden">
	{#if isLoading}
		<div
			class="flex flex-1 flex-col items-center justify-center gap-2 p-6 text-[13px] text-[var(--lp-muted)]"
		>
			<span
				class="h-5 w-5 animate-spin rounded-full border-2 border-[var(--lp-border)] border-t-[var(--lp-accent)]"
			></span>
			Loading outline…
		</div>
	{:else if !outline || outline.length === 0}
		<div
			class="flex flex-1 flex-col items-center justify-center gap-1 p-6 text-center text-[13px] text-[var(--lp-muted)]"
		>
			<p class="font-medium text-[var(--lp-text)]">No outline</p>
			<p>This PDF has no bookmarks.</p>
		</div>
	{:else}
		<div class="min-h-0 flex-1 overflow-y-auto px-1 py-2">
			{#each outline as item (item.id)}
				<OutlineItem {item} {currentPage} {onNavigate} />
			{/each}
		</div>
	{/if}
</div>
