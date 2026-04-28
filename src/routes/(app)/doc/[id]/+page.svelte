<script lang="ts">
	let { data } = $props();
	import {
		PdfLoader,
		PdfHighlighter,
		HighlightsModel,
		LeftPanel,
		type CommentedHighlight,
		type Highlight,
		type PdfHighlighterUtils
	} from '$lib/pdf-highlighter';
	import pdfWorkerUrl from '$lib/pdf-worker-url';
	import Header from '$lib/components/viewer/Header.svelte';
	import Sidebar from '$lib/components/viewer/Sidebar.svelte';
	import ViewerSkeleton from '$lib/components/viewer/ViewerSkeleton.svelte';
	import CommentPopup from '$lib/components/viewer/CommentPopup.svelte';
	import CommentForm from '$lib/components/viewer/CommentForm.svelte';
	import { mode } from 'mode-watcher';
	import { onMount } from 'svelte';
	import type { Component } from 'svelte';
	import {
		CATEGORY_SLOT_IDS,
		DEFAULT_SLOT_HEX,
		paletteFromSettings
	} from '$lib/domain/highlight-categories';
	import { hexForNewHighlight } from '$lib/domain/highlight-mapper';

	const docMeta = $derived(data?.document);
	const pdfUrl = $derived(data?.pdfUrl);
	const docId = $derived(data?.document?.id ?? '');
	const decorative = $derived(data?.userSettings?.useColorsDecoratively ?? false);
	const categoryLabelList = $derived(
		CATEGORY_SLOT_IDS.map((id) => data?.userSettings?.categoryLabels?.[String(id)] ?? '')
	);
	const slotHexList = $derived(CATEGORY_SLOT_IDS.map((id) => DEFAULT_SLOT_HEX[id]));

	let pdfHighlighterUtils = $state<Partial<PdfHighlighterUtils>>({});
	let highlightsStore = new HighlightsModel<Highlight>(data?.highlights ?? []);

	$effect(() => {
		highlightsStore.replaceAll(data?.highlights ?? []);
	});

	$effect(() => {
		const u = pdfHighlighterUtils;
		if (!u || typeof u !== 'object') return;
		const { hex } = paletteFromSettings(
			data?.userSettings?.categoryLabels ?? {},
			decorative
		);
		u.colors = [...hex];
	});

	let sidebarOpen = $state(true);
	let leftOpen = $state(true);
	let currentPage = $state(1);
	let sidebarWidth = $state(300);
	let expandedHighlightId = $state<string | null>(null);

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

	function scrollToHash() {
		const id = document.location.hash.replace('#highlight-', '');
		if (!id) return;
		const h = highlightsStore.getHighlightById(id);
		if (h && pdfHighlighterUtils.scrollToHighlight) {
			pdfHighlighterUtils.scrollToHighlight(h);
		}
	}

	async function prepareHighlightForAdd(h: CommentedHighlight) {
		const hex = hexForNewHighlight(h, {
			decorative,
			decorativeDefaultHex: data?.userSettings?.decorativeDefaultColor ?? '#facc15',
			slotHexByIndex: [...slotHexList]
		});
		const res = await fetch(`/doc/${docId}/highlights`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				highlight: JSON.parse(JSON.stringify(h)) as CommentedHighlight,
				decorative,
				colorHex: hex
			})
		});
		if (!res.ok) throw new Error(await res.text());
		return (await res.json()) as CommentedHighlight;
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

	async function persistComment(id: string, comment: string) {
		const res = await fetch(`/doc/${docId}/highlights`, {
			method: 'PATCH',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ id, comment })
		});
		if (!res.ok) throw new Error('Save comment failed');
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
					pdfHighlighterUtils.setCurrentScaleValue(pdfHighlighterUtils.currentScale + 0.1);
				}
				break;
			case '-':
				if (
					pdfHighlighterUtils.currentScale !== undefined &&
					pdfHighlighterUtils.setCurrentScaleValue
				) {
					pdfHighlighterUtils.setCurrentScaleValue(
						Math.max(0.1, pdfHighlighterUtils.currentScale - 0.1)
					);
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
		const onHash = () => scrollToHash();
		window.addEventListener('hashchange', onHash);
		window.addEventListener('keydown', handleKeyDown);
		return () => {
			window.removeEventListener('hashchange', onHash);
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
								getEventBus={() => pdfHighlighterUtils.getEventBus?.() as ViewerEventBus | undefined}
								isOpen={leftOpen}
								onOpenChange={(v) => (leftOpen = v)}
								defaultTab={docMeta?.outline && docMeta.outline.length > 0 ? 'outline' : 'thumbnails'}
							/>
							<div class="flex flex-col flex-1 min-w-0 overflow-hidden">
								<Header
									utils={pdfHighlighterUtils}
									pdfSource={pdfUrl}
									highlights={highlightsStore.highlights}
									leftPanelOpen={leftOpen}
									onLeftPanelOpenChange={(v) => (leftOpen = v)}
									sidebarOpen={sidebarOpen}
									onSidebarOpenChange={(v) => (sidebarOpen = v)}
									categoryLabels={categoryLabelList}
									decorative={decorative}
								/>
								<div class="relative min-h-0 min-w-0 flex-1">
									<PdfHighlighterComponent
										bind:pdfHighlighterUtils
										highlightsStore={highlightsStore as HighlightsModel<CommentedHighlight>}
										{pdfDocument}
										{prepareHighlightForAdd}
										theme={pdfTheme}
										scaleOnResize
										style=""
										onContextMenu={() => {}}
										onHighlightsRendered={scrollToHash}
										onHighlightClick={(e, h) => {
											if (h.id) {
												expandedHighlightId = h.id;
												sidebarOpen = true;
												const el = document.getElementById(`highlight-${h.id}`);
												el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
											}
										}}
									>
									{#snippet highlightPopup(
										hl: Highlight,
										setPinned: (v: boolean) => void
									)}
										<CommentPopup highlight={hl} {setPinned} />
									{/snippet}
									{#snippet editHighlightPopup(
										h: Highlight,
										colors: string[],
										onEdit: (comment: string) => void,
										onDelete: (highlight: Highlight) => void
									)}
										<CommentForm
											mode="edit"
											highlight={h}
											{colors}
											categoryLabels={categoryLabelList}
											decorativeMode={decorative}
											onSave={async (comment) => {
												onEdit(comment);
												if (h.id) await persistComment(h.id, comment);
											}}
											onDelete={async (x) => {
												await persistDelete(x);
												onDelete(x);
											}}
										/>
									{/snippet}
									{#snippet newHighlightPopup(
										h: Highlight,
										colors: string[],
										onAdd: (highlight: Highlight) => void
									)}
										<CommentForm
											mode="new"
											highlight={h}
											{colors}
											categoryLabels={categoryLabelList}
											decorativeMode={decorative}
											onAdd={(nh) => onAdd(nh)}
										/>
									{/snippet}
								</PdfHighlighterComponent>
							</div>
						</div>

						<Sidebar
								{highlightsStore}
								onJump={(h) => pdfHighlighterUtils.scrollToHighlight?.(h)}
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
								bind:expandedHighlightId
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
