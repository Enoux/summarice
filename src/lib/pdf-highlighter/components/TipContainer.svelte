<script module lang="ts">
	import type { Snippet } from 'svelte';
	import type { PDFViewer } from 'pdfjs-dist/types/web/pdf_viewer';
	import type { HighlightsModel } from '../HighlightsModel.svelte';

	import type {
		CommentedHighlight,
		Highlight,
		HighlightAdjustmentDraft,
		HighlightPopupActionState,
		TipContainerState as TTipContainerState
	} from '$lib/pdf-highlighter/types';

	export interface TipContainerProps {
		viewer: PDFViewer;
		highlightsStore: HighlightsModel<CommentedHighlight>;
		onTipUpdate: (updater: (state: Partial<TTipContainerState> | null) => void) => void;
		colors: string[];
		clearTextSelection: () => void;
		/** When set, replaces default addHighlight persistence (e.g. Supabase). */
		prepareHighlightForAdd?: (
			h: CommentedHighlight
		) => CommentedHighlight | Promise<CommentedHighlight>;
		saveHighlightComment?: (highlight: CommentedHighlight, comment: string) => Promise<unknown>;
		deleteHighlight?: (highlight: CommentedHighlight) => Promise<void>;
		onExplainFigure?: (highlight: CommentedHighlight) => Promise<void>;
		onConfirmReExplainFigure?: (highlight: CommentedHighlight) => Promise<void>;
		onCancelReExplainFigure?: () => void;
		onStartAdjustHighlight?: (highlight: CommentedHighlight) => void;
		onSaveAdjustedHighlight?: (draft: HighlightAdjustmentDraft) => Promise<void>;
		onCancelAdjustHighlight?: () => void;
		actionState?: HighlightPopupActionState;
		adjustmentDraft?: HighlightAdjustmentDraft | null;

		highlightPopup?: Snippet<[highlight: Highlight, setPinned: (flag: boolean) => void]>;
		editHighlightPopup?: Snippet<
			[
				highlight: Highlight,
				colors: string[],
				onEdit: (comment: string) => Promise<void>,
				onDelete: (highlight: Highlight) => void,
				onColorChange: (colorIndex: number) => void
			]
		>;
		newHighlightPopup?: Snippet<
			[
				highlight: Highlight,
				colors: string[],
				onAddHighlight: (highlight: Highlight) => void,
				clearTextSelection: () => void,
				onClose: () => void,
				selectedTool?: string
			]
		>;
		selectedTool?: string;
	}
</script>

