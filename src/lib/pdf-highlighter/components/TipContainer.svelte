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
	import { Check, Info, Move, Save, Sparkles, X } from '@lucide/svelte';
	import DefaultHighlightPopup from './DefaultHighlightPopup.svelte';
	import DefaultEditHighlightPopup from './DefaultEditHighlightPopup.svelte';
	import DefaultNewSelectionPopup from './DefaultNewSelectionPopup.svelte';

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

	// --- State Management ---
	let activePopupState: Partial<TTipContainerState> = $state({ show: false });
	let activeTipId = $state<string | undefined>(undefined);
	let show = $state(false);
	let pinned = $state(false);
	let mouseInPopup = $state(false);
	let shouldBeHidden = $state(true); // Used to avoid measurement flashes
	const HOVER_BRIDGE_STOP_EVENT = 'pdf-highlighter:hover-bridge-stop';
	const HOVER_TIP_LEAVE_EVENT = 'pdf-highlighter:hover-tip-leave';
	const COMMENT_EDITOR_PLACEMENT_HEIGHT = 152;

	// Positioning state
	let top = $state(0);
	let clampedLeft = $state(0);
	let width = $state(0);
	let height = $state(0);

	// --- Derived state for cleaner template ---
	const activeHighlight = $derived.by(() => {
		const tipHighlight = activePopupState?.tip?.content?.highlight;
		const id = tipHighlight?.id ?? activePopupState.highlight?.id;
		if (id) {
			return highlightsStore.getHighlightById(id) ?? (tipHighlight as Highlight);
		} else if (tipHighlight) {
			return tipHighlight as Highlight;
		} else if (activePopupState.highlight) {
			return activePopupState.highlight;
		} else {
			return undefined;
		}
	});
	const usesCommentEditorPlacement = $derived(Boolean(activeHighlight?.id));
	const placementHeight = $derived(
		usesCommentEditorPlacement && !pinned
			? Math.max(height, COMMENT_EDITOR_PLACEMENT_HEIGHT)
			: height
	);

	const activePosition = $derived.by(() => {
		if (activePopupState?.tip?.position) {
			return activePopupState.tip.position;
		} else if (activePopupState.position) {
			return activePopupState.position;
		} else {
			return undefined;
		}
	});

	// --- Utilities ---
	const clamp = (value: number, left: number, right: number) =>
		Math.min(Math.max(value, left), right);

	const updatePosition = () => {
		if (!show || !activePosition) return;

		const { boundingRect } = activePosition;
		const pageNumber = boundingRect.pageNumber;
		const pageNode = viewer.getPageView(pageNumber - 1)?.div;
		if (!pageNode) return;

		const containerRect = viewer.container.getBoundingClientRect();
		const scrollTop = viewer.container.scrollTop;

		const highlightTop = boundingRect.top + pageNode.offsetTop;
		const highlightBottom = highlightTop + boundingRect.height;
		const highlightCenter = pageNode.offsetLeft + boundingRect.left + boundingRect.width / 2;

		const isNewSelection = !activeHighlight?.id;

		// Entry point logic in viewer content space
		let entryX: number | undefined;
		let entryY: number | undefined;
		if (activePopupState.entryPoint) {
			entryX =
				activePopupState.entryPoint.clientX - containerRect.left + viewer.container.scrollLeft;
			entryY = activePopupState.entryPoint.clientY - containerRect.top + viewer.container.scrollTop;
		}

		// Side selection
		// Use inflated placementHeight for side decision so hover and edit pick the same side.
		const aboveFits = highlightTop - placementHeight - 10 >= scrollTop;
		const visibleBottom = scrollTop + viewer.container.clientHeight;
		const belowFits = highlightBottom + placementHeight <= visibleBottom;

		let placeBelow = !aboveFits;
		if (activePopupState.entryPoint && aboveFits && belowFits && entryY !== undefined) {
			const distanceToTop = Math.abs(entryY - highlightTop);
			const distanceToBottom = Math.abs(entryY - highlightBottom);
			placeBelow = distanceToBottom < distanceToTop;
		} else if (!aboveFits && !belowFits) {
			// Fallback: if neither fits, default to above unless forced below by scrollTop
			placeBelow = highlightTop - placementHeight - 10 < scrollTop;
		}

		// Use real measured height for the rendered position so the near edge anchors to the highlight.
		const gap = isNewSelection ? 0 : 5;
		top = placeBelow ? highlightBottom + gap : highlightTop - height - gap;

		// Horizontal placement
		const highlightLeft = pageNode.offsetLeft + boundingRect.left;
		const highlightRight = highlightLeft + boundingRect.width;
		const preferredCenter =
			entryX !== undefined ? clamp(entryX, highlightLeft, highlightRight) : highlightCenter;

		clampedLeft = clamp(
			preferredCenter - width / 2,
			viewer.container.scrollLeft,
			viewer.container.offsetWidth - width + viewer.container.scrollLeft - 20
		);
	};

	const showTip = (state: Partial<TTipContainerState>) => {
		if (pinned && !state.pinned) return;
		if (show && state.tip_id !== activeTipId) {
			document.dispatchEvent(new CustomEvent(HOVER_BRIDGE_STOP_EVENT));
		}

		activePopupState = state;
		activeTipId = state.tip_id;
		pinned = state.pinned ?? false;
		highlightsStore.setActiveTipHighlightId(state.tip_id ?? state.highlight?.id ?? null, pinned);
		show = true;
		shouldBeHidden = true; // Start hidden for measurement
	};

	const hideTip = (force = false) => {
		if (pinned && !force) return;

		if (mouseInPopup && !force) return;
		show = false;
		pinned = false;
		activePopupState = { show: false };
		activeTipId = undefined;
		highlightsStore.setActiveTipHighlightId(null, false);
		document.dispatchEvent(new CustomEvent(HOVER_BRIDGE_STOP_EVENT));
	};

	// Public API for the highlighter to update the tip
	const updateTipApi = (newState: Partial<TTipContainerState> | null) => {
		if (newState === null || newState.show === false) {
			hideTip(newState === null); // Force immediately if null
		} else {
			showTip(newState);
		}
	};

	onMount(() => {
		onTipUpdate(updateTipApi);

		const handleDocumentClick = (e: MouseEvent) => {
			// Use capture phase to catch clicks before stopPropagation
			if (!(e.target instanceof Element) || !e.target.closest('.hl_tip_container')) {
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

	// Reactive positioning and visibility toggle
	$effect(() => {
		if (show && activePosition && height > 0 && width > 0) {
			updatePosition();
			if (shouldBeHidden) {
				// Once positioned correctly, show the tip
				const raf = requestAnimationFrame(() => {
					shouldBeHidden = false;
				});
				return () => cancelAnimationFrame(raf);
			}
		}
	});

	// --- Handlers ---
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
		highlightsStore.deleteHighlight(targetHighlight as CommentedHighlight);
		closeTipForce();
	}

	function setPinnedState(flag: boolean) {
		pinned = flag;
		highlightsStore.setActiveTipHighlightId(activeTipId ?? activeHighlight?.id ?? null, flag);
	}

	async function handleAddHighlight(h: Highlight) {
		const base = h as CommentedHighlight;
		const prepared = prepareHighlightForAdd ? await prepareHighlightForAdd(base) : base;
		const _highlight = highlightsStore.addHighlight(prepared);

		setPinnedState(true);
		activePopupState.clearSelection?.();
		activePopupState.highlight = _highlight;
		shouldBeHidden = true;
	}

	function closeTipForce() {
		hideTip(true);
	}

	const isSavingAdjustment = $derived.by(() => {
		const id = adjustmentDraft?.highlightId;
		const ids = actionState?.savingAdjustedHighlightIds;
		if (!id || !ids) return false;
		return ids instanceof Set ? ids.has(id) : ids.includes(id);
	});

	// Ensure adjustment popup stays open and blocks others
	$effect(() => {
		if (adjustmentDraft && !pinned) {
			setPinnedState(true);
		}
	});

	const isConfirmingReExplain = $derived(
		Boolean(activeHighlight?.id && actionState?.pendingReExplainHighlightId === activeHighlight.id)
	);

	const isExplainingActive = $derived.by(() => {
		const id = activeHighlight?.id;
		const ids = actionState?.explainingHighlightIds;
		if (!id || !ids) return false;
		return ids instanceof Set ? ids.has(id) : ids.includes(id);
	});
</script>

{#if show && activeHighlight}
	<div
		role="region"
		aria-label="Tooltip container"
		class="hl_tip_container"
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
		{#if activeHighlight.id}
			<!-- Existing Highlight -->
			{#if adjustmentDraft?.highlightId === activeHighlight.id}
				<div
					class="Highlight__popup action-popup"
					role="group"
					aria-label="Adjust highlight area"
				>
					<div class="action-popup-copy">
						<Move size={14} class="description-icon" />
						<div class="action-popup-description">
							Confirm the new selection area.
						</div>
					</div>
					<div class="separator-v"></div>
					<div class="action-popup-actions">
						<button
							type="button"
							class="TipButton hover-action"
							title="Cancel adjustment"
							disabled={isSavingAdjustment}
							onclick={(e) => {
								e.stopPropagation();
								onCancelAdjustHighlight?.();
								closeTipForce();
							}}><X size={14} /><span>Cancel</span></button
						>
						<button
							type="button"
							class="TipButton primary-action hover-action"
							title="Save adjusted area"
							disabled={isSavingAdjustment || !onSaveAdjustedHighlight}
							onclick={(e) => {
								e.stopPropagation();
								if (adjustmentDraft) void onSaveAdjustedHighlight?.(adjustmentDraft);
							}}
							>{#if isSavingAdjustment}<Save size={14} class="animate-pulse" />{:else}<Check
									size={14}
								/>{/if}<span>{isSavingAdjustment ? 'Saving...' : 'Save'}</span></button
						>
					</div>
					{#if activeHighlight.id && actionState?.errorsByHighlightId?.[activeHighlight.id]}
						<div class="action-popup-error" role="alert">
							{actionState.errorsByHighlightId[activeHighlight.id]}
						</div>
					{/if}
				</div>
			{:else if isConfirmingReExplain}
				<div
					class="Highlight__popup action-popup"
					role="group"
					aria-label="Confirm figure re-explanation"
				>
					<div class="action-popup-copy">
						<Info size={14} class="description-icon" />
						<div class="action-popup-description">
							Overwrites the current note.
						</div>
					</div>
					<div class="separator-v"></div>
					<div class="action-popup-actions">
						<button
							type="button"
							class="TipButton hover-action"
							title="Cancel"
							disabled={isExplainingActive}
							onclick={(e) => {
								e.stopPropagation();
								onCancelReExplainFigure?.();
							}}
						>
							<X size={14} />
							<span>Cancel</span>
						</button>
						<button
							type="button"
							class="TipButton primary-action hover-action"
							title="Replace AI note"
							disabled={isExplainingActive || !onConfirmReExplainFigure}
							onclick={(e) => {
								e.stopPropagation();
								void onConfirmReExplainFigure?.(activeHighlight as CommentedHighlight);
							}}
						>
							<Sparkles size={14} class={isExplainingActive ? 'animate-pulse' : ''} />
							<span>{isExplainingActive ? 'Replacing...' : 'Replace'}</span>
						</button>
					</div>
				</div>
			{:else if !pinned}
				{#if highlightPopup}
					{@render highlightPopup(activeHighlight, setPinnedState)}
				{:else}
					<DefaultHighlightPopup
						highlight={activeHighlight}
						setPinned={setPinnedState}
						onDeleteHighlight={handleHighlightDelete}
						onExplainFigure={onExplainFigure
							? (h) => onExplainFigure(h as CommentedHighlight)
							: undefined}
						onAdjustHighlight={(h) => onStartAdjustHighlight?.(h as CommentedHighlight)}
						{actionState}
					/>
				{/if}
			{:else if editHighlightPopup}
				{@render editHighlightPopup(
					activeHighlight,
					colors,
					(comment) => handleCommentEdit(activeHighlight, comment),
					(h) => {
						void handleCommentEdit(h, '');
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
			<!-- New Selection -->
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

<!-- No svelte:document listener needed as we use onMount for capture-phase mousedown -->

<style type="text/css">
	:global(.hl_tip_container) {
		position: absolute;
		z-index: 100;
		text-align: center;
		pointer-events: auto;

		:global(button.color) {
			border: none;
			padding: 0;
			text-align: center;
			text-decoration: none;
			display: inline-block;
			margin: 2px;
			border-radius: 50%;
			cursor: pointer;
			width: 18px;
			height: 18px;
			transition: transform 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275);
			border: 2px solid transparent;
		}

		:global(button.color:hover) {
			transform: scale(1.2);
			border-color: rgba(0, 0, 0, 0.1);
		}
	}

	:global(.Highlight__popup) {
		border: 1px solid var(--border, #e2e8f0);
		color: var(--foreground, #0f172a);
		padding: 6px;
		width: max-content;
		border-radius: 12px;
		box-shadow:
			0 10px 15px -3px rgba(0, 0, 0, 0.08),
			0 4px 6px -4px rgba(0, 0, 0, 0.04),
			0 0 0 1px rgba(0, 0, 0, 0.02);
		font-size: 13px;
		background-color: var(--background, #fff);
		display: flex;
		align-items: center;
		gap: 1px;
		backdrop-filter: blur(12px);
		-webkit-backdrop-filter: blur(12px);
		transform-origin: center bottom;
	}

	:global(.Highlight__popup.action-popup) {
		align-items: center;
		gap: 6px;
		padding: 6px;
		width: max-content;
		max-width: 480px;
	}

	.action-popup-copy {
		display: flex;
		align-items: center;
		gap: 6px;
		min-width: 0;
		padding: 0 4px;
		text-align: left;
	}

	:global(.description-icon) {
		color: var(--muted-foreground, #64748b);
		flex-shrink: 0;
		opacity: 0.8;
	}

	.action-popup-copy.compact {
		white-space: nowrap;
	}

	.action-popup-title {
		color: var(--foreground, #0f172a);
		font-size: 12px;
		font-weight: 700;
		line-height: 1.2;
	}

	.action-popup-description {
		color: var(--muted-foreground, #64748b);
		line-height: 1.1;
		white-space: nowrap;
		padding-left: 2px;
	}

	.action-popup-actions {
		display: inline-flex;
		align-items: center;
		gap: 4px;
		flex-shrink: 0;
	}

	.action-popup-error {
		max-width: 220px;
		color: var(--destructive, #ef4444);
		font-size: 12px;
		text-align: left;
	}

	:global(.EditPopup) {
		display: flex;
		flex-direction: column;
		max-height: 400px;
		padding: 10px;
	}

	:global(.comment-placeholder) {
		padding: 4px 10px;
		color: var(--muted-foreground, #64748b);
		font-size: 13px;
		font-weight: 400;
		display: flex;
		align-items: center;
	}

	:global(.comment-textarea) {
		width: 100%;
		min-height: 80px;
		padding: 10px;
		border: 1px solid var(--border, #e2e8f0);
		border-radius: 8px;
		background: var(--muted, #f8fafc);
		font-size: 13px;
		line-height: 1.5;
		resize: none;
		outline: none;
		margin-bottom: 10px;
		transition: all 0.2s ease;
	}

	:global(.comment-textarea:focus) {
		border-color: var(--primary, #3b82f6);
		background: var(--background, #fff);
		box-shadow: 0 0 0 3px var(--primary-muted, rgba(59, 130, 246, 0.1));
	}

	:global(.comment-error) {
		display: flex;
		align-items: center;
		gap: 6px;
		margin: -2px 0 8px;
		color: var(--destructive, #ef4444);
		font-size: 12px;
		text-align: left;
	}

	:global(.edit-footer) {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
		padding-top: 2px;
	}

	:global(.color-picker) {
		display: flex;
		gap: 6px;
	}

	:global(.color-swatch) {
		width: 16px;
		height: 16px;
		border-radius: 50%;
		border: 1px solid rgba(0, 0, 0, 0.05);
		cursor: pointer;
		transition: all 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275);
		padding: 0;
	}

	:global(.color-swatch:hover) {
		transform: scale(1.2);
	}

	:global(.color-swatch.active) {
		box-shadow:
			0 0 0 2px var(--background, #fff),
			0 0 0 4px var(--primary, #3b82f6);
	}

	:global(.actions) {
		display: flex;
		align-items: center;
		gap: 4px;
	}

	:global(.delete-confirm) {
		display: flex;
		align-items: center;
		gap: 6px;
		background: var(--destructive-muted, #fef2f2);
		padding: 2px 6px;
		border-radius: 6px;
		font-size: 12px;
		color: var(--destructive, #ef4444);
		font-weight: 500;
	}

	:global(.confirm-btn, .cancel-btn) {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 22px;
		height: 22px;
		border: none;
		border-radius: 4px;
		background: transparent;
		cursor: pointer;
		color: inherit;
		padding: 0;
		transition: all 0.2s ease;
	}

	:global(.confirm-btn:hover) {
		background: var(--destructive, #ef4444);
		color: white;
	}

	:global(.cancel-btn:hover) {
		background: rgba(0, 0, 0, 0.05);
	}

	:global(.TipButton) {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 6px;
		border: none;
		border-radius: 8px;
		height: 30px;
		min-width: 30px;
		padding: 0 10px;
		background: transparent;
		color: var(--muted-foreground, #64748b);
		cursor: pointer;
		transition: all 0.2s ease;
		font-weight: 500;
		position: relative;
		white-space: nowrap;
	}

	:global(.TipButton:hover:not(:disabled)) {
		color: var(--foreground, #0f172a);
		background-color: var(--accent, #f1f5f9);
	}

	:global(.TipButton.primary-action) {
		color: var(--primary, #3b82f6);
		font-weight: 600;
	}

	:global(.TipButton.primary-action:hover) {
		background-color: var(--primary-muted, rgba(59, 130, 246, 0.1));
	}

	:global(.TipButton:disabled) {
		opacity: 0.5;
		cursor: not-allowed;
	}

	:global(.icon-container) {
		position: relative;
		width: 14px;
		height: 14px;
		display: flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
	}

	:global(.icon-abs) {
		position: absolute;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	:global(.separator-v) {
		width: 1px;
		align-self: stretch;
		background-color: var(--border, #e2e8f0);
		margin: 4px 4px;
		opacity: 0.5;
		flex-shrink: 0;
	}

	:global(.separator) {
		width: 1px;
		height: 16px;
		background-color: var(--border, #e2e8f0);
		margin: 0 6px;
	}

	:global(.text-animate-wrapper) {
		display: grid;
		transition: grid-template-columns 0.3s cubic-bezier(0.4, 0, 0.2, 1);
	}

	:global(.text-inner) {
		overflow: hidden;
		display: flex;
		align-items: center;
	}

	:global(.button-text) {
		font-size: 12px;
		white-space: nowrap;
	}
</style>
