<script lang="ts">
	import type { Highlight } from '$lib/pdf-highlighter/types';
	import { FileText, ImageIcon, Trash2 } from '@lucide/svelte';
	import { Button } from '$lib/components/ui/button/index.js';
	import { DEFAULT_SLOT_HEX, type CategorySlotId } from '$lib/domain/highlight-categories';
	import AnnotationList from './AnnotationList.svelte';
	import { cn } from '$lib/utils';

	interface Props {
		highlight: Highlight;
		onJump: (h: Highlight) => void;
		onDelete: (h: Highlight) => void;
		onRecategorize?: (h: Highlight, category: number | null, color: string) => void;
		categoryLabels: string[];
		decorativeMode: boolean;
		onAddAnnotation: (h: Highlight, body: string) => Promise<void>;
		onUpdateAnnotation: (h: Highlight, id: string, body: string) => Promise<void>;
		onDeleteAnnotation: (h: Highlight, id: string) => Promise<void>;
		expanded?: boolean;
		onToggleExpand?: (h: Highlight) => void;
	}

	let {
		highlight,
		onJump,
		onDelete,
		onRecategorize,
		categoryLabels,
		decorativeMode,
		onAddAnnotation,
		onUpdateAnnotation,
		onDeleteAnnotation,
		expanded = false,
		onToggleExpand
	}: Props = $props();

	const page = $derived(highlight.position?.boundingRect.pageNumber ?? '—');
	const excerpt = $derived(
		highlight.type === 'area' ? 'Area highlight' : (highlight.content?.text ?? '').slice(0, 120)
	);
	const ord = $derived(highlight.ordinal ?? '—');

	let recat = $state(String(highlight.category_slot ?? 1));
	let decoColor = $state(highlight.display_color ?? '#facc15');

	$effect(() => {
		void highlight.id;
		recat = String(highlight.category_slot ?? 1);
		decoColor = highlight.display_color ?? '#facc15';
	});

	function applyRecategory() {
		if (!onRecategorize || !highlight.id) return;
		if (decorativeMode) {
			onRecategorize(highlight, null, decoColor);
			return;
		}
		const slot = parseInt(recat, 10) as CategorySlotId;
		const hex = DEFAULT_SLOT_HEX[slot];
		onRecategorize(highlight, slot, hex);
	}

	const badgeLabel = $derived.by(() => {
		if (decorativeMode) return 'Decorative';
		const s = highlight.category_slot;
		if (s == null) return '—';
		return categoryLabels[s - 1] ?? `Slot ${s}`;
	});
</script>

<div
	id="highlight-{highlight.id}"
	class={cn(
		"flex flex-col gap-2 rounded-lg border border-border p-2 text-sm transition-all",
		expanded ? "bg-accent/30 ring-1 ring-border shadow-sm" : "hover:bg-accent/50"
	)}
	role="listitem"
>
	<div class="flex gap-2">
		<button
			type="button"
			class="flex min-w-0 flex-1 flex-col gap-1 text-left"
			onclick={() => onToggleExpand ? onToggleExpand(highlight) : onJump(highlight)}
		>
			<div class="flex flex-wrap items-center gap-2">
				<span
					class="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground tabular-nums"
				>
					[^{ord}] p.{page}
				</span>
				<span
					class="rounded px-1.5 py-0.5 text-[10px] font-medium text-foreground"
					style="background-color: {highlight.display_color ?? 'var(--muted)'}; color: #111;"
				>
					{badgeLabel}
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
		<div class="flex shrink-0 flex-col gap-1 self-start">
			{#if onRecategorize}
				{#if decorativeMode}
					<input
						type="color"
						class="border-input size-8 cursor-pointer rounded border"
						bind:value={decoColor}
						aria-label="Highlight color"
					/>
				{:else}
					<select
						class="border-input bg-background max-w-[140px] rounded-md border px-1 py-1 text-xs"
						bind:value={recat}
						aria-label="Category slot"
					>
						{#each [1, 2, 3, 4, 5] as slot (slot)}
							<option value={String(slot)}
								>{slot}. {categoryLabels[slot - 1] ?? `Slot ${slot}`}</option
							>
						{/each}
					</select>
				{/if}
				<Button variant="secondary" size="sm" class="text-xs" onclick={applyRecategory}
					>Apply</Button
				>
			{/if}
			<Button
				variant="ghost"
				size="icon"
				class="text-muted-foreground hover:text-destructive"
				aria-label="Delete highlight"
				onclick={() => onDelete(highlight)}
			>
				<Trash2 class="size-4" />
			</Button>
		</div>
	</div>

	{#if expanded}
		<AnnotationList
			highlightId={highlight.id!}
			annotations={highlight.annotations ?? []}
			onCreate={(body) => onAddAnnotation(highlight, body)}
			onUpdate={(id, body) => onUpdateAnnotation(highlight, id, body)}
			onDelete={(id) => onDeleteAnnotation(highlight, id)}
		/>
	{/if}
</div>
