<script lang="ts">
	let { data } = $props();
	import {
		PdfLoader,
		PdfHighlighter,
		HighlightsModel,
		LeftPanel,
		type CommentedHighlight,
		type Highlight,
		type HighlightAdjustmentDraft,
		type ViewportHighlight,
		type PdfHighlighterUtils,
		type Annotation
	} from '$lib/pdf-highlighter';
	import pdfWorkerUrl from '$lib/pdf-worker-url';
	import Header from '$lib/features/viewer/components/Header.svelte';
	import Sidebar from '$lib/features/viewer/components/Sidebar.svelte';
	import ViewerSkeleton from '$lib/features/viewer/components/ViewerSkeleton.svelte';
	import { mode } from 'mode-watcher';
	import { onMount, tick } from 'svelte';
	import type { Component } from 'svelte';
	import {
		CATEGORY_SLOT_IDS,
		canonicalHighlightPalette,
		resolveHighlightPalette,
		hexForNewHighlight
	} from '$lib/highlights/color-slots';
	import {
		applyPersistedHighlight,
		buildOptimisticHighlight,
		type PersistedHighlightResponse,
		createHighlightCommentSaver,
		applyHighlightSelection
	} from '$lib/features/highlights/logic';
	import { zoomIn, zoomOut } from '$lib/pdf-highlighter/lib/zoom';
	import { toast } from 'svelte-sonner';
	import { createFigureInterpretation } from './figure-interpretation.remote';

	const docMeta = $derived(data?.document);
	const pdfUrl = $derived(data?.pdfUrl);
	const docId = $derived(data?.document?.id ?? '');
	const decorative = $derived(data?.userSettings?.useColorsDecoratively ?? false);
	const viewerColorMode = $derived(mode.current === 'dark' ? ('dark' as const) : ('light' as const));
	const categoryLabelList = $derived(
		CATEGORY_SLOT_IDS.map((id) => data?.userSettings?.categoryLabels?.[String(id)] ?? '')
	);
	const canonicalSlotHexList = $derived(canonicalHighlightPalette());
	const displaySlotHexList = $derived(resolveHighlightPalette(viewerColorMode));

	let pdfHighlighterUtils = $state<Partial<PdfHighlighterUtils>>({});
	let highlightsStore = new HighlightsModel<CommentedHighlight>(data?.highlights ?? []);

	$effect(() => {
		highlightsStore.replaceAll(data?.highlights ?? []);
	});

	$effect(() => {
		const u = pdfHighlighterUtils;
		if (!u || typeof u !== 'object') return;
		u.colors = [...displaySlotHexList];
	});

	let sidebarOpen = $state(true);
	let leftOpen = $state(true);
	let currentPage = $state(1);
	let sidebarWidth = $state(300);
	let selectedHighlightId = $state<string | null>(null);
	let sidebarActiveTab = $state<'highlights' | 'summary'>('highlights');
	let explainingHighlightIds = $state<Set<string>>(new Set());
	let deletingHighlightIds = $state<Set<string>>(new Set());
	let savingAdjustedHighlightIds = $state<Set<string>>(new Set());
	let adjustingHighlightId = $state<string | null>(null);
	let pendingReExplainHighlightId = $state<string | null>(null);
	let adjustmentDraft = $state<HighlightAdjustmentDraft | null>(null);
	let highlightActionErrors = $state<Record<string, string | undefined>>({});
	let pendingHashHighlightId: string | null = null;
	let handledHashHighlightId: string | null = null;
	const pendingHighlightPersists = new Map<string, Promise<CommentedHighlight>>();

	const PdfHighlighterComponent = PdfHighlighter as unknown as Component<Record<string, unknown>>;
	const highlightActionState = $derived({
		explainingHighlightIds,
		deletingHighlightIds,
		adjustingHighlightId,
		pendingReExplainHighlightId,
		savingAdjustedHighlightIds,
		errorsByHighlightId: highlightActionErrors
	});

	function setHighlightBusy(
		setter: 'explaining' | 'deleting' | 'savingAdjust',
		id: string,
		busy: boolean
	) {
		const current =
			setter === 'explaining'
				? explainingHighlightIds
				: setter === 'deleting'
					? deletingHighlightIds
					: savingAdjustedHighlightIds;
		const next = new Set(current);
		if (busy) next.add(id);
		else next.delete(id);
		if (setter === 'explaining') explainingHighlightIds = next;
		else if (setter === 'deleting') deletingHighlightIds = next;
		else savingAdjustedHighlightIds = next;
	}

	function setHighlightActionError(id: string, message?: string) {
		highlightActionErrors = { ...highlightActionErrors, [id]: message };
	}

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
		mode: viewerColorMode
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
			slotHexByIndex: [...canonicalSlotHexList]
		});

		const nextOrdinal =
			highlightsStore.highlights.reduce((max, hl) => Math.max(max, hl.ordinal ?? 0), 0) + 1;

		const optimistic = buildOptimisticHighlight(h, {
			id,
			ordinal: nextOrdinal,
			decorative,
			colorHex: hex
		});

		const persistPromise = fetch(`/doc/${docId}/highlights`, {
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
				return persisted;
			})
			.catch((err) => {
				console.error('Failed to persist highlight:', err);
				highlightsStore.deleteHighlight(optimistic);
				toast.error('Highlight could not be saved. Please try again.');
				throw err;
			})
			.finally(() => {
				pendingHighlightPersists.delete(id);
			});
		pendingHighlightPersists.set(id, persistPromise);

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
		if (!h.id) return;
		setHighlightBusy('deleting', h.id, true);
		setHighlightActionError(h.id);
		try {
			await persistDelete(h);
		} catch (e) {
			setHighlightActionError(h.id, 'Delete failed. Try again.');
			throw e;
		} finally {
			setHighlightBusy('deleting', h.id, false);
		}
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
		highlightsStore.editHighlight(h.id, { annotations } as Partial<CommentedHighlight>);
	}

	function appendAnnotation(h: CommentedHighlight, annotation: Annotation) {
		if (!h.id) return;
		const current = highlightsStore.getHighlightById(h.id) ?? h;
		const annotations = [...(current.annotations ?? []), annotation];
		highlightsStore.editHighlight(h.id, { annotations } as Partial<CommentedHighlight>);
	}

	function upsertLocalAiAnnotation(highlightId: string, annotation: Annotation) {
		const h = highlightsStore.getHighlightById(highlightId);
		if (!h) return;
		const humanAnnotations = (h.annotations ?? []).filter((a) => a.source !== 'ai');
		highlightsStore.editHighlight(highlightId, {
			annotations: [...humanAnnotations, annotation]
		} as Partial<CommentedHighlight>);
	}

	function updateLocalAnnotation(highlightId: string, annotationId: string, body: string) {
		const h = highlightsStore.getHighlightById(highlightId);
		if (!h) return;
		const annotations = (h.annotations ?? []).map((annotation) =>
			annotation.id === annotationId ? { ...annotation, body } : annotation
		);
		highlightsStore.editHighlight(highlightId, { annotations } as Partial<CommentedHighlight>);
	}

	function bodyWithErrorNote(body: string, message: string) {
		const base = body.trim() || 'Explanation was interrupted before any text was received.';
		return `${base}\n\n[Explanation stopped: ${message}]`;
	}

	function streamInterpretation({
		highlightId,
		annotationId,
		streamUrl,
		initialBody
	}: {
		highlightId: string;
		annotationId: string;
		streamUrl: string;
		initialBody: string;
	}) {
		return new Promise<void>((resolve) => {
			let body = '';
			let settled = false;
			const eventSource = new EventSource(streamUrl);

			const applyBody = (nextBody: string) => {
				body = nextBody;
				updateLocalAnnotation(highlightId, annotationId, body || initialBody);
			};
			const finish = () => {
				if (settled) return;
				settled = true;
				eventSource.close();
				resolve();
			};

			eventSource.onmessage = (event) => {
				try {
					const parsed = JSON.parse(event.data) as {
						token?: string;
						content?: string;
						body?: string;
						done?: boolean;
						error?: string;
					};
					if (parsed.error) {
						applyBody(bodyWithErrorNote(body, parsed.error));
						finish();
						return;
					}
					if (typeof parsed.body === 'string' || typeof parsed.content === 'string') {
						applyBody(parsed.body ?? parsed.content ?? '');
					} else if (typeof parsed.token === 'string') {
						applyBody(body + parsed.token);
					}
					if (parsed.done) {
						finish();
					}
				} catch {
					applyBody(body + event.data);
				}
			};

			eventSource.addEventListener('token', (event) => {
				applyBody(body + (event as MessageEvent).data);
			});

			eventSource.addEventListener('delta', (event) => {
				try {
					const parsed = JSON.parse((event as MessageEvent).data) as { text?: string };
					applyBody(body + (parsed.text ?? ''));
				} catch {
					applyBody(body + (event as MessageEvent).data);
				}
			});

			eventSource.addEventListener('done', (event) => {
				try {
					const parsed = JSON.parse((event as MessageEvent).data) as { annotation?: Annotation };
					if (parsed.annotation?.body) applyBody(parsed.annotation.body);
				} catch {
					// The backend may send an empty done event; the final PATCH is handled server-side.
				}
				finish();
			});

			eventSource.addEventListener('error', (event) => {
				let message = 'stream connection failed';
				try {
					const parsed = JSON.parse((event as MessageEvent).data) as { message?: string };
					message = parsed.message ?? message;
				} catch {
					message = (event as MessageEvent).data || message;
				}
				applyBody(bodyWithErrorNote(body, message));
				finish();
			});

			eventSource.onerror = () => {
				applyBody(bodyWithErrorNote(body, 'stream connection failed'));
				finish();
			};
		});
	}

	async function explainFigure(h: CommentedHighlight) {
		if (!h.id || h.type !== 'area') return;
		const existingAi = (h.annotations ?? []).find((annotation) => annotation.source === 'ai');
		if (existingAi) {
			pendingReExplainHighlightId = h.id;
			return;
		}
		await startFigureExplanation(h);
	}

	async function confirmReExplainFigure(h: CommentedHighlight) {
		if (!h.id || h.type !== 'area') return;
		pendingReExplainHighlightId = null;
		await startFigureExplanation(h);
	}

	function cancelReExplainFigure() {
		pendingReExplainHighlightId = null;
	}

	async function startFigureExplanation(h: CommentedHighlight) {
		if (!h.id || h.type !== 'area') return;
		setHighlightBusy('explaining', h.id, true);
		setHighlightActionError(h.id);

		let highlight = h;
		try {
			const persisted = await (pendingHighlightPersists.get(h.id) ?? Promise.resolve(h));
			highlight = highlightsStore.getHighlightById(persisted.id!) ?? persisted;
			if (!highlight.id) return;

			const started = await createFigureInterpretation({ highlightId: highlight.id });

			const now = new Date().toISOString();
			const draftAnnotation: Annotation = {
				id: started.annotationId,
				highlight_id: started.highlightId,
				owner_id: '',
				body: 'Generating figure interpretation...',
				source: 'ai',
				created_at: now,
				updated_at: now
			};

			upsertLocalAiAnnotation(started.highlightId, draftAnnotation);
			await streamInterpretation({
				highlightId: started.highlightId,
				annotationId: started.annotationId,
				streamUrl: started.streamUrl,
				initialBody: draftAnnotation.body
			});
		} catch (e) {
			setHighlightActionError(h.id, 'Explanation failed. Try again.');
			toast.error('Figure explanation could not be started.');
			throw e;
		} finally {
			setHighlightBusy('explaining', h.id, false);
		}
	}

	function startAdjustHighlight(h: CommentedHighlight) {
		if (!h.id || h.type !== 'area' || !h.position) return;
		adjustingHighlightId = h.id;
		setHighlightActionError(h.id);
		adjustmentDraft = {
			highlightId: h.id,
			originalPosition: h.position,
			originalImage: h.content?.image,
			position: h.position,
			image: h.content?.image
		};
	}

	function updateAdjustmentDraft(draft: HighlightAdjustmentDraft) {
		adjustmentDraft = draft;
	}

	function cancelAdjustHighlight() {
		if (adjustmentDraft?.highlightId) {
			setHighlightActionError(adjustmentDraft.highlightId);
			highlightsStore.editHighlight(adjustmentDraft.highlightId, {
				position: adjustmentDraft.originalPosition,
				content: { image: adjustmentDraft.originalImage }
			} as Partial<CommentedHighlight>);
		}
		adjustingHighlightId = null;
		adjustmentDraft = null;
	}

	async function saveAdjustedHighlight(draft: HighlightAdjustmentDraft) {
		const id = draft.highlightId;
		setHighlightBusy('savingAdjust', id, true);
		setHighlightActionError(id);
		try {
			const res = await fetch(`/doc/${docId}/highlights`, {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					id,
					position: draft.position,
					content: { image: draft.image }
				})
			});
			if (!res.ok) throw new Error(await res.text());
			const updated = (await res.json()) as { highlight: CommentedHighlight };
			highlightsStore.editHighlight(id, {
				position: updated.highlight.position,
				content: updated.highlight.content
			} as Partial<CommentedHighlight>);
			adjustingHighlightId = null;
			adjustmentDraft = null;
		} catch (e) {
			setHighlightActionError(id, 'Adjustment could not be saved. Try again.');
			throw e;
		} finally {
			setHighlightBusy('savingAdjust', id, false);
		}
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
		highlightsStore.editHighlight(h.id!, { annotations } as Partial<CommentedHighlight>);
	}

	async function deleteAnnotation(h: Highlight, id: string) {
		const res = await fetch(`/doc/${docId}/annotations?id=${encodeURIComponent(id)}`, {
			method: 'DELETE'
		});
		if (!res.ok) throw new Error('Failed to delete annotation');
		const annotations = (h.annotations ?? []).filter((a) => a.id !== id);
		highlightsStore.editHighlight(h.id!, { annotations } as Partial<CommentedHighlight>);
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
								goToDestination={(dest) => pdfHighlighterUtils.goToDestination?.(dest)}
								getEventBus={() =>
									pdfHighlighterUtils.getEventBus?.() as ViewerEventBus | undefined}
								getViewer={() => pdfHighlighterUtils.getViewer?.()}
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
										onExplainFigure={explainFigure}
										onConfirmReExplainFigure={confirmReExplainFigure}
										onCancelReExplainFigure={cancelReExplainFigure}
										onStartAdjustHighlight={startAdjustHighlight}
										onSaveAdjustedHighlight={saveAdjustedHighlight}
										onCancelAdjustHighlight={cancelAdjustHighlight}
										onUpdateAdjustmentDraft={updateAdjustmentDraft}
										actionState={highlightActionState}
										{adjustmentDraft}
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
								{viewerColorMode}
								onPersistDelete={persistDelete}
								onRecategorize={persistRecategorize}
								onResetAll={resetAllRemote}
								onAddAnnotation={addAnnotation}
								onUpdateAnnotation={updateAnnotation}
								onDeleteAnnotation={deleteAnnotation}

								bind:selectedHighlightId
								bind:activeTab={sidebarActiveTab}
								viewerUtils={pdfHighlighterUtils}
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
