<script lang="ts">
	import { Info, Sparkles, X } from '@lucide/svelte';

	let {
		isExplaining,
		canConfirm,
		onCancel,
		onConfirm
	}: {
		isExplaining: boolean;
		canConfirm: boolean;
		onCancel: () => void;
		onConfirm: () => void;
	} = $props();
</script>

<div class="Highlight__popup action-popup" role="group" aria-label="Confirm figure re-explanation">
	<div class="action-popup-copy">
		<Info size={14} class="description-icon" />
		<div class="action-popup-description">Overwrites the current note.</div>
	</div>
	<div class="separator-v"></div>
	<div class="action-popup-actions">
		<button
			type="button"
			class="TipButton hover-action"
			title="Cancel"
			disabled={isExplaining}
			onclick={(event) => {
				event.stopPropagation();
				onCancel();
			}}
		>
			<X size={14} />
			<span>Cancel</span>
		</button>
		<button
			type="button"
			class="TipButton primary-action hover-action"
			title="Replace AI note"
			disabled={isExplaining || !canConfirm}
			onclick={(event) => {
				event.stopPropagation();
				onConfirm();
			}}
		>
			<Sparkles size={14} class={isExplaining ? 'animate-pulse' : ''} />
			<span>{isExplaining ? 'Replacing...' : 'Replace'}</span>
		</button>
	</div>
</div>

<style>
	.action-popup {
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
</style>
