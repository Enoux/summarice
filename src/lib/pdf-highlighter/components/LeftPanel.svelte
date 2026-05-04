<script lang="ts">
	import type { PDFDocumentProxy } from 'pdfjs-dist';
	import type { LeftPanelTab, ProcessedOutlineItem } from '$lib/pdf-highlighter/types';
	import { loadDocumentOutline } from '$lib/pdf-highlighter/hooks/document-outline';
	import DocumentOutline from './DocumentOutline.svelte';
	import ThumbnailPanel from './ThumbnailPanel.svelte';
	import { ChevronRight, FileText, List } from '@lucide/svelte';
	import { cn } from '$lib/utils';

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
		getViewer?: () => any;
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
		getViewer,
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
	let lastNavigatedId = $state<string | null>(null);
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
		const bus = getEventBus?.() as any;
		const viewer = getViewer?.() as any;
		if (!bus) return;

		const handlePageChange = (e: { pageNumber: number }) => {
			currentPage = e.pageNumber;
		};

		const handleViewUpdate = (e: { location: { pageNumber: number } }) => {
			if (e.location?.pageNumber) {
				currentPage = e.location.pageNumber;
			}
		};

		// Also listen to direct scroll events for high-frequency updates
		const handleScroll = () => {
			if (viewer?.pdfViewer?._location?.pageNumber) {
				currentPage = viewer.pdfViewer._location.pageNumber;
			}
		};

		bus.on('pagechanging', handlePageChange);
		bus.on('updateviewarea', handleViewUpdate);
		
		const scrollContainer = viewer?.container;
		if (scrollContainer) {
			scrollContainer.addEventListener('scroll', handleScroll, { passive: true });	
		}

		return () => {
			bus.off('pagechanging', handlePageChange);
			bus.off('updateviewarea', handleViewUpdate);
			if (scrollContainer) {
				scrollContainer.removeEventListener('scroll', handleScroll);
			}
		};
	});

	function handlePageSelect(pageNumber: number) {
		goToPage(pageNumber);
		currentPage = pageNumber;
		onPageSelect?.(pageNumber);
	}

	function handleOutlineNavigate(item: ProcessedOutlineItem) {
		goToPage(item.pageNumber);
		currentPage = item.pageNumber;
		lastNavigatedId = item.id;
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
			<div class="flex h-11 border-b border-border bg-muted/30">
				{#if !outlineLoading && outline && outline.length > 0}
					<button
						type="button"
						class={cn(
							"flex h-full flex-1 items-center justify-center gap-1.5 text-[13px] font-medium transition-colors border-b-2",
							activeTab === 'outline'
								? "border-primary text-primary"
								: "border-transparent text-muted-foreground hover:text-foreground"
						)}
						onclick={() => setTab('outline')}
					>
						<FileText class="size-4" />
						Outline
					</button>
				{/if}
				<button
					type="button"
					class={cn(
						"flex h-full flex-1 items-center justify-center gap-1.5 text-[13px] font-medium transition-colors border-b-2",
						activeTab === 'thumbnails'
							? "border-primary text-primary"
							: "border-transparent text-muted-foreground hover:text-foreground"
					)}
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
						{lastNavigatedId}
						onNavigate={handleOutlineNavigate}
					/>
				{:else}
					<ThumbnailPanel {pdfDocument} {currentPage} onPageSelect={handlePageSelect} />
				{/if}
			</div>

			<div
				class="border-t border-border bg-muted/20 px-3 py-2.5 text-center text-[10px] font-semibold tracking-wider text-muted-foreground uppercase tabular-nums"
			>
				Page {currentPage} of {pdfDocument.numPages}
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
			{#if !outlineLoading && outline && outline.length > 0}
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
			{/if}
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
