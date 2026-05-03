<script lang="ts">
	import type { Highlight } from '../types';
	import { Trash2, Check, SquarePen, AlertCircle, LoaderCircle, X } from '@lucide/svelte';
	import DeleteAction from './DeleteAction.svelte';
	import { onDestroy, onMount } from 'svelte';
	import { fade, scale } from 'svelte/transition';
	import {
		clearCommentSaveSuccess,
		createInitialCommentPopupState,
		getCommentSaveDisabled,
		handleCommentDraftInput,
		handleCommentSave
	} from '$lib/pdf-highlighter/lib/comment-popup-state';

	let {
		highlight,
		onEdit,
		onClose
	}: {
		highlight: Highlight;
		colors: string[];
		onEdit: (comment: string) => Promise<void>;
		onClose: () => void;
		onColorChange: (colorIndex: number) => void;
	} = $props();

	let textareaRef = $state<HTMLTextAreaElement>();
	let popupState = $state(createInitialCommentPopupState());
	let isDeleting = $state(false);
	const isSaveDisabled = $derived(getCommentSaveDisabled(popupState) || isDeleting);
	const actionLabel = $derived(popupState.isSuccess ? 'Saved' : 'Save comment');
	const hasSavedComment = $derived(Boolean(popupState.lastSavedComment.trim()));

	$effect(() => {
		const stored = highlight.comment ?? '';
		if (popupState.isSaving || popupState.isSuccess) return;
		if (stored === popupState.lastSavedComment) return;
		popupState = createInitialCommentPopupState(stored);
	});

	async function handleSave() {
		const result = await handleCommentSave(popupState, onEdit);
		if (result === 'noop') onClose();
	}

	async function handleDeleteComment() {
		if (!hasSavedComment) return;
		handleCommentDraftInput(popupState, '');
		const result = await handleCommentSave(popupState, onEdit);
		if (result === 'noop') onClose();
	}

	function handleCommentInput(value: string) {
		handleCommentDraftInput(popupState, value);
	}

	function handleKeyDown(e: KeyboardEvent) {
		if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
			e.preventDefault();
			handleSave();
		}
	}

	onMount(() => {
		textareaRef?.focus();
	});

	onDestroy(() => {
		clearCommentSaveSuccess(popupState);
	});
</script>

<div class="Highlight__popup EditPopup">
	<textarea
		bind:this={textareaRef}
		class="comment-textarea"
		value={popupState.comment}
		disabled={popupState.isSaving}
		onfocus={() => clearCommentSaveSuccess(popupState)}
		oninput={(e) => handleCommentInput(e.currentTarget.value)}
		onkeydown={handleKeyDown}
		placeholder="Add a comment..."
	></textarea>

	{#if popupState.error}
		<div class="comment-error" role="alert" in:fade={{ duration: 120 }}>
			<AlertCircle size={13} />
			<span>{popupState.error}</span>
		</div>
	{/if}

	<div class="edit-footer">
		<div class="comment-actions">
			<DeleteAction
				bind:processing={isDeleting}
				label="Delete comment"
				variant="action"
				disabled={popupState.isSaving || !hasSavedComment}
				onConfirm={handleDeleteComment}
			/>

			<div class="separator-v"></div>

			<button
				class="TipButton comment-action save-btn primary-action"
				class:success={popupState.isSuccess}
				class:disabled={isSaveDisabled}
				title="Save comment (Cmd+Enter)"
				disabled={isSaveDisabled}
				onclick={handleSave}
			>
				<div class="icon-wrapper relative size-4">
					{#if popupState.isSuccess}
						<div
							class="absolute inset-0 flex items-center justify-center text-green-500"
							in:scale={{ duration: 200, start: 0.5 }}
						>
							<Check size={16} strokeWidth={3} />
						</div>
					{:else if popupState.isSaving}
						<div class="absolute inset-0 flex items-center justify-center">
							<LoaderCircle size={14} class="animate-spin" />
						</div>
					{:else}
						<div class="absolute inset-0 flex items-center justify-center" out:fade={{ duration: 100 }}>
							<SquarePen size={14} />
						</div>
					{/if}
				</div>
				<span>{actionLabel}</span>
			</button>
		</div>
	</div>
</div>

<style>
	.comment-actions {
		display: grid;
		width: 100%;
		grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr);
		align-items: center;
		gap: 6px;
	}

	.comment-action {
		display: inline-flex;
		min-width: 0;
		align-items: center;
		justify-content: center;
		gap: 6px;
		padding: 7px 8px;
		white-space: nowrap;
	}

	.delete-comment-btn {
		color: var(--muted-foreground, #64748b);
	}

	.delete-comment-btn:disabled {
		cursor: default;
		opacity: 0.45;
	}

	.delete-comment-btn:hover:not(:disabled) {
		color: var(--destructive, #ef4444);
		background-color: color-mix(in srgb, var(--destructive, #ef4444) 10%, transparent);
	}

	.delete-confirm-inline {
		display: inline-flex;
		min-width: 0;
		align-items: center;
		justify-content: center;
		gap: 6px;
		border-radius: 8px;
		padding: 5px 6px;
		color: var(--destructive, #ef4444);
		background-color: color-mix(in srgb, var(--destructive, #ef4444) 10%, transparent);
		font-size: 12px;
		font-weight: 600;
		white-space: nowrap;
	}

	:global(.animate-spin) {
		animation: spin 0.8s linear infinite;
	}

	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}
</style>
