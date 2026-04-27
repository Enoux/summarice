<script lang="ts">
	import type { PDFDocumentProxy } from 'pdfjs-dist';
	import type { LeftPanelTab, ProcessedOutlineItem } from '$lib/pdf-highlighter/types';
	import { loadDocumentOutline } from '$lib/pdf-highlighter/hooks/document-outline';
	import DocumentOutline from './DocumentOutline.svelte';
	import ThumbnailPanel from './ThumbnailPanel.svelte';
	import { ChevronRight, FileText, List } from '@lucide/svelte';

	interface Props {
		pdfDocument: PDFDocumentProxy;
		goToPage: (pageNumber: number) => void;
		getEventBus?: () =>
			| {
					on: (ev: string, fn: (e: { pageNumber: number }) => void) => void;
					off: (ev: string, fn: (e: { pageNumber: number }) => void) => void;
			  }
			| unknown
			| undefined;
		isOpen?: boolean;
		onOpenChange?: (open: boolean) => void;
		width?: number;
		collapsedWidth?: number;
		showCollapsedRail?: boolean;
		defaultTab?: LeftPanelTab;
		onPageSelect?: (pageNumber: number) => void;
		onTabChange?: (tab: LeftPanelTab) => void;
	}

	let {
		pdfDocument,
		goToPage,
		getEventBus,
		isOpen: controlledOpen,
		onOpenChange,
		width = 260,
		collapsedWidth = 36,
		showCollapsedRail = true,
		defaultTab = 'thumbnails',
		onPageSelect,
		onTabChange
	}: Props = $props();

	let internalOpen = $state(true);
	let activeTab = $state<LeftPanelTab>('thumbnails');
	let outline = $state<ProcessedOutlineItem[] | null>(null);
	let outlineLoading = $state(true);
	let currentPage = $state(1);
	let tabInitialized = false;

	const isOpen = $derived(controlledOpen ?? internalOpen);

	function setOpen(open: boolean) {
		if (onOpenChange) onOpenChange(open);
		else internalOpen = open;
	}

	$effect(() => {
		if (!tabInitialized) {
			activeTab = defaultTab;
			tabInitialized = true;
		}
	});

	$effect(() => {
		let cancelled = false;
		outlineLoading = true;
		void loadDocumentOutline(pdfDocument).then(({ outline: o, error }) => {
			if (cancelled) return;
			if (error) console.warn(error);
			outline = o;
			outlineLoading = false;
		});
		return () => {
			cancelled = true;
		};
	});

	$effect(() => {
		const bus = getEventBus?.() as
			| {
					on: (ev: string, fn: (e: { pageNumber: number }) => void) => void;
					off: (ev: string, fn: (e: { pageNumber: number }) => void) => void;
			  }
			| undefined;
		if (!bus) return;
		const handler = (e: { pageNumber: number }) => {
			currentPage = e.pageNumber;
		};
		bus.on('pagechanging', handler);
		return () => bus.off('pagechanging', handler);
	});

	function handlePageSelect(pageNumber: number) {
		goToPage(pageNumber);
		currentPage = pageNumber;
		onPageSelect?.(pageNumber);
	}

	function handleOutlineNavigate(item: ProcessedOutlineItem) {
		goToPage(item.pageNumber);
		currentPage = item.pageNumber;
	}

	function setTab(tab: LeftPanelTab) {
		activeTab = tab;
		onTabChange?.(tab);
	}
</script>

<div
	class="relative flex h-full shrink-0 flex-col border-r border-[var(--lp-border)] bg-[var(--lp-bg)] transition-[width] duration-200"
	style:width={isOpen ? `${width}px` : showCollapsedRail ? `${collapsedWidth}px` : '0px'}
	style:min-width={isOpen ? `${width}px` : showCollapsedRail ? `${collapsedWidth}px` : '0px'}
	style:overflow="hidden"
	style:--lp-bg="var(--card)"
	style:--lp-border="var(--border)"
	style:--lp-accent="var(--primary)"
	style:--lp-text="var(--foreground)"
	style:--lp-muted="var(--muted-foreground)"
	style:--lp-hover="var(--accent)"
>
	{#if isOpen}
		<div class="flex h-full min-h-0 w-full flex-col" style:width="{width}px">
			<div class="flex border-b border-[var(--lp-border)]">
				<button
					type="button"
					class="flex flex-1 items-center justify-center gap-1.5 py-2.5 text-[13px] font-medium transition-colors"
					class:border-b-2={activeTab === 'outline'}
					class:border-[var(--lp-accent)]={activeTab === 'outline'}
					class:text-[var(--lp-accent)]={activeTab === 'outline'}
					class:text-[var(--lp-muted)]={activeTab !== 'outline'}
					onclick={() => setTab('outline')}
				>
					<FileText class="size-4" />
					Outline
				</button>
				<button
					type="button"
					class="flex flex-1 items-center justify-center gap-1.5 py-2.5 text-[13px] font-medium transition-colors"
					class:border-b-2={activeTab === 'thumbnails'}
					class:border-[var(--lp-accent)]={activeTab === 'thumbnails'}
					class:text-[var(--lp-accent)]={activeTab === 'thumbnails'}
					class:text-[var(--lp-muted)]={activeTab !== 'thumbnails'}
					onclick={() => setTab('thumbnails')}
				>
					<List class="size-4" />
					Pages
				</button>
			</div>

			<div class="flex min-h-0 flex-1 flex-col">
				{#if activeTab === 'outline'}
					<DocumentOutline
						{outline}
						isLoading={outlineLoading}
						{currentPage}
						onNavigate={handleOutlineNavigate}
					/>
				{:else}
					<ThumbnailPanel {pdfDocument} {currentPage} onPageSelect={handlePageSelect} />
				{/if}
			</div>

			<div
				class="border-t border-[var(--lp-border)] px-3 py-2 text-center text-[11px] text-[var(--lp-muted)]"
			>
				Page {currentPage} / {pdfDocument.numPages}
			</div>
		</div>
	{:else if showCollapsedRail}
		<div class="flex h-full w-full flex-col items-center justify-start gap-2 py-2">
			<button
				type="button"
				class="flex h-8 w-8 items-center justify-center rounded-md text-[var(--lp-muted)] transition-colors hover:bg-[var(--lp-hover)] hover:text-[var(--lp-text)]"
				onclick={() => setOpen(true)}
				aria-label="Open left panel"
			>
				<ChevronRight class="size-4" />
			</button>
			<button
				type="button"
				class="flex h-8 w-8 items-center justify-center rounded-md transition-colors"
				class:bg-[var(--lp-hover)]={activeTab === 'outline'}
				class:text-[var(--lp-text)]={activeTab === 'outline'}
				class:text-[var(--lp-muted)]={activeTab !== 'outline'}
				aria-label="Outline tab"
				onclick={() => {
					setTab('outline');
					setOpen(true);
				}}
			>
				<FileText class="size-4" />
			</button>
			<button
				type="button"
				class="flex h-8 w-8 items-center justify-center rounded-md transition-colors"
				class:bg-[var(--lp-hover)]={activeTab === 'thumbnails'}
				class:text-[var(--lp-text)]={activeTab === 'thumbnails'}
				class:text-[var(--lp-muted)]={activeTab !== 'thumbnails'}
				aria-label="Pages tab"
				onclick={() => {
					setTab('thumbnails');
					setOpen(true);
				}}
			>
				<List class="size-4" />
			</button>
		</div>
	{/if}
</div>
