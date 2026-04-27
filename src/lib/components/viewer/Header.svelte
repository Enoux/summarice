<script lang="ts">
	import type { PdfHighlighterUtils } from '$lib/pdf-highlighter/types';
	import type { Highlight } from '$lib/pdf-highlighter/types';

	import ZoomControl from './ZoomControl.svelte';
	import ExportButton from './ExportButton.svelte';
	import ThemeToggle from './ThemeToggle.svelte';
	import { Button } from '$lib/components/ui/button';
	import { Separator } from '$lib/components/ui/separator';
	import * as Tooltip from '$lib/components/ui/tooltip';
	import { TooltipProvider } from '$lib/components/ui/tooltip';
	import { PanelLeftClose, PanelLeft, PanelRightClose, PanelRight } from '@lucide/svelte';

	interface Props {
		utils: Partial<PdfHighlighterUtils>;
		title?: string;
		pdfSource: string;
		highlights: Highlight[];
		leftPanelOpen: boolean;
		onLeftPanelOpenChange: (v: boolean) => void;
		sidebarOpen: boolean;
		onSidebarOpenChange: (v: boolean) => void;
	}

	let {
		utils,
		title = 'Document',
		pdfSource,
		highlights,
		leftPanelOpen,
		onLeftPanelOpenChange,
		sidebarOpen,
		onSidebarOpenChange
	}: Props = $props();
</script>

<TooltipProvider>
	<header
		class="flex h-14 shrink-0 items-center gap-3 border-b border-border bg-background/95 px-3 backdrop-blur supports-backdrop-filter:bg-background/80"
	>
		<div class="flex min-w-0 flex-1 items-center gap-2">
			<Tooltip.Root>
				<Tooltip.Trigger>
					{#snippet child({ props })}
						<Button
							{...props}
							variant="outline"
							size="icon"
							class="shrink-0"
							onclick={() => onLeftPanelOpenChange(!leftPanelOpen)}
							aria-label={leftPanelOpen ? 'Hide side panel' : 'Show side panel'}
						>
							{#if leftPanelOpen}
								<PanelLeftClose class="size-4" />
							{:else}
								<PanelLeft class="size-4" />
							{/if}
						</Button>
					{/snippet}
				</Tooltip.Trigger>
				<Tooltip.Content side="bottom">
					{leftPanelOpen ? 'Hide side panel' : 'Show side panel'}
				</Tooltip.Content>
			</Tooltip.Root>
			<h1 class="truncate text-sm font-medium">{title}</h1>
		</div>

		<Separator orientation="vertical" class="h-6" />

		<div class="flex flex-wrap items-center justify-center gap-3">

			<ZoomControl {utils} />
		</div>

		<Separator orientation="vertical" class="h-6" />

		<div class="flex min-w-0 flex-1 items-center justify-end gap-2">
			<ExportButton {pdfSource} {highlights} />
			<ThemeToggle />
			<Separator orientation="vertical" class="h-6" />
			<Tooltip.Root>
				<Tooltip.Trigger>
					{#snippet child({ props })}
						<Button
							{...props}
							variant="outline"
							size="icon"
							class="shrink-0"
							onclick={() => onSidebarOpenChange(!sidebarOpen)}
							aria-label={sidebarOpen ? 'Hide highlights panel' : 'Show highlights panel'}
						>
							{#if sidebarOpen}
								<PanelRightClose class="size-4" />
							{:else}
								<PanelRight class="size-4" />
							{/if}
						</Button>
					{/snippet}
				</Tooltip.Trigger>
				<Tooltip.Content side="bottom">
					{sidebarOpen ? 'Hide highlights panel' : 'Show highlights panel'}
				</Tooltip.Content>
			</Tooltip.Root>
		</div>
	</header>
</TooltipProvider>
