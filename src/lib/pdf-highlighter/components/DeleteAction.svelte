<script lang="ts">
	import { Trash2, Check, X, LoaderCircle } from '@lucide/svelte';
	import { fade } from 'svelte/transition';

	let {
		label,
		onConfirm,
		disabled = false,
		variant = 'default',
		processing = $bindable(false)
	}: {
		label: string;
		onConfirm: () => Promise<void>;
		disabled?: boolean;
		variant?: 'default' | 'action';
		processing?: boolean;
	} = $props();

	let confirming = $state(false);

	async function handleConfirm(e: MouseEvent) {
		e.stopPropagation();
		if (processing || disabled) return;
		processing = true;
		try {
			await onConfirm();
		} finally {
			processing = false;
			confirming = false;
		}
	}

	function toggleConfirm(e: MouseEvent) {
		e.stopPropagation();
		if (disabled || processing) return;
		confirming = !confirming;
	}
</script>

{#if confirming}
	<div
		class="delete-confirm-unit {variant === 'action' ? 'variant-action' : 'variant-default'}"
		role="group"
		aria-label="Confirm {label}"
		in:fade={{ duration: 120 }}
	>
		<span class="confirm-prompt">Delete?</span>
		<div class="confirm-actions">
			<button
				type="button"
				class="action-btn confirm-btn"
				title="Confirm {label}"
				disabled={processing || disabled}
				onclick={handleConfirm}
			>
				{#if processing}
					<LoaderCircle size={14} class="animate-spin" />
				{:else}
					<Check size={15} strokeWidth={2.5} />
				{/if}
			</button>
			<button
				type="button"
				class="action-btn cancel-btn"
				title="Cancel"
				disabled={processing || disabled}
				onclick={toggleConfirm}
			>
				<X size={15} strokeWidth={2.5} />
			</button>
		</div>
	</div>
{:else}
	<button
		type="button"
		class="TipButton delete-action-trigger {variant === 'action' ? 'hover-action' : 'delete-highlight-btn'}"
		title={label}
		disabled={disabled || processing}
		onclick={toggleConfirm}
	>
		<Trash2 size={14} />
		<span>{label}</span>
	</button>
{/if}

<style>
	.delete-confirm-unit {
		display: inline-flex;
		align-items: center;
		justify-content: space-between;
		gap: 8px;
		border-radius: 8px;
		padding: 3px 4px 3px 10px;
		color: var(--destructive, #ef4444);
		background-color: color-mix(in srgb, var(--destructive, #ef4444) 8%, transparent);
		font-size: 13px;
		font-weight: 600;
		white-space: nowrap;
		transition: all 0.2s ease;
	}

	.variant-default {
		flex: 1;
		margin: 2px;
		height: 32px;
	}

	.variant-action {
		height: 28px;
	}

	.confirm-prompt {
		user-select: none;
		opacity: 0.9;
	}

	.confirm-actions {
		display: flex;
		align-items: center;
		gap: 2px;
	}

	.action-btn {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 24px;
		height: 24px;
		border-radius: 6px;
		padding: 0;
		transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
		border: none;
		background: transparent;
		cursor: pointer;
	}

	.confirm-btn {
		color: var(--destructive, #ef4444);
	}

	.confirm-btn:hover:not(:disabled) {
		background-color: var(--destructive, #ef4444);
		color: white;
		transform: scale(1.05);
	}

	.cancel-btn {
		color: var(--muted-foreground, #64748b);
	}

	.cancel-btn:hover:not(:disabled) {
		background-color: var(--accent, #f1f5f9);
		color: var(--foreground, #0f172a);
		transform: scale(1.05);
	}

	.action-btn:active:not(:disabled) {
		transform: scale(0.95);
	}

	.action-btn:disabled {
		opacity: 0.5;
		cursor: not-allowed;
		pointer-events: none;
	}

	:global(.delete-action-trigger:disabled) {
		opacity: 0.5 !important;
		cursor: not-allowed !important;
		pointer-events: none !important;
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
