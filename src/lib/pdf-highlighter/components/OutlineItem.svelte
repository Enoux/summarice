<script lang="ts">
	import type { ProcessedOutlineItem } from '$lib/pdf-highlighter/types';
	import Self from './OutlineItem.svelte';

	interface Props {
		item: ProcessedOutlineItem;
		currentPage: number;
		onNavigate: (item: ProcessedOutlineItem) => void;
		depth?: number;
	}

	let { item, currentPage, onNavigate, depth = 0 }: Props = $props();

	let expanded = $state(true);
	const isActive = $derived(item.pageNumber === currentPage);
</script>

<div class="outline-item" style:padding-left={`${depth * 12}px`}>
	<button
		type="button"
		class="flex w-full items-start gap-1 rounded-md px-2 py-1.5 text-left text-[13px] leading-snug transition-colors hover:bg-[var(--lp-hover)]"
		class:bg-[var(--lp-accent)]={isActive}
		class:!text-white={isActive}
		class:text-[var(--lp-text)]={!isActive}
		onclick={() => onNavigate(item)}
	>
		{#if item.children.length > 0}
			<span
				class="mt-0.5 shrink-0 text-[var(--lp-muted)]"
				onclick={(e) => {
					e.preventDefault();
					e.stopPropagation();
					expanded = !expanded;
				}}
				role="presentation"
			>
				{expanded ? '▼' : '▶'}
			</span>
		{:else}
			<span class="w-3 shrink-0"></span>
		{/if}
		<span class:font-bold={item.bold} class:italic={item.italic}>{item.title}</span>
	</button>
	{#if expanded && item.children.length > 0}
		{#each item.children as child (child.id)}
			<Self item={child} {currentPage} {onNavigate} depth={depth + 1} />
		{/each}
	{/if}
</div>
