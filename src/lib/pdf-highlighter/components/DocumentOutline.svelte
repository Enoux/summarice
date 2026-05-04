<script lang="ts">
	import type { ProcessedOutlineItem } from '$lib/pdf-highlighter/types';
	import OutlineItem from './OutlineItem.svelte';
	import { Loader2, Bookmark } from '@lucide/svelte';

	interface Props {
		outline: ProcessedOutlineItem[] | null;
		isLoading?: boolean;
		currentPage?: number;
		lastNavigatedId?: string | null;
		onNavigate: (item: ProcessedOutlineItem) => void;
	}

	let { outline, isLoading = false, currentPage = 1, lastNavigatedId = null, onNavigate }: Props = $props();

	let containerEl = $state<HTMLDivElement | null>(null);
	let indicatorTop = $state(0);
	let indicatorHeight = $state(0);
	const activeItem = $derived.by(() => {
		if (!outline || outline.length === 0) return null;
		
		const flat: ProcessedOutlineItem[] = [];
		function flatten(items: ProcessedOutlineItem[]) {
			for (const item of items) {
				flat.push(item);
				if (item.children && item.children.length > 0) {
					flatten(item.children);
				}
			}
		}
		flatten(outline);

		// If we have a manually navigated ID on this page, prioritize it
		if (lastNavigatedId) {
			const navItem = flat.find((item) => item.id === lastNavigatedId && item.pageNumber === currentPage);
			if (navItem) return navItem;
		}

		// Find the most appropriate item for the current page
		// First try to find the first item that is ON the current page
		const itemsOnPage = flat.filter((item) => item.pageNumber === currentPage);
		if (itemsOnPage.length > 0) {
			return itemsOnPage[0];
		}

		// If no item on current page, find the last item BEFORE the current page
		const itemsBefore = flat.filter((item) => item.pageNumber < currentPage);
		if (itemsBefore.length > 0) {
			return itemsBefore[itemsBefore.length - 1];
		}

		return flat[0] || null;
	});

	let activeId = $derived(activeItem?.id ?? null);
	let visualActiveId = $state<string | null>(null);

	// Debounce the visual active ID for the indicator and auto-scroll
	// This prevents the indicator from jumping around during fast scrolling
	$effect(() => {
		const id = activeId;
		const timeout = setTimeout(() => {
			visualActiveId = id;
		}, 100); // Increased debounce for smoother tracking
		return () => clearTimeout(timeout);
	});

	function handleNavigate(item: ProcessedOutlineItem) {
		// Set instantly for manual navigation
		visualActiveId = item.id;
		onNavigate(item);
	}

	// Move the indicator and auto-scroll
	$effect(() => {
		if (!containerEl || !visualActiveId) {
			indicatorHeight = 0;
			indicatorTop = 0;
			return;
		}

		const activeEl = containerEl.querySelector(`[data-outline-id="${visualActiveId}"]`) as HTMLElement | null;
		if (activeEl) {
			// Update indicator position
			indicatorTop = activeEl.offsetTop;
			indicatorHeight = activeEl.offsetHeight;

			// Decoupled scrolling: only scroll if the active element is not comfortably in view.
			// This "lazy" scroll approach minimizes the number of jumps.
			const parentRect = containerEl.getBoundingClientRect();
			const activeRect = activeEl.getBoundingClientRect();
			
			// Check if it's within a safe middle zone (40px buffer from edges)
			const isVisible = 
				activeRect.top >= parentRect.top + 40 && 
				activeRect.bottom <= parentRect.bottom - 40;

			if (!isVisible) {
				activeEl.scrollIntoView({
					behavior: 'smooth',
					block: 'nearest'
				});
			}
		}
	});
</script>

<div class="flex min-h-0 flex-1 flex-col overflow-hidden">
	{#if isLoading}
		<div class="flex flex-1 flex-col items-center justify-center gap-2 p-6 text-center text-sm text-muted-foreground">
			<Loader2 class="size-5 animate-spin" />
			<span>Loading outline…</span>
		</div>
	{:else if !outline || outline.length === 0}
		<div class="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center text-sm text-muted-foreground">
			<div class="flex size-10 items-center justify-center rounded-full bg-muted">
				<Bookmark class="size-5" />
			</div>
			<div class="space-y-1">
				<p class="font-medium text-foreground">No outline found</p>
				<p class="text-xs">This PDF doesn't have any bookmarks.</p>
			</div>
		</div>
	{:else}
		<div
			bind:this={containerEl}
			class="minimal-scrollbar relative min-h-0 flex-1 overflow-y-auto px-2 py-3"
		>
			<!-- Progress Track -->
			<div class="absolute left-[13px] top-3 bottom-3 w-px bg-border/40"></div>

			<!-- Floating Indicator -->
			{#if indicatorHeight > 0}
				<div
					class="z-20 absolute left-[12px] w-1 rounded-full bg-primary transition-all duration-500 ease-[cubic-bezier(0.2,0.8,0.2,1)]"
					style:top="{indicatorTop}px"
					style:height="{indicatorHeight}px"
				></div>
			{/if}

			{#each outline as item (item.id)}
				<OutlineItem {item} {currentPage} {activeId} onNavigate={handleNavigate} />
			{/each}
		</div>
	{/if}
</div>
