<script lang="ts">
	import type { CommentedHighlight } from '$lib/pdf-highlighter/types';
	import type { PdfHighlighterUtils } from '$lib/pdf-highlighter';
	import { HighlightsModel } from '$lib/pdf-highlighter';
	import HighlightListItem from '$lib/features/highlights/components/HighlightListItem.svelte';
	import { Search, RotateCcw, MessageSquare, LayoutList } from '@lucide/svelte';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { Separator } from '$lib/components/ui/separator/index.js';
	import { onMount } from 'svelte';
	import Summary from '$lib/features/summary/components/Summary.svelte';
	import { buildHighlightLexicalCorpus } from '$lib/search/highlight-lexical-corpus';
	import {
		matchesHighlightLexical,
		scoreHighlightLexical
	} from '$lib/search/highlight-lexical-match';
	import { parseWebsearchQuery } from '$lib/search/websearch-query';

	interface Props {
		highlightsStore: HighlightsModel<CommentedHighlight>;
		onSelectHighlight: (h: CommentedHighlight) => void;
		isOpen?: boolean;
		width?: number;
		categoryLabels: string[];
		decorativeMode: boolean;
		viewerColorMode: 'light' | 'dark';
		onPersistDelete: (h: CommentedHighlight) => Promise<void>;
		onRecategorize: (
			h: CommentedHighlight,
			category: number | null,
			color: string
		) => Promise<void>;
		onResetAll?: () => Promise<void>;
		onAddAnnotation: (h: CommentedHighlight, body: string) => Promise<void>;
		onUpdateAnnotation: (h: CommentedHighlight, id: string, body: string) => Promise<void>;
		onDeleteAnnotation: (h: CommentedHighlight, id: string) => Promise<void>;

		selectedHighlightId?: string | null;
		activeTab?: 'highlights' | 'summary';
		viewerUtils?: Partial<PdfHighlighterUtils>;
	}

	let {
		highlightsStore,
		onSelectHighlight,
		isOpen = $bindable(true),
		width = $bindable(420),
		categoryLabels,
		decorativeMode,
		viewerColorMode,
		onPersistDelete,
		onRecategorize,
		onResetAll,
		onAddAnnotation,
		onUpdateAnnotation,
		onDeleteAnnotation,

		selectedHighlightId = $bindable(null),
		activeTab = $bindable('highlights'),
		viewerUtils
	}: Props = $props();

	let query = $state('');
	let isResizing = $state(false);

	let activeSummaryCitations = $state<any[]>([]);
	let summaryHighlightIdToScrollTo = $state<string | null>(null);

	const citationCounts = $derived.by(() => {
		const counts: Record<string, number> = {};
		for (const c of activeSummaryCitations) {
			if (c.highlight_id) {
				counts[c.highlight_id] = (counts[c.highlight_id] || 0) + 1;
			}
		}
		return counts;
	});

	const parsedQuery = $derived(parseWebsearchQuery(query));

	const filtered = $derived.by((): CommentedHighlight[] => {
		const list = [...highlightsStore.highlights];
		const trimmedQuery = query.trim();

		if (trimmedQuery.length === 0) {
			list.sort((a, b) => (a.ordinal ?? 0) - (b.ordinal ?? 0));
			return list;
		}

		const scored = list
			.map((highlight) => {
				const corpus = buildHighlightLexicalCorpus(highlight);
				if (!matchesHighlightLexical(corpus, parsedQuery)) {
					return null;
				}
				return {
					highlight,
					score: scoreHighlightLexical(corpus, parsedQuery)
				};
			})
			.filter((entry): entry is { highlight: CommentedHighlight; score: number } => entry !== null);

		scored.sort((a, b) => {
			if (b.score !== a.score) {
				return b.score - a.score;
			}
			return (a.highlight.ordinal ?? 0) - (b.highlight.ordinal ?? 0);
		});

		return scored.map((entry) => entry.highlight);
	});

	function selectHighlight(h: CommentedHighlight) {
		onSelectHighlight(h);
	}

	async function deleteOne(h: CommentedHighlight) {
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
		<div
			class="absolute h-8 w-1.5 rounded-full bg-border group-hover:bg-primary-foreground/50"
		></div>
	</div>
{/if}

<aside
	class="flex h-full shrink-0 flex-col border-l border-border bg-card transition-[width] duration-300 select-none"
	class:hidden={!isOpen}
	style:width="{width}px"
	aria-label="Sidebar"
>
	<div class="flex h-full flex-col overflow-hidden">
		<!-- Tabs Header -->
		<div class="flex h-11 items-center justify-around border-b border-border bg-muted/30">
			<button
				class="flex h-full flex-1 items-center justify-center gap-2 text-sm font-medium transition-colors hover:text-primary"
				class:text-primary={activeTab === 'highlights'}
				class:border-b-2={activeTab === 'highlights'}
				class:border-primary={activeTab === 'highlights'}
				onclick={() => (activeTab = 'highlights')}
			>
				<LayoutList class="size-4" />
				Highlights
			</button>
			<button
				class="flex h-full flex-1 items-center justify-center gap-2 text-sm font-medium transition-colors hover:text-primary"
				class:text-primary={activeTab === 'summary'}
				class:border-b-2={activeTab === 'summary'}
				class:border-primary={activeTab === 'summary'}
				onclick={() => (activeTab = 'summary')}
			>
				<MessageSquare class="size-4" />
				Summary
			</button>
		</div>

		<div class="flex min-h-0 flex-1 flex-col overflow-hidden">
			<div
				class="flex min-h-0 flex-1 flex-col overflow-hidden"
				class:hidden={activeTab !== 'highlights'}
				aria-hidden={activeTab !== 'highlights'}
				inert={activeTab !== 'highlights'}
			>
				<div class="px-2 py-3">
					<div class="relative">
						<Search class="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
						<Input
							type="search"
							bind:value={query}
							placeholder="Search"
							class="pl-9"
						/>
					</div>
				</div>
				<Separator class="opacity-50" />

				<div class="minimal-scrollbar min-h-0 flex-1 overflow-y-auto">
					<div class="flex flex-col gap-2 p-3" role="listbox" aria-label="Document highlights">
						{#each filtered as h (h.id)}
							<HighlightListItem
								highlight={h}
								onSelect={selectHighlight}
								onDelete={deleteOne}
								{onRecategorize}
								{categoryLabels}
								{decorativeMode}
								{viewerColorMode}
								{onAddAnnotation}
								{onUpdateAnnotation}
								{onDeleteAnnotation}

								selected={selectedHighlightId === (h.id ?? null)}
								onHover={(id) => highlightsStore.setHoveredHighlightId(id)}
								citationCount={citationCounts[h.id!] ?? 0}
								onNavigateToSummary={() => {
									activeTab = 'summary';
									summaryHighlightIdToScrollTo = h.id!;
								}}
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
				</div>

				<Separator />

				{#if onResetAll}
					<div class="p-3">
						<Button
							variant="outline"
							size="sm"
							class="w-full gap-2 text-muted-foreground hover:text-destructive"
							onclick={() => onResetAll()}
						>
							<RotateCcw class="size-3.5" />
							Delete all highlights
						</Button>
					</div>
				{/if}
			</div>

			<div
				class="flex min-h-0 flex-1 flex-col overflow-hidden"
				class:hidden={activeTab !== 'summary'}
				aria-hidden={activeTab !== 'summary'}
				inert={activeTab !== 'summary'}
			>
				<Summary
					highlights={highlightsStore.highlights}
					{viewerUtils}
					{viewerColorMode}
					onJumpToHighlight={(id) => {
						selectedHighlightId = id;
						activeTab = 'highlights';
						document
							.getElementById(`sidebar-highlight-${id}`)
							?.scrollIntoView({ behavior: 'smooth', block: 'center' });
					}}
					bind:activeCitations={activeSummaryCitations}
					bind:scrollToHighlightId={summaryHighlightIdToScrollTo}
				/>
			</div>
		</div>
	</div>
</aside>
