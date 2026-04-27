<script lang="ts">
	import type { Highlight } from '$lib/pdf-highlighter/types';
	import { Trash2 } from '@lucide/svelte';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Textarea } from '$lib/components/ui/textarea/index.js';
	import { ToggleGroup, ToggleGroupItem } from '$lib/components/ui/toggle-group/index.js';

	interface BaseProps {
		highlight: Highlight;
		colors: string[];
	}

	interface NewProps extends BaseProps {
		mode: 'new';
		onAdd: (h: Highlight) => void;
		onSave?: never;
		onDelete?: never;
	}

	interface EditProps extends BaseProps {
		mode: 'edit';
		onSave: (comment: string) => void;
		onDelete?: (h: Highlight) => void;
		onAdd?: never;
	}

	type Props = NewProps | EditProps;

	let { highlight, colors, mode, onSave, onAdd, onDelete }: Props = $props();

	let comment = $state('');
	let confirmDelete = $state(false);
	let colorPick = $state('0');

	$effect(() => {
		void highlight.id;
		void highlight.color_index;
		comment = highlight.comment ?? '';
		if (mode === 'new') {
			colorPick = String(highlight.color_index ?? 0);
		}
	});

	function saveEdit() {
		if (mode === 'edit') {
			onSave!(comment);
		}
	}

	function pickColor(index: number) {
		const next = { ...highlight, color_index: index, comment: comment.trim() || undefined };
		if (mode === 'new') {
			onAdd!(next as Highlight);
		}
	}
</script>

<div
	class="w-[min(100vw-2rem,360px)] rounded-md border border-border bg-popover p-3 text-popover-foreground shadow-md"
>
	<label for="comment-input" class="mb-1 block text-xs font-medium text-muted-foreground"
		>Comment</label
	>
	<Textarea
		id="comment-input"
		bind:value={comment}
		class="mb-3 min-h-[88px] resize-y"
		placeholder="Optional note…"
	/>

	{#if mode === 'edit'}
		<div class="flex flex-wrap items-center gap-2">
			<Button type="button" onclick={saveEdit}>Save</Button>
			{#if onDelete}
				{#if confirmDelete}
					<span class="text-xs text-muted-foreground">Delete?</span>
					<Button type="button" variant="destructive" size="sm" onclick={() => onDelete(highlight)}>
						Yes
					</Button>
					<Button type="button" variant="outline" size="sm" onclick={() => (confirmDelete = false)}>
						No
					</Button>
				{:else}
					<Button
						type="button"
						variant="ghost"
						size="icon"
						class="text-destructive hover:bg-destructive/10"
						onclick={() => (confirmDelete = true)}
						aria-label="Delete highlight"
					>
						<Trash2 class="size-4" />
					</Button>
				{/if}
			{/if}
		</div>
	{:else}
		<p class="mb-2 text-xs text-muted-foreground">Pick a highlight color to save</p>
		<ToggleGroup
			type="single"
			bind:value={colorPick}
			variant="outline"
			class="flex w-full flex-wrap gap-2 border-0 bg-transparent p-0 shadow-none"
			spacing={2}
		>
			{#each colors as color, index (`${color}-${index}`)}
				<ToggleGroupItem
					value={String(index)}
					aria-label="Color {index + 1}"
					class="size-8 shrink-0 rounded-full border-2 border-transparent p-0 data-[state=on]:ring-2 data-[state=on]:ring-ring data-[state=on]:ring-offset-2 data-[state=on]:ring-offset-background"
					style="background-color: {color}"
					onclick={() => pickColor(index)}
				/>
			{/each}
		</ToggleGroup>
	{/if}
</div>
