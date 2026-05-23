<script lang="ts">
	import type { PDFDocumentProxy } from 'pdfjs-dist';
	import type { LeftPanelTab, ProcessedOutlineItem } from '$lib/pdf-highlighter/types';
	import { loadDocumentOutline } from '$lib/pdf-highlighter/hooks/document-outline';
	import {
		cssPxToPdfUnits,
		OUTLINE_READING_LINE_OFFSET_PX,
		type OutlineViewLocation
	} from '$lib/pdf-highlighter/lib/outline-active-item';
	import DocumentOutline from './DocumentOutline.svelte';
	import ThumbnailPanel from './ThumbnailPanel.svelte';
	import { ChevronRight, FileText, List } from '@lucide/svelte';
	import { cn } from '$lib/utils';

	type PdfViewerLocation = {
		pageNumber: number;
		top: number;
		left: number;
	};

	type ViewerEventBus = {
		on: (
			ev: string,
			fn: (e: { pageNumber?: number; location?: PdfViewerLocation }) => void
		) => void;
		off: (
			ev: string,
			fn: (e: { pageNumber?: number; location?: PdfViewerLocation }) => void
		) => void;
	};

	type PdfViewerApplication = {
		container?: HTMLElement;
		pdfViewer?: { _location?: PdfViewerLocation };
		getPageView?: (pageIndex: number) => { viewport?: { scale: number } } | undefined;
	};

	interface Props {
		pdfDocument: PDFDocumentProxy;
		goToPage: (pageNumber: number) => void;
		goToDestination?: (dest: string | unknown[]) => void;
		getEventBus?: () => ViewerEventBus | unknown | undefined;
		getViewer?: () => PdfViewerApplication | unknown | undefined;
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
		goToDestination,
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
	let viewLocation = $state<OutlineViewLocation>({ pageNumber: 1, top: 0, left: 0 });
	let lastNavigatedId = $state<string | null>(null);
	let userInitiatedScroll = $state(false);
	let panelScrollReady = $state(false);
	let tabInitialized = false;

	const isOpen = $derived(controlledOpen ?? internalOpen);
	const currentPage = $derived(viewLocation.pageNumber);

	const readingOffsetPdf = $derived.by(() => {
		const viewer = getViewer?.() as PdfViewerApplication | undefined;
		const pageView = viewer?.getPageView?.(viewLocation.pageNumber - 1);
		const scale = pageView?.viewport?.scale;
		if (typeof scale !== 'number') {
			return 0;
		}
		return cssPxToPdfUnits(OUTLINE_READING_LINE_OFFSET_PX, scale);
	});

	function setOpen(open: boolean) {
		if (onOpenChange) onOpenChange(open);
		else internalOpen = open;
	}

	function applyViewerLocation(location: PdfViewerLocation | undefined) {
		if (!location?.pageNumber) return;
		viewLocation = {
			pageNumber: location.pageNumber,
			top: location.top ?? 0,
			left: location.left ?? 0
		};
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
		const bus = getEventBus?.() as ViewerEventBus | undefined;
		const viewer = getViewer?.() as PdfViewerApplication | undefined;
		if (!bus) return;

		const handlePageChange = (e: { pageNumber?: number }) => {
			if (e.pageNumber) {
				viewLocation = { ...viewLocation, pageNumber: e.pageNumber };
			}
		};

		const handleViewUpdate = (e: { location?: PdfViewerLocation }) => {
			applyViewerLocation(e.location);
		};

		const handleScroll = () => {
			if (lastNavigatedId && userInitiatedScroll) {
				lastNavigatedId = null;
				userInitiatedScroll = false;
			}
			applyViewerLocation(viewer?.pdfViewer?._location);
		};

		const markUserScroll = () => {
			userInitiatedScroll = true;
		};

		bus.on('pagechanging', handlePageChange);
		bus.on('updateviewarea', handleViewUpdate);

		const scrollContainer = viewer?.container;
		if (scrollContainer) {
			scrollContainer.addEventListener('scroll', handleScroll, { passive: true });
			scrollContainer.addEventListener('wheel', markUserScroll, { passive: true });
			scrollContainer.addEventListener('touchstart', markUserScroll, { passive: true });
			scrollContainer.addEventListener('pointerdown', markUserScroll);
			scrollContainer.addEventListener('keydown', markUserScroll);
		}

		return () => {
			bus.off('pagechanging', handlePageChange);
			bus.off('updateviewarea', handleViewUpdate);
			if (scrollContainer) {
				scrollContainer.removeEventListener('scroll', handleScroll);
				scrollContainer.removeEventListener('wheel', markUserScroll);
				scrollContainer.removeEventListener('touchstart', markUserScroll);
				scrollContainer.removeEventListener('pointerdown', markUserScroll);
				scrollContainer.removeEventListener('keydown', markUserScroll);
			}
		};
	});

	function handlePageSelect(pageNumber: number) {
		goToPage(pageNumber);
		viewLocation = { ...viewLocation, pageNumber };
		onPageSelect?.(pageNumber);
	}

	function handleOutlineNavigate(item: ProcessedOutlineItem) {
		if (item.dest && goToDestination) {
			goToDestination(item.dest);
		} else {
			goToPage(item.pageNumber);
		}
		lastNavigatedId = item.id;
		viewLocation = { ...viewLocation, pageNumber: item.pageNumber };
	}

	function setTab(tab: LeftPanelTab) {
		activeTab = tab;
		onTabChange?.(tab);
	}

	function handlePanelTransitionEnd(event: TransitionEvent) {
		if (event.propertyName !== 'width' || !isOpen) return;
		panelScrollReady = true;
	}

	$effect(() => {
		if (!isOpen) {
			panelScrollReady = false;
			return;
		}
		panelScrollReady = false;
		const fallback = setTimeout(() => {
			if (isOpen) panelScrollReady = true;
		}, 220);
		return () => clearTimeout(fallback);
	});
</script>

<div
	ontransitionend={handlePanelTransitionEnd}
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
						{viewLocation}
						{readingOffsetPdf}
						{currentPage}
						{lastNavigatedId}
						scrollReady={panelScrollReady}
						onNavigate={handleOutlineNavigate}
					/>
				{:else}
					<ThumbnailPanel
						{pdfDocument}
						{currentPage}
						scrollReady={panelScrollReady}
						onPageSelect={handlePageSelect}
					/>
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
