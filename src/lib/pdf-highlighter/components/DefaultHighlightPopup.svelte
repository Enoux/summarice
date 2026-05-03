<script lang="ts">
	import type { Highlight } from '../types';
	import { ChevronDown, Check, LoaderCircle, SquarePen, Trash2, X } from '@lucide/svelte';
	import DeleteAction from './DeleteAction.svelte';

	let {
		highlight,
		setPinned,
		onDeleteHighlight
	}: {
		highlight: Highlight;
		setPinned: (flag: boolean) => void;
		onDeleteHighlight?: (highlight: Highlight) => Promise<void>;
	} = $props();

	const LONG_COMMENT = 120;
	const comment = $derived(highlight.comment ?? '');
	const isLongComment = $derived(comment.length > LONG_COMMENT);
	let commentExpanded = $state(false);
	let isDeleting = $state(false);
	async function handleDelete() {
		if (!onDeleteHighlight) return;
		isDeleting = true;
		try {
			await onDeleteHighlight(highlight);
		} finally {
			isDeleting = false;
		}
	}
</script>

<div
	role="region"
	aria-label="Highlight popup"
	class="Highlight__popup"
	class:has-comment={Boolean(comment)}
>
	{#if comment}
		<div class="comment-row">
			<div class="comment-text-wrapper">
				<p class="comment-p {commentExpanded ? '' : 'line-clamp-2'}">
					{comment}
				</p>
				{#if isLongComment}
					<button
						type="button"
						class="expand-comment"
						aria-expanded={commentExpanded}
						aria-label={commentExpanded ? 'Collapse comment' : 'Expand comment'}
						disabled={isDeleting}
						onclick={(e) => {
							e.stopPropagation();
							commentExpanded = !commentExpanded;
						}}
					>
						<ChevronDown size={13} class={commentExpanded ? 'expanded' : ''} />
						<span>{commentExpanded ? 'Collapse' : 'Expand'}</span>
					</button>
				{/if}
			</div>

			<button
				type="button"
				class="TipButton edit-icon-btn"
				title="Edit comment"
				disabled={isDeleting}
				onclick={(e) => {
					e.stopPropagation();
					setPinned(true);
				}}
			>
				<SquarePen size={14} />
			</button>
		</div>

		<div class="delete-row">
			<DeleteAction
				bind:processing={isDeleting}
				label="Delete Highlight"
				disabled={!onDeleteHighlight}
				onConfirm={handleDelete}
			/>
		</div>
	{:else}
		<div class="no-comment-row">
			<DeleteAction
				bind:processing={isDeleting}
				label="Delete"
				variant="action"
				disabled={!onDeleteHighlight}
				onConfirm={handleDelete}
			/>

			<div class="separator-v"></div>

			<button
				type="button"
				class="TipButton hover-action comment-trigger"
				title="Add comment"
				disabled={isDeleting}
				onclick={(e) => {
					e.stopPropagation();
					setPinned(true);
				}}
			>
				<SquarePen size={14} />
				<span>Add comment</span>
			</button>
		</div>
	{/if}
</div>

<style>
	:global(.Highlight__popup.has-comment) {
		flex-direction: column;
		align-items: stretch;
		gap: 0;
		padding: 0;
		max-width: 320px;
	}

	.comment-row {
		display: flex;
		align-items: flex-start;
		gap: 8px;
		padding: 10px 12px 8px;
	}

	.comment-text-wrapper {
		flex: 1;
		min-width: 0;
		text-align: left;
		padding-top: 2px;
	}

	.comment-p {
		margin: 0;
		white-space: pre-wrap;
		word-break: break-word;
		font-size: 13.5px;
		line-height: 1.5;
		color: var(--foreground, #1e293b);
	}

	.line-clamp-2 {
		display: -webkit-box;
		line-clamp: 2;
		-webkit-line-clamp: 2;
		-webkit-box-orient: vertical;
		overflow: hidden;
	}

	.expand-comment {
		margin-top: 6px;
		display: inline-flex;
		align-items: center;
		gap: 4px;
		border-radius: 6px;
		padding: 2px 6px;
		color: var(--muted-foreground, #64748b);
		font-size: 12px;
		font-weight: 600;
		transition: all 0.2s ease;
	}

	.expand-comment:hover {
		color: var(--primary, #3b82f6);
		background-color: var(--primary-muted, rgba(59, 130, 246, 0.08));
	}

	.expand-comment :global(svg) {
		transition: transform 0.2s cubic-bezier(0.4, 0, 0.2, 1);
	}

	.expand-comment :global(svg.expanded) {
		transform: rotate(180deg);
	}

	.edit-icon-btn {
		flex-shrink: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		width: 30px;
		height: 30px;
		border-radius: 8px;
		padding: 0;
		color: var(--muted-foreground, #64748b);
		transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
		margin-top: -2px;
	}

	.edit-icon-btn:hover {
		background-color: var(--accent, #f1f5f9);
		color: var(--primary, #3b82f6);
		transform: translateY(-1px);
	}

	.delete-row {
		border-top: 1px solid var(--border, #e2e8f0);
		display: flex;
		align-items: stretch;
		padding: 2px;
	}

	.delete-highlight-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 8px;
		padding: 8px 12px;
		width: 100%;
		font-size: 13px;
		font-weight: 500;
		white-space: nowrap;
		color: var(--muted-foreground, #64748b);
		border-radius: 8px;
		transition: all 0.2s ease;
	}

	.delete-highlight-btn:hover:not(:disabled) {
		color: var(--destructive, #ef4444);
		background-color: color-mix(in srgb, var(--destructive, #ef4444) 10%, transparent);
	}

	.delete-highlight-btn:disabled {
		cursor: default;
		opacity: 0.45;
	}

	.no-comment-row {
		display: flex;
		align-items: center;
		gap: 1px;
	}

	.hover-action {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 6px;
		padding: 4px 10px;
		color: var(--muted-foreground, #64748b);
		font-size: 13px;
		font-weight: 500;
		white-space: nowrap;
		border-radius: 8px;
		transition: all 0.2s ease;
	}

	.hover-action:hover:not(:disabled) {
		background-color: var(--accent, #f1f5f9);
		color: var(--foreground, #0f172a);
	}

	.delete-trigger:hover:not(:disabled) {
		color: var(--destructive, #ef4444);
		background-color: color-mix(in srgb, var(--destructive, #ef4444) 10%, transparent);
	}

	.delete-confirm-inline {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 6px;
		border-radius: 8px;
		padding: 4px 10px;
		color: var(--destructive, #ef4444);
		background-color: color-mix(in srgb, var(--destructive, #ef4444) 10%, transparent);
		font-size: 12px;
		font-weight: 600;
		white-space: nowrap;
		flex: 1;
		margin: 2px;
	}

	.confirm-btn,
	.cancel-btn {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 22px;
		height: 22px;
		border-radius: 4px;
		padding: 0;
		transition: background-color 0.15s ease;
	}

	.confirm-btn:hover:not(:disabled) {
		background-color: color-mix(in srgb, var(--destructive, #ef4444) 20%, transparent);
	}

	.cancel-btn {
		color: var(--muted-foreground, #64748b);
	}

	.cancel-btn:hover:not(:disabled) {
		background-color: var(--accent, #f1f5f9);
		color: var(--foreground, #0f172a);
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
