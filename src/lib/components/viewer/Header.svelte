<script lang="ts">
	import type { PdfHighlighterUtils } from '$lib/pdf-highlighter/types';
	import type { Highlight } from '$lib/pdf-highlighter/types';

	import ZoomControl from './ZoomControl.svelte';
	import ExportButton from './ExportButton.svelte';
	import { Button } from '$lib/components/ui/button';
	import { Slider } from '$lib/components/ui/slider';
	import * as Tooltip from '$lib/components/ui/tooltip';
	import { TooltipProvider } from '$lib/components/ui/tooltip';
	import * as ToggleGroup from "$lib/components/ui/toggle-group";
	import * as DropdownMenu from "$lib/components/ui/dropdown-menu";
	import { 
		PanelLeftClose, 
		PanelLeft, 
		PanelRightClose, 
		PanelRight,
		MousePointer2,
		Hand,
		Highlighter,
		Square,
		Wrench,
		ZoomIn,
		ZoomOut,
		RotateCcw,
		Search
	} from '@lucide/svelte';

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
		pdfSource,
		highlights,
		leftPanelOpen,
		onLeftPanelOpenChange,
		sidebarOpen,
		onSidebarOpenChange
	}: Props = $props();

	let selectedTool = $derived(utils.selectedTool || 'text_selection');

	const currentScale = $derived.by(() => {
		const s = utils.currentScale;
		if (typeof s === 'number' && !Number.isNaN(s)) {
			return s;
		}
		return 1;
	});

	function setTool(tool: any) {
		// @ts-ignore
		utils.selectedTool = tool;
	}
</script>

