<script lang="ts">
	import type { Annotation } from '$lib/pdf-highlighter/types';
	import { Trash2, Sparkles, Check, X } from '@lucide/svelte';
	import { Button } from '$lib/components/ui/button';
	import { cn } from '$lib/utils';

	interface Props {
		annotation: Annotation;
		onUpdate: (id: string, body: string) => Promise<void>;
		onDelete: (id: string) => Promise<void>;
	}

	let { annotation, onUpdate, onDelete }: Props = $props();

	let isEditing = $state(false);
	let editBody = $state(annotation.body);
	let isSaving = $state(false);

	async function save() {
		if (editBody.trim() === annotation.body) {
			isEditing = false;
			return;
		}
		isSaving = true;
		try {
			await onUpdate(annotation.id, editBody);
			isEditing = false;
		} finally {
			isSaving = false;
		}
	}

	function cancel() {
		editBody = annotation.body;
		isEditing = false;
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter' && !e.shiftKey) {
			e.preventDefault();
			save();
		} else if (e.key === 'Escape') {
			cancel();
		}
	}
</script>

<div
	class={cn(
		'group relative rounded-md p-2 text-sm transition-colors',
		annotation.source === 'ai' ? 'bg-primary/5 border border-primary/10' : 'bg-muted/30'
	)}
>
	<div class="mb-1 flex items-center justify-between">
		<div class="flex items-center gap-1.5">
			{#if annotation.source === 'ai'}
				<div class="flex items-center gap-1 rounded bg-primary/10 px-1 py-0.5 text-[10px] font-bold uppercase tracking-wider text-primary">
					<Sparkles class="size-2.5" />
					AI
				</div>
			{/if}
			<span class="text-[10px] text-muted-foreground">
				{new Date(annotation.created_at).toLocaleDateString()}
			</span>
		</div>

		<div class="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
			{#if !isEditing}
				<Button
					variant="ghost"
					size="icon"
					class="h-6 w-6 text-muted-foreground hover:text-destructive"
					onclick={() => onDelete(annotation.id)}
				>
					<Trash2 class="size-3.5" />
				</Button>
			{/if}
		</div>
	</div>

	{#if isEditing}
		<div class="flex flex-col gap-2">
			<textarea
				bind:value={editBody}
				onkeydown={handleKeydown}
				class="min-h-[60px] w-full resize-none rounded border border-input bg-background p-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
				placeholder="Write a note..."
				autofocus
			></textarea>
			<div class="flex justify-end gap-1">
				<Button variant="ghost" size="sm" class="h-7 px-2 text-xs" onclick={cancel} disabled={isSaving}>
					<X class="mr-1 size-3" />
					Cancel
				</Button>
				<Button size="sm" class="h-7 px-2 text-xs" onclick={save} disabled={isSaving}>
					<Check class="mr-1 size-3" />
					Save
				</Button>
			</div>
		</div>
	{:else}
		<!-- svelte-ignore a11y_click_events_have_key_events -->
		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<div 
			class="cursor-text whitespace-pre-wrap break-words"
			onclick={() => (isEditing = true)}
		>
			{annotation.body}
		</div>
	{/if}
</div>
