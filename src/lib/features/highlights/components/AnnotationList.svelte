<script lang="ts">
	import type { Annotation } from '$lib/pdf-highlighter/types';
	import AnnotationItem from './AnnotationItem.svelte';
	import { Button } from '$lib/components/ui/button';
	import { Plus, MessageSquarePlus } from '@lucide/svelte';

	interface Props {
		highlightId: string;
		annotations: Annotation[];
		onCreate: (body: string) => Promise<void>;
		onUpdate: (id: string, body: string) => Promise<void>;
		onDelete: (id: string) => Promise<void>;
		showAnnotations?: boolean;
		onRequestSelect?: () => void;
	}

	let {
		highlightId,
		annotations = [],
		onCreate,
		onUpdate,
		onDelete,
		showAnnotations = true,
		onRequestSelect
	}: Props = $props();

	let isCreating = $state(false);
	let newBody = $state('');
	let isSaving = $state(false);

	async function create() {
		if (!newBody.trim()) {
			isCreating = false;
			return;
		}
		isSaving = true;
		try {
			await onCreate(newBody);
			newBody = '';
			isCreating = false;
		} finally {
			isSaving = false;
		}
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter' && !e.shiftKey) {
			e.preventDefault();
			create();
		} else if (e.key === 'Escape') {
			isCreating = false;
			newBody = '';
		}
	}

	function startCreating() {
		onRequestSelect?.();
		isCreating = true;
	}
</script>

<div class="mt-2 flex flex-col gap-2" onclick={(e) => e.stopPropagation()}>
	{#if showAnnotations && annotations.length > 0}
		<div class="flex flex-col gap-2">
			{#each annotations as annotation (annotation.id)}
				<AnnotationItem {annotation} {onUpdate} {onDelete} />
			{/each}
		</div>
	{/if}

	{#if isCreating}
		<div class="rounded-md border border-dashed border-primary/30 bg-primary/5 p-2">
			<textarea
				bind:value={newBody}
				onkeydown={handleKeydown}
				class="min-h-[60px] w-full resize-none border-none bg-transparent p-0 text-sm focus:ring-0 focus:outline-none"
				placeholder="Add a note..."
				autofocus
			></textarea>
			<div class="mt-2 flex justify-end gap-1">
				<Button
					variant="ghost"
					size="sm"
					class="h-7 px-2 text-xs"
					onclick={() => (isCreating = false)}
					disabled={isSaving}
				>
					Cancel
				</Button>
				<Button
					size="sm"
					class="h-7 px-2 text-xs"
					onclick={create}
					disabled={isSaving || !newBody.trim()}
				>
					Add Note
				</Button>
			</div>
		</div>
	{:else}
		<Button
			variant="ghost"
			size="sm"
			class="h-8 justify-start gap-2 text-xs text-muted-foreground hover:bg-primary/5 hover:text-primary"
			onclick={startCreating}
		>
			{#if annotations.length === 0}
				<MessageSquarePlus class="size-3.5" />
				Add note
			{:else}
				<Plus class="size-3.5" />
				Add another note
			{/if}
		</Button>
	{/if}
</div>
