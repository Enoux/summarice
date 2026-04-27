<script lang="ts">
	import { MousePointer2, Hand, Highlighter, SquareDashed, Plus, X } from '@lucide/svelte';
	import * as Tooltip from '$lib/components/ui/tooltip';
	import { Button } from '$lib/components/ui/button';
	import { cn } from '$lib/utils';
	import type { PdfHighlighterUtils } from '$lib/pdf-highlighter/types';

	interface Props {
		utils: Partial<PdfHighlighterUtils>;
		sidebarOpen?: boolean;
	}

	let { utils, sidebarOpen = false }: Props = $props();

	let isOpen = $state(false);

	const tools = [
		{ id: 'text_selection' as const, label: 'Select text', Icon: MousePointer2 },
		{ id: 'hand' as const, label: 'Pan', Icon: Hand },
		{ id: 'highlight_pen' as const, label: 'Pen', Icon: Highlighter },
		{ id: 'area_selection' as const, label: 'Area', Icon: SquareDashed }
	] as const;

	const selectedTool = $derived(utils.selectedTool ?? 'text_selection');

	function onToolChange(id: (typeof tools)[number]['id']) {
		utils.selectedTool = id;
		isOpen = false;
	}

	function toggleOpen() {
		isOpen = !isOpen;
	}
</script>

<div
	class={cn(
		'fixed bottom-6 z-50 flex flex-col-reverse items-end gap-3 transition-all duration-300',
		sidebarOpen ? 'right-[21.5rem]' : 'right-6'
	)}
>
	<!-- Action buttons - shown when FAB is open -->
	{#if isOpen}
		<div class="flex flex-col-reverse gap-2">
			{#each tools as t (t.id)}
				<Tooltip.Root>
					<Tooltip.Trigger>
						{#snippet child({ props })}
							<Button
								{...props}
								variant={selectedTool === t.id ? 'default' : 'outline'}
								size="icon"
								class="h-12 w-12 rounded-full shadow-md"
								onclick={() => onToolChange(t.id)}
							>
								<t.Icon class="h-5 w-5" />
								<span class="sr-only">{t.label}</span>
							</Button>
						{/snippet}
					</Tooltip.Trigger>
					<Tooltip.Content side="left">{t.label}</Tooltip.Content>
				</Tooltip.Root>
			{/each}
		</div>
	{/if}

	<!-- Main FAB button -->
	<Button
		size="icon"
		variant="default"
		class={cn(
			'h-14 w-14 rounded-full shadow-lg transition-all',
			isOpen && 'rotate-45',
			selectedTool === 'text_selection' && !isOpen && 'bg-foreground text-background hover:bg-foreground/90'
		)}
		onclick={toggleOpen}
		aria-label={isOpen ? 'Close menu' : 'Open annotation tools'}
	>
		{#if isOpen}
			<X class="h-6 w-6" />
		{:else}
			<Plus class="h-6 w-6" />
		{/if}
	</Button>
</div>
