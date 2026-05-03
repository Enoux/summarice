<script lang="ts">
	let { data } = $props();
	import {
		PdfLoader,
		PdfHighlighter,
		HighlightsModel,
		LeftPanel,
		type CommentedHighlight,
		type Highlight,
		type ViewportHighlight,
		type PdfHighlighterUtils
	} from '$lib/pdf-highlighter';
	import pdfWorkerUrl from '$lib/pdf-worker-url';
	import Header from '$lib/components/viewer/Header.svelte';
	import Sidebar from '$lib/components/viewer/Sidebar.svelte';
	import ViewerSkeleton from '$lib/components/viewer/ViewerSkeleton.svelte';
	import { mode } from 'mode-watcher';
	import { onMount, tick } from 'svelte';
	import type { Component } from 'svelte';
	import {
		CATEGORY_SLOT_IDS,
		DEFAULT_SLOT_HEX,
		paletteFromSettings
	} from '$lib/domain/highlight-categories';
	import { hexForNewHighlight } from '$lib/domain/highlight-mapper';
	import {
		applyPersistedHighlight,
		buildOptimisticHighlight,
		type PersistedHighlightResponse
	} from '$lib/domain/highlight-client';
	import { createHighlightCommentSaver } from '$lib/domain/highlight-comment-client';
	import { applyHighlightSelection } from '$lib/domain/highlight-selection';
	import { zoomIn, zoomOut } from '$lib/pdf-highlighter/lib/zoom';
	import { toast } from 'svelte-sonner';

	const docMeta = $derived(data?.document);
	const pdfUrl = $derived(data?.pdfUrl);
	const docId = $derived(data?.document?.id ?? '');
	const decorative = $derived(data?.userSettings?.useColorsDecoratively ?? false);
	const categoryLabelList = $derived(
		CATEGORY_SLOT_IDS.map((id) => data?.userSettings?.categoryLabels?.[String(id)] ?? '')
	);
	const slotHexList = $derived(CATEGORY_SLOT_IDS.map((id) => DEFAULT_SLOT_HEX[id]));

	let pdfHighlighterUtils = $state<Partial<PdfHighlighterUtils>>({});
	let highlightsStore = new HighlightsModel<CommentedHighlight>(data?.highlights ?? []);

	$effect(() => {
		highlightsStore.replaceAll(data?.highlights ?? []);
	});

	$effect(() => {
		const u = pdfHighlighterUtils;
		if (!u || typeof u !== 'object') return;
		const { hex } = paletteFromSettings(data?.userSettings?.categoryLabels ?? {}, decorative);
		u.colors = [...hex];
	});

	let sidebarOpen = $state(true);
	let leftOpen = $state(true);
	let currentPage = $state(1);
	let sidebarWidth = $state(300);
	let selectedHighlightId = $state<string | null>(null);
	let pendingHashHighlightId: string | null = null;
	let handledHashHighlightId: string | null = null;

	const PdfHighlighterComponent = PdfHighlighter as unknown as Component<Record<string, unknown>>;

	type ViewerEventBus = {
		on: (ev: string, fn: (e: { pageNumber: number }) => void) => void;
		off: (ev: string, fn: (e: { pageNumber: number }) => void) => void;
	};

	$effect(() => {
		const bus = pdfHighlighterUtils.getEventBus?.() as ViewerEventBus | undefined;
		if (!bus) return;
		const handler = (e: { pageNumber: number }) => {
			currentPage = e.pageNumber;
		};
		bus.on('pagechanging', handler);
		return () => bus.off('pagechanging', handler);
	});

	const pdfTheme = $derived({
		mode: mode.current === 'dark' ? ('dark' as const) : ('light' as const)
	});

	function scrollSidebarToHighlight(id: string) {
		void tick().then(() => {
			setTimeout(() => {
				const el = document.getElementById(`sidebar-highlight-${id}`);
				if (el) {
					el.scrollIntoView({ behavior: 'smooth', block: 'center' });
				}
			}, 100);
		});
	}

	function updateHighlightHash(id: string) {
		if (location.hash === `#highlight-${id}`) return;
		history.pushState(null, '', `#highlight-${id}`);
	}

	function selectHighlight(
		h: CommentedHighlight,
		{ updateHash = false, flash = true }: { updateHash?: boolean; flash?: boolean } = {}
	) {
		if (!h.id) return;
		({ selectedHighlightId, sidebarOpen } = applyHighlightSelection(
			{ selectedHighlightId, sidebarOpen },
			h.id
		));

		if (updateHash) {
			handledHashHighlightId = h.id;
			pendingHashHighlightId = null;
			updateHighlightHash(h.id);
		}

		// Scroll PDF viewer to highlight
		pdfHighlighterUtils.scrollToHighlight?.(h, flash);
		scrollSidebarToHighlight(h.id);
	}

	function handleHighlightSelect(h: CommentedHighlight) {
		pdfHighlighterUtils.setTip?.(null);
		selectHighlight(h, { updateHash: true, flash: false });
	}

	function handleViewportHighlightSelect(h: ViewportHighlight<CommentedHighlight>) {
		if (!h.id) return;
		const storedHighlight = highlightsStore.getHighlightById(h.id);
		if (storedHighlight) {
			selectHighlight(storedHighlight, { updateHash: true, flash: false });
		}
	}

	function getHashHighlightId() {
		const prefix = '#highlight-';
		if (!document.location.hash.startsWith(prefix)) return null;
		const id = document.location.hash.slice(prefix.length);
		return id || null;
	}

	function tryNavigateToPendingHash() {
		const id = pendingHashHighlightId;
		if (!id || handledHashHighlightId === id) return;
		const h = highlightsStore.getHighlightById(id);
		if (h) {
			pendingHashHighlightId = null;
			handledHashHighlightId = id;
			selectHighlight(h);
		}
	}

	function queueHashNavigation() {
		const id = getHashHighlightId();
		if (!id || handledHashHighlightId === id) return;
		pendingHashHighlightId = id;
		tryNavigateToPendingHash();
	}

	function prepareHighlightForAdd(h: CommentedHighlight) {
		const id = crypto.randomUUID();
		const hex = hexForNewHighlight(h, {
			decorative,
			decorativeDefaultHex: data?.userSettings?.decorativeDefaultColor ?? '#facc15',
			slotHexByIndex: [...slotHexList]
		});

		const nextOrdinal =
			highlightsStore.highlights.reduce((max, hl) => Math.max(max, hl.ordinal ?? 0), 0) + 1;

		const optimistic = buildOptimisticHighlight(h, {
			id,
			ordinal: nextOrdinal,
			decorative,
			colorHex: hex
		});

		fetch(`/doc/${docId}/highlights`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				highlight: optimistic,
				decorative,
				colorHex: hex
			})
		})
			.then(async (res) => {
				if (!res.ok) throw new Error(await res.text());
				const persisted = (await res.json()) as PersistedHighlightResponse;
				applyPersistedHighlight(highlightsStore, persisted);
			})
			.catch((err) => {
				console.error('Failed to persist highlight:', err);
				highlightsStore.deleteHighlight(optimistic);
				toast.error('Highlight could not be saved. Please try again.');
			});

		return optimistic;
	}

	async function persistDelete(h: Highlight) {
		if (!h.id) return;
		const res = await fetch(`/doc/${docId}/highlights?id=${encodeURIComponent(h.id)}`, {
			method: 'DELETE'
		});
		if (!res.ok) throw new Error('Delete failed');
	}

	async function persistRecategorize(h: Highlight, category: number | null, color: string) {
		if (!h.id) return;
		const res = await fetch(`/doc/${docId}/highlights`, {
			method: 'PATCH',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				id: h.id,
				category,
				color
			})
		});
		if (!res.ok) throw new Error('Update failed');
		const slot = category != null && category >= 1 && category <= 5 ? category - 1 : 0;
		highlightsStore.editHighlight(h.id, {
			category_slot: category,
			color_index: category != null ? slot : 0,
			display_color: color
		});
	}

	async function persistComment(h: CommentedHighlight, comment: string) {
		if (!h.id) return;
		const res = await fetch(`/doc/${docId}/highlights`, {
			method: 'PATCH',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ id: h.id, comment })
		});
		if (!res.ok) throw new Error('Save comment failed');
	}

	const saveHighlightComment = createHighlightCommentSaver(highlightsStore, persistComment);

	async function deleteHighlightFromViewer(h: CommentedHighlight) {
		await persistDelete(h);
	}

	async function resetAllRemote() {
		if (!confirm('Delete all highlights in this document?')) return;
		const ids = highlightsStore.highlights.map((h) => h.id).filter(Boolean) as string[];
		for (const id of ids) {
			await fetch(`/doc/${docId}/highlights?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
		}
		highlightsStore.resetHighlights();
	}

	async function addAnnotation(h: Highlight, body: string) {
		if (!h.id) return;
		const res = await fetch(`/doc/${docId}/annotations`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ highlight_id: h.id, body })
		});
		if (!res.ok) throw new Error('Failed to add annotation');
		const newAnn = await res.json();
		const annotations = [...(h.annotations ?? []), newAnn];
		highlightsStore.editHighlight(h.id, { annotations } as any);
	}

	async function updateAnnotation(h: Highlight, id: string, body: string) {
		const res = await fetch(`/doc/${docId}/annotations`, {
			method: 'PATCH',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ id, body })
		});
		if (!res.ok) throw new Error('Failed to update annotation');
		const updatedAnn = await res.json();
		const annotations = (h.annotations ?? []).map((a) => (a.id === id ? updatedAnn : a));
		highlightsStore.editHighlight(h.id!, { annotations } as any);
	}

	async function deleteAnnotation(h: Highlight, id: string) {
		const res = await fetch(`/doc/${docId}/annotations?id=${encodeURIComponent(id)}`, {
			method: 'DELETE'
		});
		if (!res.ok) throw new Error('Failed to delete annotation');
		const annotations = (h.annotations ?? []).filter((a) => a.id !== id);
		highlightsStore.editHighlight(h.id!, { annotations } as any);
	}

	function handleKeyDown(e: KeyboardEvent) {
		const target = e.target as HTMLElement | null;
		if (
			!target ||
			target.isContentEditable ||
			['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName) ||
			target.closest('[contenteditable="true"]')
		) {
			return;
		}

		if (!decorative && /^[1-5]$/.test(e.key)) {
			e.preventDefault();
			const idx = parseInt(e.key, 10) - 1;
			const colorSlots = Math.max(1, pdfHighlighterUtils.colors?.length ?? 0);
			const clampedIdx = Math.min(Math.max(idx, 0), colorSlots - 1);
			pdfHighlighterUtils.selectedColorIndex = clampedIdx;
			return;
		}

		switch (e.key) {
			case 'ArrowRight':
			case 'n':
				pdfHighlighterUtils.goToPage?.(currentPage + 1);
				break;
			case 'ArrowLeft':
			case 'p':
				pdfHighlighterUtils.goToPage?.(Math.max(1, currentPage - 1));
				break;
			case '=':
			case '+':
				if (
					pdfHighlighterUtils.currentScale !== undefined &&
					pdfHighlighterUtils.setCurrentScaleValue
				) {
					pdfHighlighterUtils.setCurrentScaleValue(zoomIn(pdfHighlighterUtils.currentScale));
				}
				break;
			case '-':
				if (
					pdfHighlighterUtils.currentScale !== undefined &&
					pdfHighlighterUtils.setCurrentScaleValue
				) {
					pdfHighlighterUtils.setCurrentScaleValue(zoomOut(pdfHighlighterUtils.currentScale));
				}
				break;
			case '/': {
				e.preventDefault();
				const searchInput = document.querySelector('input[type="search"]') as HTMLInputElement;
				if (searchInput) searchInput.focus();
				break;
			}
		}
	}

	onMount(() => {
		const onHash = () => queueHashNavigation();
		queueHashNavigation();
		window.addEventListener('hashchange', onHash);
		window.addEventListener('popstate', onHash);
		window.addEventListener('keydown', handleKeyDown);
		return () => {
			window.removeEventListener('hashchange', onHash);
			window.removeEventListener('popstate', onHash);
			window.removeEventListener('keydown', handleKeyDown);
		};
	});
</script>

<div class="flex h-full w-full flex-col overflow-hidden bg-background text-foreground">
	{#if pdfUrl}
		<div class="flex min-h-0 flex-1 overflow-hidden">
			<main class="relative flex min-h-0 min-w-0 flex-1 flex-row overflow-hidden">
				<PdfLoader document={pdfUrl} workerSrc={pdfWorkerUrl}>
					{#snippet beforeLoad(progress)}
						<ViewerSkeleton
							progress={progress.total > 0 ? (progress.loaded / progress.total) * 100 : 10}
							{leftOpen}
							{sidebarOpen}
						/>
					{/snippet}
					{#snippet pdfHighlighterWrapper(pdfDocument)}
						<div class="flex h-full min-w-0 flex-1 overflow-hidden">
							<LeftPanel
								{pdfDocument}
								goToPage={(n) => pdfHighlighterUtils.goToPage?.(n)}
								getEventBus={() =>
									pdfHighlighterUtils.getEventBus?.() as ViewerEventBus | undefined}
								isOpen={leftOpen}
								onOpenChange={(v) => (leftOpen = v)}
								defaultTab={docMeta?.outline && docMeta.outline.length > 0
									? 'outline'
									: 'thumbnails'}
							/>
							<div class="flex min-w-0 flex-1 flex-col overflow-hidden">
								<Header
									utils={pdfHighlighterUtils}
									pdfSource={pdfUrl}
									highlights={highlightsStore.highlights}
									leftPanelOpen={leftOpen}
									onLeftPanelOpenChange={(v) => (leftOpen = v)}
									{sidebarOpen}
									onSidebarOpenChange={(v) => (sidebarOpen = v)}
									categoryLabels={categoryLabelList}
									{decorative}
								/>
								<div class="relative min-h-0 min-w-0 flex-1">
									<PdfHighlighterComponent
										bind:pdfHighlighterUtils
										highlightsStore={highlightsStore as HighlightsModel<CommentedHighlight>}
										{pdfDocument}
										{prepareHighlightForAdd}
										{saveHighlightComment}
										deleteHighlight={deleteHighlightFromViewer}
										theme={pdfTheme}
										scaleOnResize
										style=""
										onContextMenu={() => {}}
										onHighlightsRendered={tryNavigateToPendingHash}
										onHighlightClick={(_e: MouseEvent, h: ViewportHighlight<CommentedHighlight>) =>
											handleViewportHighlightSelect(h)}
									/>
								</div>
							</div>

							<Sidebar
								{highlightsStore}
								onSelectHighlight={handleHighlightSelect}
								bind:isOpen={sidebarOpen}
								bind:width={sidebarWidth}
								categoryLabels={categoryLabelList}
								decorativeMode={decorative}
								onPersistDelete={persistDelete}
								onRecategorize={persistRecategorize}
								onResetAll={resetAllRemote}
								onAddAnnotation={addAnnotation}
								onUpdateAnnotation={updateAnnotation}
								onDeleteAnnotation={deleteAnnotation}
								bind:selectedHighlightId
							/>
						</div>
					{/snippet}
				</PdfLoader>
			</main>
		</div>
	{:else}
		<ViewerSkeleton {leftOpen} {sidebarOpen} progress={0} />
	{/if}
</div>
