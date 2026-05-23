<script lang="ts">
	import type { ProcessedOutlineItem } from '$lib/pdf-highlighter/types';
	import { flattenOutline } from '$lib/pdf-highlighter/hooks/document-outline';
	import {
		resolveActiveOutlineItem,
		type OutlineViewLocation
	} from '$lib/pdf-highlighter/lib/outline-active-item';
	import OutlineItem from './OutlineItem.svelte';
	import { Loader2, Bookmark } from '@lucide/svelte';
	import { cn } from '$lib/utils';

	interface Props {
		outline: ProcessedOutlineItem[] | null;
		isLoading?: boolean;
		viewLocation: OutlineViewLocation;
		readingOffsetPdf: number;
		currentPage?: number;
		lastNavigatedId?: string | null;
		scrollReady?: boolean;
		onNavigate: (item: ProcessedOutlineItem) => void;
	}

	let {
		outline,
		isLoading = false,
		viewLocation,
		readingOffsetPdf,
		currentPage = 1,
		lastNavigatedId = null,
		scrollReady = true,
		onNavigate
	}: Props = $props();

	let containerEl = $state<HTMLDivElement | null>(null);
	let indicatorTop = $state(0);
	let indicatorHeight = $state(0);

	const activeItem = $derived.by(() => {
		if (!outline || outline.length === 0) return null;
		const flat = flattenOutline(outline);
		return resolveActiveOutlineItem(flat, {
			viewLocation,
			readingOffsetPdf,
			pinnedId: lastNavigatedId
		});
	});

	let activeId = $derived(activeItem?.id ?? null);
	let visualActiveId = $state<string | null>(null);

	$effect(() => {
		const id = activeId;
		const timeout = setTimeout(() => {
			visualActiveId = id;
		}, 100);
		return () => clearTimeout(timeout);
	});

	function handleNavigate(item: ProcessedOutlineItem) {
		visualActiveId = item.id;
		onNavigate(item);
	}

	$effect(() => {
		if (!scrollReady || !containerEl || !visualActiveId) {
			indicatorHeight = 0;
			indicatorTop = 0;
			return;
		}

		const activeEl = containerEl.querySelector(`[data-outline-id="${visualActiveId}"]`) as HTMLElement | null;
		if (activeEl) {
			indicatorTop = activeEl.offsetTop;
			indicatorHeight = activeEl.offsetHeight;

			const parentRect = containerEl.getBoundingClientRect();
			const activeRect = activeEl.getBoundingClientRect();

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
			class={cn(
				'relative min-h-0 flex-1 px-2 py-3',
				scrollReady ? 'minimal-scrollbar overflow-y-auto' : 'overflow-hidden'
			)}
		>
			<div class="absolute left-[13px] top-3 bottom-3 w-px bg-border/40"></div>

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
