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

	const isGenerating = $derived(annotation.source === 'ai' && annotation.body === 'Generating figure interpretation...');
	const isAiAnnotation = $derived(annotation.source === 'ai');
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
		'group relative rounded-md p-2 text-sm transition-colors select-none',
		isAiAnnotation ? 'bg-primary/5 border border-primary/10' : 'bg-muted/30'
	)}
	onclick={(e) => e.stopPropagation()}
>
	<div class="mb-1 flex items-center justify-between">
		<div class="flex items-center gap-1.5">
			{#if isAiAnnotation}
				<div class={cn(
					"flex items-center gap-1 rounded bg-primary/10 px-1 py-0.5 text-[10px] font-bold uppercase tracking-wider text-primary",
					isGenerating && "animate-pulse ring-1 ring-primary/20"
				)}>
					<Sparkles class={cn("size-2.5", isGenerating && "animate-spin-slow")} />
					{isGenerating ? 'Thinking...' : 'AI'}
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
					onclick={(e) => {
						e.stopPropagation();
						onDelete(annotation.id);
					}}
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
			class={cn(
				"whitespace-pre-wrap break-words transition-all duration-300",
				!isAiAnnotation && "cursor-text",
				isGenerating && "shimmer-text italic text-muted-foreground/70"
			)}
			onclick={(e) => {
				if (isGenerating || isAiAnnotation) return;
				e.stopPropagation();
				isEditing = true;
			}}
		>
			{annotation.body}
		</div>
	{/if}
</div>

<style>
	@keyframes spin-slow {
		from { transform: rotate(0deg); }
		to { transform: rotate(360deg); }
	}
	:global(.animate-spin-slow) {
		animation: spin-slow 3s linear infinite;
	}

	@keyframes shimmer {
		0% { background-position: -200% 0; }
		100% { background-position: 200% 0; }
	}

	:global(.shimmer-text) {
		background: linear-gradient(
			90deg,
			rgba(var(--primary-rgb, 59, 130, 246), 0.1) 25%,
			rgba(var(--primary-rgb, 59, 130, 246), 0.4) 50%,
			rgba(var(--primary-rgb, 59, 130, 246), 0.1) 75%
		);
		background-size: 200% 100%;
		animation: shimmer 2s infinite linear;
		-webkit-background-clip: text;
		-webkit-text-fill-color: transparent;
		background-clip: text;
	}
</style>
