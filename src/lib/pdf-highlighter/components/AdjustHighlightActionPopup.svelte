<script lang="ts">
	import { Check, Move, Save, X } from '@lucide/svelte';

	let {
		isSaving,
		canSave,
		error,
		onCancel,
		onSave
	}: {
		isSaving: boolean;
		canSave: boolean;
		error?: string;
		onCancel: () => void;
		onSave: () => void;
	} = $props();
</script>

<div class="Highlight__popup action-popup" role="group" aria-label="Adjust highlight area">
	<div class="action-popup-copy">
		<Move size={14} class="description-icon" />
		<div class="action-popup-description">Confirm the new selection area.</div>
	</div>
	<div class="separator-v"></div>
	<div class="action-popup-actions">
		<button
			type="button"
			class="TipButton hover-action"
			title="Cancel adjustment"
			disabled={isSaving}
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
			title="Save adjusted area"
			disabled={isSaving || !canSave}
			onclick={(event) => {
				event.stopPropagation();
				onSave();
			}}
		>
			{#if isSaving}
				<Save size={14} class="animate-pulse" />
			{:else}
				<Check size={14} />
			{/if}
			<span>{isSaving ? 'Saving...' : 'Save'}</span>
		</button>
	</div>
	{#if error}
		<div class="action-popup-error" role="alert">{error}</div>
	{/if}
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

	.action-popup-error {
		max-width: 220px;
		color: var(--destructive, #ef4444);
		font-size: 12px;
		text-align: left;
	}
</style>