<TooltipProvider>
	<header
		class="flex h-11 shrink-0 items-center justify-between border-b border-border bg-muted/30 px-3"
	>
		<!-- Left: Side Panel Toggle -->
		<div class="flex shrink-0 items-center gap-2">
			<Tooltip.Root>
				<Tooltip.Trigger>
					{#snippet child({ props })}
						<Button
							{...props}
							variant="ghost"
							size="icon"
							class="h-8 w-8 shrink-0"
							onclick={() => onLeftPanelOpenChange(!leftPanelOpen)}
							aria-label={leftPanelOpen ? 'Hide side panel' : 'Show side panel'}
						>
							{#if leftPanelOpen}
								<PanelLeftClose class="size-3.5" />
							{:else}
								<PanelLeft class="size-3.5" />
							{/if}
						</Button>
					{/snippet}
				</Tooltip.Trigger>
				<Tooltip.Content side="bottom">
					{leftPanelOpen ? 'Hide side panel' : 'Show side panel'}
				</Tooltip.Content>
			</Tooltip.Root>
		</div>

		<!-- Center: Tools & Zoom -->
		<div class="center-container flex flex-1 min-w-0 items-center justify-center gap-1.5">
			<!-- Desktop: Full Tools Bar -->
			<div class="desktop-tools items-center gap-1.5">
				<ToggleGroup.Root
					type="single"
					value={selectedTool}
					onValueChange={(v) => v && setTool(v)}
					class="bg-muted/50 p-0.5 rounded-md"
				>
					<Tooltip.Root>
						<Tooltip.Trigger>
							{#snippet child({ props })}
								<ToggleGroup.Item value="text_selection" aria-label="Text Selection" {...props} class="h-7 w-7 p-0">
									<MousePointer2 class="size-3.5" />
								</ToggleGroup.Item>
							{/snippet}
						</Tooltip.Trigger>
						<Tooltip.Content side="bottom">Text Selection</Tooltip.Content>
					</Tooltip.Root>

					<Tooltip.Root>
						<Tooltip.Trigger>
							{#snippet child({ props })}
								<ToggleGroup.Item value="hand" aria-label="Hand Tool" {...props} class="h-7 w-7 p-0">
									<Hand class="size-3.5" />
								</ToggleGroup.Item>
							{/snippet}
						</Tooltip.Trigger>
						<Tooltip.Content side="bottom">Hand Tool</Tooltip.Content>
					</Tooltip.Root>

					<Tooltip.Root>
						<Tooltip.Trigger>
							{#snippet child({ props })}
								<ToggleGroup.Item value="highlight_pen" aria-label="Highlight Pen" {...props} class="h-7 w-7 p-0 text-yellow-500 data-[state=on]:bg-yellow-500/10">
									<Highlighter class="size-3.5" />
								</ToggleGroup.Item>
							{/snippet}
						</Tooltip.Trigger>
						<Tooltip.Content side="bottom">Highlight Pen</Tooltip.Content>
					</Tooltip.Root>

					<Tooltip.Root>
						<Tooltip.Trigger>
							{#snippet child({ props })}
								<ToggleGroup.Item value="area_selection" aria-label="Area Selection" {...props} class="h-7 w-7 p-0">
									<Square class="size-3.5" />
								</ToggleGroup.Item>
							{/snippet}
						</Tooltip.Trigger>
						<Tooltip.Content side="bottom">Area Selection</Tooltip.Content>
					</Tooltip.Root>
				</ToggleGroup.Root>

				<div class="mx-1 h-4 w-[1px] bg-border"></div>

				<DropdownMenu.Root>
					<DropdownMenu.Trigger>
						{#snippet child({ props })}
							<Button variant="ghost" size="icon" class="h-7 w-7 p-0" {...props}>
								<Search class="size-3.5" />
							</Button>
						{/snippet}
					</DropdownMenu.Trigger>
					<DropdownMenu.Content align="center" class="w-44 p-2">
						<div class="px-2 py-3">
							<Slider
								min={0.5}
								max={3}
								step={0.05}
								value={currentScale}
								onValueChange={(v) => utils.setCurrentScaleValue?.(Math.round(v * 10) / 10)}
							/>
						</div>
						
						<DropdownMenu.Separator />
						
						<DropdownMenu.Item onclick={() => utils.setCurrentScaleValue?.(Math.min(3, currentScale + 0.1))}>
							<ZoomIn class="mr-2 size-4" />
							Zoom In
						</DropdownMenu.Item>
						<DropdownMenu.Item onclick={() => utils.setCurrentScaleValue?.(Math.max(0.5, currentScale - 0.1))}>
							<ZoomOut class="mr-2 size-4" />
							Zoom Out
						</DropdownMenu.Item>
						<DropdownMenu.Item onclick={() => utils.setCurrentScaleValue?.('auto')}>
							<RotateCcw class="mr-2 size-4" />
							Fit Page
						</DropdownMenu.Item>
					</DropdownMenu.Content>
				</DropdownMenu.Root>
			</div>

			<!-- Mobile/Tablet: Dropdown Menu -->
			<div class="mobile-tools">
				<DropdownMenu.Root>
					<DropdownMenu.Trigger>
						{#snippet child({ props })}
							<Button variant="ghost" size="icon" class="h-8 w-8" {...props}>
								<Wrench class="size-4" />
							</Button>
						{/snippet}
					</DropdownMenu.Trigger>
					<DropdownMenu.Content align="center" class="w-48">
						<DropdownMenu.Label>Tools</DropdownMenu.Label>
						<DropdownMenu.RadioGroup value={selectedTool} onValueChange={setTool}>
							<DropdownMenu.RadioItem value="text_selection">
								<MousePointer2 class="mr-2 size-4" />
								Text Selection
							</DropdownMenu.RadioItem>
							<DropdownMenu.RadioItem value="hand">
								<Hand class="mr-2 size-4" />
								Hand Tool
							</DropdownMenu.RadioItem>
							<DropdownMenu.RadioItem value="highlight_pen">
								<Highlighter class="mr-2 size-4" />
								Highlighter
							</DropdownMenu.RadioItem>
							<DropdownMenu.RadioItem value="area_selection">
								<Square class="mr-2 size-4" />
								Area Selection
							</DropdownMenu.RadioItem>
						</DropdownMenu.RadioGroup>
						<DropdownMenu.Separator />
						<DropdownMenu.Label>Zoom</DropdownMenu.Label>
						<DropdownMenu.Item onclick={() => utils.setCurrentScaleValue?.(Math.min(3, currentScale + 0.1))}>
							<ZoomIn class="mr-2 size-4" />
							Zoom In
						</DropdownMenu.Item>
						<DropdownMenu.Item onclick={() => utils.setCurrentScaleValue?.(Math.max(0.5, currentScale - 0.1))}>
							<ZoomOut class="mr-2 size-4" />
							Zoom Out
						</DropdownMenu.Item>
						<DropdownMenu.Item onclick={() => utils.setCurrentScaleValue?.('auto')}>
							<RotateCcw class="mr-2 size-4" />
							Fit Page
						</DropdownMenu.Item>
					</DropdownMenu.Content>
				</DropdownMenu.Root>
			</div>
		</div>

		<!-- Right: Export & Sidebar Toggle -->
		<div class="flex shrink-0 items-center gap-2">
			<ExportButton {pdfSource} {highlights} />
			
			<div class="h-4 w-[1px] bg-border"></div>

			<Tooltip.Root>
				<Tooltip.Trigger>
					{#snippet child({ props })}
						<Button
							{...props}
							variant="ghost"
							size="icon"
							class="h-8 w-8 shrink-0"
							onclick={() => onSidebarOpenChange(!sidebarOpen)}
							aria-label={sidebarOpen ? 'Hide highlights panel' : 'Show highlights panel'}
						>
							{#if sidebarOpen}
								<PanelRightClose class="size-3.5" />
							{:else}
								<PanelRight class="size-3.5" />
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

<style>
	.center-container {
		container-type: inline-size;
	}

	.desktop-tools {
		display: none;
	}

	.mobile-tools {
		display: flex;
	}

	@container (min-width: 190px) {
		.desktop-tools {
			display: flex;
		}
		.mobile-tools {
			display: none;
		}
	}

	.scrollbar-hide::-webkit-scrollbar {
		display: none;
	}
	.scrollbar-hide {
		-ms-overflow-style: none;
		scrollbar-width: none;
	}
</style>