<script lang="ts">
	import type { ViewportPosition } from '$lib/pdf-highlighter/types';
	import { onMount } from 'svelte';
	import '$lib/pdf-highlighter/styles/tip-popup.css';
	import AdjustHighlightActionPopup from './AdjustHighlightActionPopup.svelte';
	import ConfirmReExplainActionPopup from './ConfirmReExplainActionPopup.svelte';
	import DefaultEditHighlightPopup from './DefaultEditHighlightPopup.svelte';
	import DefaultHighlightPopup from './DefaultHighlightPopup.svelte';
	import DefaultNewSelectionPopup from './DefaultNewSelectionPopup.svelte';
	import {
		HOVER_BRIDGE_STOP_EVENT,
		HOVER_TIP_LEAVE_EVENT,
		TIP_CONTAINER_CLASS,
		TIP_CONTAINER_SELECTOR
	} from '$lib/pdf-highlighter/lib/tip-hover-contract';
	import { getTipPosition } from '$lib/pdf-highlighter/lib/tip-positioning';
	import { getTipPopupMode } from '$lib/pdf-highlighter/lib/tip-popup-mode';

	let {
		viewer,
		highlightsStore,
		onTipUpdate,
		colors,
		clearTextSelection,
		prepareHighlightForAdd,
		saveHighlightComment,
		deleteHighlight,
		onExplainFigure,
		onConfirmReExplainFigure,
		onCancelReExplainFigure,
		onStartAdjustHighlight,
		onSaveAdjustedHighlight,
		onCancelAdjustHighlight,
		actionState,
		adjustmentDraft,
		highlightPopup,
		editHighlightPopup,
		newHighlightPopup,
		selectedTool
	}: TipContainerProps = $props();

	let activePopupState: Partial<TTipContainerState> = $state({ show: false });
	let activeTipId = $state<string | undefined>(undefined);
	let show = $state(false);
	let pinned = $state(false);
	let mouseInPopup = $state(false);
	let shouldBeHidden = $state(true);

	let top = $state(0);
	let clampedLeft = $state(0);
	let width = $state(0);
	let height = $state(0);

	const activeHighlight = $derived.by(() => {
		const tipHighlight = activePopupState?.tip?.content?.highlight;
		const id = tipHighlight?.id ?? activePopupState.highlight?.id;
		if (id) {
			return highlightsStore.getHighlightById(id) ?? (tipHighlight as Highlight);
		}
		if (tipHighlight) return tipHighlight as Highlight;
		return activePopupState.highlight;
	});

	const activePosition = $derived.by(() => {
		if (activePopupState?.tip?.position) return activePopupState.tip.position;
		return activePopupState.position;
	});

	const popupMode = $derived(
		getTipPopupMode({
			activeHighlight: activeHighlight ?? undefined,
			pinned,
			adjustmentDraft,
			actionState
		})
	);

	const isSavingAdjustment = $derived.by(() => {
		const id = adjustmentDraft?.highlightId;
		const ids = actionState?.savingAdjustedHighlightIds;
		if (!id || !ids) return false;
		return ids instanceof Set ? ids.has(id) : ids.includes(id);
	});

	const isExplainingActive = $derived.by(() => {
		const id = activeHighlight?.id;
		const ids = actionState?.explainingHighlightIds;
		if (!id || !ids) return false;
		return ids instanceof Set ? ids.has(id) : ids.includes(id);
	});

	const activeActionError = $derived.by(() => {
		const id = activeHighlight?.id;
		return id ? actionState?.errorsByHighlightId?.[id] : undefined;
	});

	function updatePosition() {
		if (!show || !activePosition) return;

		const { boundingRect } = activePosition;
		const pageNode = viewer.getPageView(boundingRect.pageNumber - 1)?.div;
		if (!pageNode) return;

		const containerRect = viewer.container.getBoundingClientRect();
		const entryPoint = activePopupState.entryPoint
			? {
					x:
						activePopupState.entryPoint.clientX - containerRect.left + viewer.container.scrollLeft,
					y: activePopupState.entryPoint.clientY - containerRect.top + viewer.container.scrollTop
				}
			: undefined;

		const position = getTipPosition({
			highlightRect: boundingRect,
			pageOffset: {
				left: pageNode.offsetLeft,
				top: pageNode.offsetTop
			},
			containerScroll: {
				left: viewer.container.scrollLeft,
				top: viewer.container.scrollTop
			},
			containerSize: {
				width: viewer.container.offsetWidth,
				height: viewer.container.clientHeight
			},
			popupSize: { width, height },
			entryPoint,
			isNewSelection: !activeHighlight?.id,
			useCommentEditorPlacement: Boolean(activeHighlight?.id && !pinned)
		});

		top = position.top;
		clampedLeft = position.left;
	}

	function showTip(state: Partial<TTipContainerState>) {
		if (pinned && !state.pinned) return;
		if (show && state.tip_id !== activeTipId) {
			document.dispatchEvent(new CustomEvent(HOVER_BRIDGE_STOP_EVENT));
		}

		activePopupState = state;
		activeTipId = state.tip_id;
		pinned = state.pinned ?? false;
		highlightsStore.setActiveTipHighlightId(state.tip_id ?? state.highlight?.id ?? null, pinned);
		show = true;
		shouldBeHidden = true;
	}

	function hideTip(force = false) {
		if (pinned && !force) return;
		if (mouseInPopup && !force) return;

		show = false;
		pinned = false;
		activePopupState = { show: false };
		activeTipId = undefined;
		highlightsStore.setActiveTipHighlightId(null, false);
		document.dispatchEvent(new CustomEvent(HOVER_BRIDGE_STOP_EVENT));
	}

	function updateTipApi(newState: Partial<TTipContainerState> | null) {
		if (newState === null || newState.show === false) {
			hideTip(newState === null);
			return;
		}

		showTip(newState);
	}

	onMount(() => {
		onTipUpdate(updateTipApi);

		const handleDocumentClick = (event: MouseEvent) => {
			if (!(event.target instanceof Element) || !event.target.closest(TIP_CONTAINER_SELECTOR)) {
				clearTextSelection();
				if (adjustmentDraft) {
					onCancelAdjustHighlight?.();
				}
				hideTip(true);
			}
		};

		document.addEventListener('mousedown', handleDocumentClick, { capture: true });
		return () => {
			document.removeEventListener('mousedown', handleDocumentClick, { capture: true });
		};
	});

	$effect(() => {
		if (show && activePosition && height > 0 && width > 0) {
			updatePosition();
			if (shouldBeHidden) {
				const raf = requestAnimationFrame(() => {
					shouldBeHidden = false;
				});
				return () => cancelAnimationFrame(raf);
			}
		}
	});

	$effect(() => {
		if (adjustmentDraft && !pinned) {
			setPinnedState(true);
		}
	});

	// Highlight actions
	function handleColorChange(targetHighlight: Highlight, colorIndex: number) {
		if (!targetHighlight?.id) return;
		highlightsStore.editHighlight(targetHighlight.id, { color_index: colorIndex });
	}

	async function handleCommentEdit(targetHighlight: Highlight, comment: string) {
		if (!targetHighlight.id) return;
		if (saveHighlightComment) {
			const result = await saveHighlightComment(targetHighlight as CommentedHighlight, comment);
			if (result && typeof result === 'object' && 'ok' in result && result.ok === false) {
				throw new Error(
					'message' in result ? String(result.message) : 'Comment could not be saved.'
				);
			}
			return;
		}
		highlightsStore.editHighlight(targetHighlight.id, { comment });
	}

	async function handleHighlightDelete(targetHighlight: Highlight) {
		if (!targetHighlight.id) return;
		if (deleteHighlight) {
			await deleteHighlight(targetHighlight as CommentedHighlight);
		}
		// TODO: Split comment deletion semantics from full highlight deletion in the adapter layer.
		highlightsStore.deleteHighlight(targetHighlight as CommentedHighlight);
		closeTipForce();
	}

	async function handleAddHighlight(highlight: Highlight) {
		const base = highlight as CommentedHighlight;
		const prepared = prepareHighlightForAdd ? await prepareHighlightForAdd(base) : base;
		const storedHighlight = highlightsStore.addHighlight(prepared);

		setPinnedState(true);
		activePopupState.clearSelection?.();
		activePopupState.highlight = storedHighlight;
		shouldBeHidden = true;
	}

	function setPinnedState(flag: boolean) {
		pinned = flag;
		highlightsStore.setActiveTipHighlightId(activeTipId ?? activeHighlight?.id ?? null, flag);
	}

	function closeTipForce() {
		hideTip(true);
	}
