<script lang="ts">
	import type { Highlight } from '$lib/pdf-highlighter/types';
	import { HighlightsModel } from '$lib/pdf-highlighter';
	import HighlightListItem from './HighlightListItem.svelte';
	import { Search, RotateCcw, MessageSquare, LayoutList } from '@lucide/svelte';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { ScrollArea } from '$lib/components/ui/scroll-area/index.js';
	import { Separator } from '$lib/components/ui/separator/index.js';
	import { onMount } from 'svelte';

	interface Props {
		highlightsStore: HighlightsModel<Highlight>;
		onJump: (h: Highlight) => void;
		isOpen?: boolean;
		width?: number;
		categoryLabels: string[];
		decorativeMode: boolean;
		onPersistDelete: (h: Highlight) => Promise<void>;
		onRecategorize: (h: Highlight, category: number | null, color: string) => Promise<void>;
		onResetAll?: () => Promise<void>;
	}

	let {
		highlightsStore,
		onJump,
		isOpen = $bindable(true),
		width = $bindable(420),
		categoryLabels,
		decorativeMode,
		onPersistDelete,
		onRecategorize,
		onResetAll
	}: Props = $props();

	let query = $state('');
	let activeTab = $state('highlights');
	let isResizing = $state(false);

	const filtered = $derived.by(() => {
		const q = query.trim().toLowerCase();
		let list = [...highlightsStore.highlights];
		list.sort((a, b) => (a.ordinal ?? 0) - (b.ordinal ?? 0));
		if (!q) return list;
		return list.filter((h: Highlight) => {
			const text = h.content?.text?.toLowerCase() ?? '';
			const com = h.comment?.toLowerCase() ?? '';
			return text.includes(q) || com.includes(q) || (h.id?.toLowerCase().includes(q) ?? false);
		});
	});

	function jump(h: Highlight) {
		if (h.id) {
			location.hash = `highlight-${h.id}`;
		}
		onJump(h);
	}

	async function deleteOne(h: Highlight) {
		try {
			await onPersistDelete(h);
			highlightsStore.deleteHighlight(h);
		} catch (e) {
			console.error(e);
		}
	}

	function startResizing(e: MouseEvent) {
		isResizing = true;
		e.preventDefault();
	}

	function stopResizing() {
		isResizing = false;
	}

	function handleMouseMove(e: MouseEvent) {
		if (!isResizing) return;
		const newWidth = window.innerWidth - e.clientX;
		if (newWidth > 200 && newWidth < 800) {
			width = newWidth;
		}
	}

	onMount(() => {
		window.addEventListener('mousemove', handleMouseMove);
		window.addEventListener('mouseup', stopResizing);
		return () => {
			window.removeEventListener('mousemove', handleMouseMove);
			window.removeEventListener('mouseup', stopResizing);
		};
	});
</script>

<!-- Resize handle -->
{#if isOpen}
	<div
		class="group relative flex w-1 cursor-col-resize items-center justify-center bg-border transition-colors hover:bg-primary"
		onmousedown={startResizing}
		role="separator"
		aria-label="Resize sidebar"
	>
		<div class="absolute h-8 w-1.5 rounded-full bg-border group-hover:bg-primary-foreground/50"></div>
	</div>
{/if}

<aside
	class="flex h-full shrink-0 flex-col border-l border-border bg-card transition-[width] duration-300"
	class:hidden={!isOpen}
	style:width="{width}px"
	aria-label="Sidebar"
>
	<div class="flex h-full flex-col overflow-hidden">
		<!-- Tabs Header -->
		<div class="flex items-center justify-around border-b border-border bg-muted/30">
			<button
				class="flex flex-1 items-center justify-center gap-2 py-3 text-sm font-medium transition-colors hover:text-primary"
				class:text-primary={activeTab === 'highlights'}
				class:border-b-2={activeTab === 'highlights'}
				class:border-primary={activeTab === 'highlights'}
				onclick={() => (activeTab = 'highlights')}
			>
				<LayoutList class="size-4" />
				Highlights
			</button>
			<button
				class="flex flex-1 items-center justify-center gap-2 py-3 text-sm font-medium transition-colors hover:text-primary"
				class:text-primary={activeTab === 'summary'}
				class:border-b-2={activeTab === 'summary'}
				class:border-primary={activeTab === 'summary'}
				onclick={() => (activeTab = 'summary')}
			>
				<MessageSquare class="size-4" />
				Summary
			</button>
		</div>

		{#if activeTab === 'highlights'}
			<div class="flex items-center gap-2 border-b border-border p-3">
				<Search class="size-4 shrink-0 text-muted-foreground" />
				<Input type="search" bind:value={query} placeholder="Search highlights…" class="flex-1" />
			</div>

			<ScrollArea class="min-h-0 flex-1" orientation="vertical">
				<div class="flex flex-col gap-2 p-3" role="list">
					{#each filtered as h (h.id)}
						<HighlightListItem
							highlight={h}
							onJump={jump}
							onDelete={deleteOne}
							onRecategorize={onRecategorize}
							{categoryLabels}
							{decorativeMode}
						/>
					{:else}
						<div class="flex flex-col items-center justify-center space-y-3 py-20 text-center">
							<div class="rounded-full bg-muted p-4">
								<LayoutList class="size-8 text-muted-foreground/40" />
							</div>
							<div class="space-y-1">
								<p class="text-sm font-medium">No highlights yet</p>
								<p class="text-muted-foreground max-w-[200px] text-xs">
									Select text or an area in the PDF to create your first highlight.
								</p>
							</div>
						</div>
					{/each}
				</div>
			</ScrollArea>

			<Separator />

			{#if onResetAll}
				<div class="p-3">
					<Button
						variant="outline"
						size="sm"
						class="text-muted-foreground hover:text-destructive w-full gap-2"
						onclick={() => onResetAll()}
					>
						<RotateCcw class="size-3.5" />
						Delete all highlights
					</Button>
				</div>
			{/if}
		{:else}
			<div class="flex flex-1 flex-col items-center justify-center space-y-4 p-6 text-center">
				<div class="rounded-full bg-muted p-5">
					<MessageSquare class="text-muted-foreground/30 size-10" />
				</div>
				<div class="space-y-2">
					<h3 class="text-lg font-semibold">Generate Summary</h3>
					<p class="text-muted-foreground max-w-[240px] text-sm">
						Summarice can organize your highlights into a structured document. Add some highlights
						first!
					</p>
				</div>
				<Button variant="secondary" disabled class="mt-4">Generate (Coming soon)</Button>
			</div>
		{/if}
	</div>
</aside>
