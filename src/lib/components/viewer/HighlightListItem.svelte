<script lang="ts">
	import type { Highlight } from '$lib/pdf-highlighter/types';
	import { FileText, ImageIcon, Trash2 } from '@lucide/svelte';
	import { Button } from '$lib/components/ui/button/index.js';

	interface Props {
		highlight: Highlight;
		onJump: (h: Highlight) => void;
		onDelete: (h: Highlight) => void;
	}

	let { highlight, onJump, onDelete }: Props = $props();

	const page = $derived(highlight.position?.boundingRect.pageNumber ?? '—');
	const excerpt = $derived(
		highlight.type === 'area' ? 'Area' : (highlight.content?.text ?? '').slice(0, 120)
	);
</script>

<div
	class="flex gap-2 rounded-lg border border-border p-2 text-sm hover:bg-accent/50"
	role="listitem"
>
	<button
		type="button"
		class="flex min-w-0 flex-1 flex-col gap-1 text-left"
		onclick={() => onJump(highlight)}
	>
		<div class="flex items-center gap-2">
			<span
				class="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground tabular-nums"
			>
				p.{page}
			</span>
			{#if highlight.type === 'text'}
				<FileText class="size-3.5 text-muted-foreground" />
			{:else}
				<ImageIcon class="size-3.5 text-muted-foreground" />
			{/if}
		</div>
		{#if highlight.type === 'area' && highlight.content?.image}
			<img
				src={highlight.content.image}
				alt=""
				class="mt-1 max-h-16 rounded border object-contain"
			/>
		{:else}
			<p class="line-clamp-2 text-muted-foreground">{excerpt || '—'}</p>
		{/if}
		{#if highlight.comment}
			<p class="text-xs italic opacity-80">“{highlight.comment}”</p>
		{/if}
	</button>
	<Button
		variant="ghost"
		size="icon"
		class="shrink-0 self-start text-muted-foreground hover:text-destructive"
		aria-label="Delete highlight"
		onclick={() => onDelete(highlight)}
	>
		<Trash2 class="size-4" />
	</Button>
</div>
