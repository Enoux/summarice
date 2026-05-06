<script lang="ts">
	import type { ProcessedOutlineItem } from '$lib/pdf-highlighter/types';
	import Self from './OutlineItem.svelte';
	import { ChevronDown, ChevronRight } from '@lucide/svelte';
	import { cn } from '$lib/utils';

	interface Props {
		item: ProcessedOutlineItem;
		currentPage: number;
		activeId?: string | null;
		onNavigate: (item: ProcessedOutlineItem) => void;
		depth?: number;
	}

	let { item, currentPage, activeId = null, onNavigate, depth = 0 }: Props = $props();

	let expanded = $state(true);

	// Check if this item is active or contains the active child
	function isAncestorOf(parent: ProcessedOutlineItem, id: string): boolean {
		if (parent.id === id) return true;
		for (const child of parent.children) {
			if (isAncestorOf(child, id)) return true;
		}
		return false;
	}

	const isActive = $derived(item.id === activeId);
	const isAncestorActive = $derived(activeId ? isAncestorOf(item, activeId) : false);
</script>

<div class="group/item flex flex-col">
	<div
		class={cn(
			'relative flex w-full items-center gap-1.5 px-2 py-1.5 transition-all duration-200',
			'cursor-pointer rounded-md text-left text-sm leading-snug',
			isActive
				? 'bg-accent/60 font-medium text-foreground'
				: isAncestorActive
					? 'bg-accent/20 text-foreground'
					: 'text-muted-foreground hover:bg-accent/40 hover:text-accent-foreground'
		)}
		style:padding-left={`${depth * 12 + 24}px`}
		data-page={item.pageNumber}
		data-outline-id={item.id}
		onclick={() => onNavigate(item)}
		role="button"
		tabindex="0"
		onkeydown={(e) => e.key === 'Enter' && onNavigate(item)}
	>
		{#if item.children.length > 0}
			<button
				type="button"
				class="flex size-5 shrink-0 items-center justify-center rounded-sm transition-colors hover:bg-accent-foreground/10"
				onclick={(e) => {
					e.preventDefault();
					e.stopPropagation();
					expanded = !expanded;
				}}
				aria-label={expanded ? 'Collapse' : 'Expand'}
			>
				{#if expanded}
					<ChevronDown class="size-3.5" />
				{:else}
					<ChevronRight class="size-3.5" />
				{/if}
			</button>
		{:else}
			<div class="size-5 shrink-0"></div>
		{/if}
		<span class={cn('truncate', item.bold && 'font-bold', item.italic && 'italic')}>
			{item.title}
		</span>
	</div>
	{#if expanded && item.children.length > 0}
		{#each item.children as child (child.id)}
			<Self item={child} {currentPage} {activeId} {onNavigate} depth={depth + 1} />
		{/each}
	{/if}
</div>
