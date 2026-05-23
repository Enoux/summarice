<script lang="ts">
	import type { CommentedHighlight } from '$lib/pdf-highlighter/types';
	import type { PdfHighlighterUtils } from '$lib/pdf-highlighter';
	import * as Popover from '$lib/components/ui/popover/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import { ExternalLink } from '@lucide/svelte';
	import { resolveHighlightColor } from '$lib/highlights/color-slots';
	import { cn } from '$lib/utils';
	import { onDestroy, tick } from 'svelte';
	import {
		createHoverBridgeTracker,
		domRectToBridgeRect
	} from '$lib/ui/hover-bridge-geometry';

	interface Props {
		id?: string;
		ordinal: number;
		highlight: CommentedHighlight | null;
		viewerUtils?: Partial<PdfHighlighterUtils>;
		viewerColorMode?: 'light' | 'dark';
		onJumpToHighlight?: (id: string) => void;
	}

	let {
		id,
		ordinal,
		highlight,
		viewerUtils,
		viewerColorMode = 'light',
		onJumpToHighlight
	}: Props = $props();

	const BRIDGE_GAP = 10;

	let isHovered = $state(false);
	let pillEl = $state<HTMLButtonElement | null>(null);
	let popoverContentEl = $state<HTMLElement | null>(null);

	const color = $derived.by(() => {
		if (!highlight) return 'var(--muted-foreground)';
		if (highlight.display_color) {
			return resolveHighlightColor(highlight.display_color, viewerColorMode);
		}
		return 'var(--primary)';
	});

	const pageNumber = $derived(highlight?.position?.boundingRect.pageNumber ?? '—');
	const isArea = $derived(highlight?.type === 'area');
	const content = $derived(highlight?.content?.text ?? '');
	const image = $derived(highlight?.content?.image ?? '');
	const annotation = $derived(
		highlight?.annotations?.find((a) => a.source === 'human')?.body ?? highlight?.comment ?? ''
	);

	function closePopover() {
		bridgeTracker.stop();
		isHovered = false;
	}

	const bridgeTracker = createHoverBridgeTracker({
		gap: BRIDGE_GAP,
		getSourceRect: () => {
			if (!pillEl) return null;
			return domRectToBridgeRect(pillEl.getBoundingClientRect());
		},
		getTargetRect: () => {
			if (!popoverContentEl) return null;
			return domRectToBridgeRect(popoverContentEl.getBoundingClientRect());
		},
		onExitBridge: closePopover,
		onPointerMove: (moveEvent) => {
			const target = moveEvent.target instanceof Element ? moveEvent.target : null;
			if (target && (pillEl?.contains(target) || popoverContentEl?.contains(target))) {
				return 'ignore';
			}
			return 'continue';
		}
	});

	function isNodeInPopover(node: EventTarget | null): boolean {
		if (!(node instanceof Node) || !popoverContentEl) return false;
		return popoverContentEl.contains(node);
	}

	function isNodeInPill(node: EventTarget | null): boolean {
		if (!(node instanceof Node) || !pillEl) return false;
		return pillEl.contains(node);
	}

	function handleOpenChange(open: boolean) {
		if (!open && bridgeTracker.isActive()) return;
		isHovered = open;
	}

	function handlePillMouseEnter() {
		bridgeTracker.stop();
		isHovered = true;
		if (highlight && viewerUtils?.pulseHighlight) {
			viewerUtils.pulseHighlight(highlight.id!);
		}
	}

	async function handlePillMouseLeave(event: MouseEvent) {
		if (isNodeInPopover(event.relatedTarget)) return;
		if (!isHovered) return;
		if (!popoverContentEl) {
			await tick();
		}
		bridgeTracker.start(event);
	}

	function handlePopoverMouseEnter() {
		bridgeTracker.stop();
		isHovered = true;
	}

	async function handlePopoverMouseLeave(event: MouseEvent) {
		if (isNodeInPill(event.relatedTarget)) return;
		if (!isHovered) return;
		if (!pillEl) {
			await tick();
		}
		bridgeTracker.start(event);
	}

	async function handleClick(e: MouseEvent) {
		e.preventDefault();
		e.stopPropagation();
		if (!highlight?.id) return;

		if (viewerUtils?.scrollToHighlight) {
			viewerUtils.scrollToHighlight(highlight, true);
		}

		onJumpToHighlight?.(highlight.id);

		if (typeof history !== 'undefined') {
			history.replaceState(null, '', `#hl-${ordinal}`);
		}
	}

	onDestroy(() => {
		bridgeTracker.stop();
	});
</script>

<Popover.Root open={isHovered} onOpenChange={handleOpenChange}>
	<Popover.Trigger>
		{#snippet child({ props })}
			<button
				{...props}
				bind:this={pillEl}
				{id}
				type="button"
				title={!highlight ? 'highlight has been deleted' : undefined}
				class={cn(
					'inline-flex items-center justify-center rounded-full px-1.5 py-0.5 text-[10px] font-bold leading-none tracking-tight text-white transition-all hover:scale-110 active:scale-95',
					!highlight && 'bg-muted-foreground/40 cursor-not-allowed opacity-60'
				)}
				style="background-color: {color}; vertical-align: super;"
				onmouseenter={handlePillMouseEnter}
				onmouseleave={handlePillMouseLeave}
				onclick={handleClick}
			>
				{ordinal}
			</button>
		{/snippet}
	</Popover.Trigger>
	<Popover.Content
		bind:ref={popoverContentEl}
		class="w-80 p-0 overflow-hidden shadow-2xl border-border bg-card/95 backdrop-blur-md"
		side="top"
		align="center"
		sideOffset={8}
		onmouseenter={handlePopoverMouseEnter}
		onmouseleave={handlePopoverMouseLeave}
	>
		<div class="flex flex-col">
			{#if isArea && image}
				<div class="relative aspect-video w-full border-b bg-muted/30">
					<img src={image} alt="Highlight snippet" class="h-full w-full object-contain" />
				</div>
			{/if}

			<div class="p-4 space-y-3">
				<div class="flex items-center justify-between gap-2">
					<span class="text-[10px] font-bold tracking-widest text-muted-foreground uppercase">
						Highlight {ordinal} • Page {pageNumber}
					</span>
					<Button
						variant="ghost"
						size="xs"
						class="h-7 gap-1.5 text-[10px] font-bold uppercase tracking-wider text-primary hover:bg-primary/10"
						onclick={handleClick}
					>
						Jump
						<ExternalLink class="size-3" />
					</Button>
				</div>

				{#if content}
					<p class="text-xs italic leading-relaxed text-muted-foreground line-clamp-3">
						"{content}"
					</p>
				{/if}

				{#if annotation}
					<div class="rounded-md bg-accent/30 p-2.5">
						<p class="text-[13px] leading-relaxed text-foreground/90 font-medium line-clamp-4">
							{annotation}
						</p>
					</div>
				{/if}

				{#if !highlight}
					<p class="text-xs text-destructive font-medium">
						This highlight has been deleted.
					</p>
				{/if}
			</div>
		</div>
	</Popover.Content>
</Popover.Root>

<style>
	button {
		box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
	}
	button:hover {
		box-shadow: 0 2px 4px rgba(0, 0, 0, 0.15);
	}
</style>
