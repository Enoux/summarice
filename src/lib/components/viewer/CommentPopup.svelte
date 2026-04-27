<script lang="ts">
	import type { Highlight } from '$lib/pdf-highlighter/types';
	import { Pencil } from '@lucide/svelte';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Popover, PopoverContent, PopoverTrigger } from '$lib/components/ui/popover/index.js';

	interface Props {
		highlight: Highlight;
		setPinned: (v: boolean) => void;
	}

	let { highlight, setPinned }: Props = $props();

	const LONG = 80;
	const isLong = $derived((highlight.comment?.length ?? 0) > LONG);
</script>

<div
	class="flex max-w-[280px] items-center gap-2 rounded-md border border-border bg-popover px-3 py-2 text-sm text-popover-foreground shadow-md"
	role="presentation"
>
	<div class="min-w-0 flex-1">
		{#if highlight.comment}
			{#if isLong}
				<Popover>
					<div class="flex flex-col gap-1">
						<p class="line-clamp-2 text-left text-muted-foreground">{highlight.comment}</p>
						<PopoverTrigger
							class="self-start text-xs font-medium text-primary underline-offset-4 hover:underline"
						>
							Read full comment
						</PopoverTrigger>
					</div>
					<PopoverContent
						class="w-[min(100vw-2rem,320px)] max-w-none border shadow-md"
						align="start"
					>
						<p class="text-left text-sm leading-relaxed whitespace-pre-wrap text-foreground">
							{highlight.comment}
						</p>
					</PopoverContent>
				</Popover>
			{:else}
				<p class="text-left">{highlight.comment}</p>
			{/if}
		{:else}
			<p class="text-muted-foreground">No comment</p>
		{/if}
	</div>
	<Button
		type="button"
		variant="ghost"
		size="icon-sm"
		class="shrink-0"
		onclick={() => setPinned(true)}
		aria-label="Edit comment"
	>
		<Pencil class="size-4" />
	</Button>
</div>
