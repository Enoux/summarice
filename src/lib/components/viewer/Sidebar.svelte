<script lang="ts">
	import type { Highlight } from '$lib/pdf-highlighter/types';
	import { HighlightsModel } from '$lib/pdf-highlighter';
	import HighlightListItem from './HighlightListItem.svelte';
	import { Search, RotateCcw } from '@lucide/svelte';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { ScrollArea } from '$lib/components/ui/scroll-area/index.js';
	import { Separator } from '$lib/components/ui/separator/index.js';

	interface Props {
		highlightsStore: HighlightsModel<Highlight>;
		onJump: (h: Highlight) => void;
		isOpen?: boolean;
	}

	let { highlightsStore, onJump, isOpen = $bindable(true) }: Props = $props();

	let query = $state('');

	const filtered = $derived.by(() => {
		const q = query.trim().toLowerCase();
		const list = highlightsStore.highlights;
		if (!q) return list;
		return list.filter((h: Highlight) => {
			const text = h.content?.text?.toLowerCase() ?? '';
			const com = h.comment?.toLowerCase() ?? '';
			return text.includes(q) || com.includes(q) || (h.id?.toLowerCase().includes(q) ?? false);
		});
	});

	function jump(h: Highlight) {
		if (h.id) {
			location.hash = `highlight-${h.id}`;
		}
		onJump(h);
	}
</script>

<aside
	class="flex h-full w-[300px] shrink-0 flex-col border-l border-border bg-card transition-all duration-300"
	class:hidden={!isOpen}
	aria-label="Highlights"
>
	<div class="flex items-center gap-2 border-b border-border p-3">
		<Search class="size-4 shrink-0 text-muted-foreground" />
		<Input type="search" bind:value={query} placeholder="Search highlights…" class="flex-1" />
	</div>

	<Separator />

	<ScrollArea class="min-h-0 flex-1" orientation="vertical">
		<div class="flex flex-col gap-2 p-3" role="list">
			{#each filtered as h (h.id)}
				<HighlightListItem
					highlight={h}
					onJump={jump}
					onDelete={(x) => highlightsStore.deleteHighlight(x)}
				/>
			{:else}
				<p class="text-muted-foreground px-1 text-center text-sm">No highlights yet</p>
			{/each}
		</div>
	</ScrollArea>

	<Separator />

	<div class="p-3">
		<Button
			variant="destructive"
			class="w-full gap-2"
			onclick={() => highlightsStore.resetHighlights()}
		>
			<RotateCcw class="size-4" />
			Reset all
		</Button>
	</div>
</aside>