</script>

{#if show && activeHighlight && popupMode !== 'hidden'}
	<div
		role="region"
		aria-label="Tooltip container"
		class={TIP_CONTAINER_CLASS}
		bind:clientHeight={height}
		bind:clientWidth={width}
		style="top: {top}px; left: {clampedLeft}px; padding: 3px; visibility: {shouldBeHidden
			? 'hidden'
			: ''};"
		onmouseenter={() => {
			mouseInPopup = true;
		}}
		onmouseleave={(event) => {
			mouseInPopup = false;
			const leaveEvent = new CustomEvent(HOVER_TIP_LEAVE_EVENT, {
				bubbles: false,
				cancelable: true,
				detail: { clientX: event.clientX, clientY: event.clientY }
			});

			if (document.dispatchEvent(leaveEvent)) {
				hideTip();
			}
		}}
	>
		{#if popupMode === 'adjust-highlight'}
			<AdjustHighlightActionPopup
				isSaving={isSavingAdjustment}
				canSave={Boolean(onSaveAdjustedHighlight)}
				error={activeActionError}
				onCancel={() => {
					onCancelAdjustHighlight?.();
					closeTipForce();
				}}
				onSave={() => {
					if (adjustmentDraft) void onSaveAdjustedHighlight?.(adjustmentDraft);
				}}
			/>
		{:else if popupMode === 'confirm-reexplain'}
			<ConfirmReExplainActionPopup
				isExplaining={isExplainingActive}
				canConfirm={Boolean(onConfirmReExplainFigure)}
				onCancel={() => {
					onCancelReExplainFigure?.();
				}}
				onConfirm={() => {
					void onConfirmReExplainFigure?.(activeHighlight as CommentedHighlight);
				}}
			/>
		{:else if popupMode === 'existing-hover'}
			{#if highlightPopup}
				{@render highlightPopup(activeHighlight, setPinnedState)}
			{:else}
				<DefaultHighlightPopup
					highlight={activeHighlight}
					setPinned={setPinnedState}
					onDeleteHighlight={handleHighlightDelete}
					onExplainFigure={onExplainFigure
						? (highlight) => onExplainFigure(highlight as CommentedHighlight)
						: undefined}
					onAdjustHighlight={(highlight) => onStartAdjustHighlight?.(highlight as CommentedHighlight)}
					{actionState}
				/>
			{/if}
		{:else if popupMode === 'existing-edit'}
			{#if editHighlightPopup}
				{@render editHighlightPopup(
					activeHighlight,
					colors,
					(comment) => handleCommentEdit(activeHighlight, comment),
					(highlight) => {
						// TODO: Future popup cleanup should clarify comment deletion vs highlight deletion semantics.
						void handleCommentEdit(highlight, '');
					},
					(colorIndex) => handleColorChange(activeHighlight, colorIndex)
				)}
			{:else}
				<DefaultEditHighlightPopup
					highlight={activeHighlight}
					{colors}
					onEdit={(comment) => handleCommentEdit(activeHighlight, comment)}
					onClose={closeTipForce}
					onColorChange={(colorIndex) => handleColorChange(activeHighlight, colorIndex)}
				/>
			{/if}
		{:else}
			{#if newHighlightPopup}
				{@render newHighlightPopup(
					activeHighlight,
					colors,
					handleAddHighlight,
					clearTextSelection,
					closeTipForce,
					selectedTool
				)}
			{:else}
				<DefaultNewSelectionPopup
					highlight={activeHighlight}
					{colors}
					onAddHighlight={handleAddHighlight}
					{clearTextSelection}
					onClose={closeTipForce}
					{selectedTool}
				/>
			{/if}
		{/if}
	</div>
{/if}

<style type="text/css">
	:global(.hl_tip_container) {
		position: absolute;
		z-index: 100;
		text-align: center;
		pointer-events: auto;
	}
</style>
