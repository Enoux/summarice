<script lang="ts">
	import type { CommentedHighlight } from '$lib/pdf-highlighter/types';
	import { Trash2, ChevronDown, ExternalLink, MessageSquare, Sparkles } from '@lucide/svelte';
	import { Button } from '$lib/components/ui/button/index.js';
	import * as DropdownMenu from '$lib/components/ui/dropdown-menu/index.js';
	import {
		DEFAULT_SLOT_HEX,
		canonicalHighlightPalette,
		resolveHighlightColor,
		resolveHighlightPalette,
		type CategorySlotId,
		CATEGORY_SLOT_IDS
	} from '$lib/features/highlights/domain/highlight-categories';
	import AnnotationList from './AnnotationList.svelte';
	import { cn } from '$lib/utils';

	interface Props {
		highlight: CommentedHighlight;
		onSelect: (h: CommentedHighlight) => void;
		onDelete: (h: CommentedHighlight) => void;
		onRecategorize?: (h: CommentedHighlight, category: number | null, color: string) => void;
		categoryLabels: string[];
		decorativeMode: boolean;
		viewerColorMode: 'light' | 'dark';
		onAddAnnotation: (h: CommentedHighlight, body: string) => Promise<void>;
		onUpdateAnnotation: (h: CommentedHighlight, id: string, body: string) => Promise<void>;
		onDeleteAnnotation: (h: CommentedHighlight, id: string) => Promise<void>;

		selected?: boolean;
		onHover?: (id: string | null) => void;
		
		citationCount?: number;
		onNavigateToSummary?: () => void;
	}

	let {
		highlight,
		onSelect,
		onDelete,
		onRecategorize,
		categoryLabels,
		decorativeMode,
		viewerColorMode,
		onAddAnnotation,
		onUpdateAnnotation,
		onDeleteAnnotation,

		selected = false,
		onHover,
		citationCount = 0,
		onNavigateToSummary
	}: Props = $props();

	const page = $derived(highlight.position?.boundingRect.pageNumber ?? '—');
	const fullText = $derived(highlight.content?.text ?? '');
	const excerpt = $derived(
		highlight.type === 'area'
			? 'Area highlight'
			: fullText.length > 120
				? fullText.slice(0, 120) + '...'
				: fullText
	);
	const isLongText = $derived(highlight.type === 'text' && fullText.length > 120);
	const commentText = $derived(highlight.comment?.trim() ?? '');
	const isLongComment = $derived(commentText.length > 120);
	const ord = $derived(highlight.ordinal ?? '—');
	const annotations = $derived(highlight.annotations ?? []);
	const annotationCount = $derived(annotations.length);
	const hasAiAnnotation = $derived(annotations.some((a) => a.source === 'ai'));

	let isTextExpanded = $state(false);
	let isCommentExpanded = $state(false);
	let decoColor = $state(highlight.display_color ?? '#facc15');
	const displaySlotHexList = $derived(resolveHighlightPalette(viewerColorMode));
	const highlightDisplayColor = $derived.by(() => {
		if (highlight.display_color) {
			return resolveHighlightColor(highlight.display_color, viewerColorMode);
		}
		const slotIndex = Math.min(Math.max(highlight.color_index ?? 0, 0), displaySlotHexList.length - 1);
		return displaySlotHexList[slotIndex] ?? 'var(--muted)';
	});


	$effect(() => {
		void highlight.id;
		decoColor = highlight.display_color ?? '#facc15';
	});

	function handleRecategorize(slot: number) {
		if (!onRecategorize || !highlight.id) return;
		const categorySlot = slot as CategorySlotId;
		const hex = canonicalHighlightPalette()[categorySlot - 1] ?? DEFAULT_SLOT_HEX[categorySlot];
		onRecategorize(highlight, categorySlot, hex);
	}

	function handleColorChange(e: Event) {
		const target = e.target as HTMLInputElement;
		if (onRecategorize && highlight.id) {
			onRecategorize(highlight, null, target.value);
		}
	}

	const badgeLabel = $derived.by(() => {
		if (decorativeMode) return 'Decorative';
		const s = highlight.category_slot;
		if (s == null) return '—';
		return categoryLabels[s - 1] ?? `Slot ${s}`;
	});

	function handleSelect(e?: MouseEvent) {
		onSelect(highlight);
	}

	function toggleTextExpansion(e: MouseEvent) {
		e.stopPropagation();
		isTextExpanded = !isTextExpanded;
	}

	function toggleCommentExpansion(e: MouseEvent) {
		e.stopPropagation();
		isCommentExpanded = !isCommentExpanded;
	}

	function handleCardKeydown(e: KeyboardEvent) {
		if (e.key !== 'Enter' && e.key !== ' ') return;
		e.preventDefault();
		handleSelect();
	}


</script>

<div
	id="sidebar-highlight-{highlight.id}"
	class={cn(
		'group flex flex-col rounded-xl border border-border transition-all duration-200 bg-muted/40 overflow-hidden cursor-pointer',
		selected ? 'shadow-md ring-1 ring-border' : 'hover:shadow-sm'
	)}
	role="option"
	aria-selected={selected}
	tabindex="0"
	onclick={handleSelect}
	onkeydown={handleCardKeydown}
	onmouseenter={() => onHover?.(highlight.id ?? null)}
	onmouseleave={() => onHover?.(null)}
>
	<!-- Section 1: Context & Source (Floating/Lighter BG) -->
	<div
		class={cn(
			'flex flex-col gap-2 p-3 border-b border-border transition-colors',
			selected ? 'bg-accent/40' : 'bg-card hover:bg-accent/20'
		)}
	>
		<div class="flex min-w-0 flex-1 flex-col gap-2">
			<!-- Header Metadata & Actions -->
			<div class="flex items-center justify-between gap-2">
				<div class="flex flex-wrap items-center gap-2">
					<span
						class="rounded-full bg-muted/80 px-2 py-0.5 text-[10px] font-semibold tracking-wider text-muted-foreground uppercase tabular-nums"
					>
						{ord}. P.{page}
					</span>

					<!-- Semantic Dropdown Chip -->
					{#if onRecategorize}
						{#if decorativeMode}
							<div class="relative flex items-center">
								<input
									type="color"
									class="size-5 cursor-pointer rounded-full border-none bg-transparent p-0"
									bind:value={decoColor}
									oninput={handleColorChange}
									onclick={(e) => e.stopPropagation()}
									aria-label="Highlight color"
								/>
								<span class="ml-1.5 text-[10px] font-medium text-muted-foreground">{badgeLabel}</span>
							</div>
						{:else}
							<DropdownMenu.Root>
								<DropdownMenu.Trigger>
									{#snippet child({ props })}
										<Button
											{...props}
											variant="ghost"
											size="xs"
											class="h-auto rounded-full px-2 py-0.5 text-[10px] font-medium transition-all hover:brightness-95 active:scale-95 "
											style="background-color: {highlightDisplayColor}; color: #111;"
											onclick={(e) => e.stopPropagation()}
										>
											{badgeLabel}
											<ChevronDown class="ml-1 size-3" />
										</Button>
									{/snippet}
								</DropdownMenu.Trigger>
								<DropdownMenu.Content align="start" class="w-fit">
									{#each CATEGORY_SLOT_IDS as slot}
										<DropdownMenu.Item
											onclick={() => handleRecategorize(slot)}
											class="flex items-center gap-2 text-xs"
										>
											<div
												class="size-2 rounded-full"
												style="background-color: {displaySlotHexList[slot - 1] ??
													DEFAULT_SLOT_HEX[slot]}"
											></div>
											<span class="flex-1">{categoryLabels[slot - 1] ?? `Slot ${slot}`}</span>
											{#if highlight.category_slot === slot}
												<div class="size-1.5 rounded-full bg-primary"></div>
											{/if}
										</DropdownMenu.Item>
									{/each}
								</DropdownMenu.Content>
							</DropdownMenu.Root>
						{/if}
					{:else}
						<span
							class="rounded-full px-2 py-0.5 text-[10px] font-bold"
							style="background-color: {highlightDisplayColor}; color: #111;"
						>
							{badgeLabel}
						</span>
					{/if}

					{#if highlight.text_status === 'provisional'}
						<span
							class="flex animate-pulse items-center gap-1.5 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary"
						>
							<span class="size-1 rounded-full bg-primary"></span>
							REFINING
						</span>
					{/if}

					{#if citationCount > 0}
						<button
							type="button"
							class="flex items-center gap-1.5 rounded-full bg-orange-500/10 px-2 py-0.5 text-[10px] font-bold text-orange-600 transition-colors hover:bg-orange-500/20 dark:text-orange-500"
							onclick={(e) => {
								e.stopPropagation();
								onNavigateToSummary?.();
							}}
							title="Click to see where this is cited in the summary"
						>
							<Sparkles class="size-2.5" />
							CITED ×{citationCount}
						</button>
					{:else}
						<span
							class="flex items-center gap-1.5 rounded-full bg-muted px-2 py-0.5 text-[10px] font-bold text-muted-foreground/60"
						>
							UNCITED
						</span>
					{/if}
				</div>

				<div class="opacity-0 transition-opacity group-hover:opacity-100">
					<Button
						variant="ghost"
						size="icon"
						class="size-6 rounded-md text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
						title="Delete highlight"
						onclick={(e) => {
							e.stopPropagation();
							onDelete(highlight);
						}}
					>
						<Trash2 class="size-3.5" />
					</Button>
				</div>
			</div>

			<!-- Content Area -->
			<div class="group/content relative flex min-w-0 flex-col text-left transition-colors">
				<!-- Source Text Row -->
				{#if highlight.type === 'area' && highlight.content?.image}
					<div class="relative mt-1 overflow-hidden rounded-lg border bg-muted/30">
						<img
							src={highlight.content.image}
							alt="Area highlight"
							class="max-h-32 w-full object-contain transition-transform duration-300 group-hover/content:scale-[1.02]"
						/>
						<div
							class="absolute inset-0 flex items-center justify-center bg-black/0 opacity-0 transition-all group-hover/content:bg-black/5 group-hover/content:opacity-100"
						>
							<ExternalLink class="size-5 text-white drop-shadow-md" />
						</div>
					</div>
				{:else}
					<div class="mt-0.5 flex items-start justify-between gap-2">
						<p
							class={cn(
								'text-[11px] leading-relaxed italic text-muted-foreground/80 transition-all duration-200',
								!isTextExpanded && 'line-clamp-2',
								highlight.text_status === 'provisional' && 'shimmer-text opacity-60'
							)}
						>
							"{isTextExpanded ? fullText : excerpt}"
						</p>
						{#if isLongText}
							<Button
								variant="ghost"
								size="icon"
								class="size-6 shrink-0 rounded-md text-muted-foreground transition-colors hover:bg-accent"
								title={isTextExpanded ? 'Collapse source' : 'Expand source'}
								onclick={toggleTextExpansion}
							>
								<ChevronDown
									class={cn('size-3.5 transition-transform duration-200', isTextExpanded && 'rotate-180')}
								/>
							</Button>
						{/if}
					</div>
				{/if}

				<!-- Highlight Comment Row -->
				{#if commentText}
					<div class="mt-1 flex items-start justify-between gap-2">
						<p
							class={cn(
								'whitespace-pre-wrap text-sm font-normal leading-relaxed text-foreground/90',
								'wrap-break-word',
								!isCommentExpanded && 'line-clamp-3'
							)}
						>
							{commentText}
						</p>
						{#if isLongComment}
							<Button
								variant="ghost"
								size="icon"
								class="size-6 shrink-0 rounded-md text-muted-foreground transition-colors hover:bg-accent"
								title={isCommentExpanded ? 'Collapse comment' : 'Expand comment'}
								onclick={toggleCommentExpansion}
							>
								<ChevronDown
									class={cn('size-3.5 transition-transform duration-200', isCommentExpanded && 'rotate-180')}
								/>
							</Button>
						{/if}
					</div>
				{/if}
			</div>
		</div>
	</div>

	<!-- Section 2: Notes (Darker BG) -->
	<div class="flex flex-col p-1.5">
		{#if !selected && annotationCount > 0}
			<div
				class="flex items-center gap-1.5 px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider"
			>
				<MessageSquare class="size-3" />
				{annotationCount}
				{annotationCount === 1 ? 'note' : 'notes'}
			</div>
		{/if}

		<div class="-mt-1" onclick={(e) => e.stopPropagation()} onkeydown={(e) => e.stopPropagation()}>
			<AnnotationList
				highlightId={highlight.id!}
				annotations={annotations}
				showAnnotations={selected}
				onCreate={(body) => onAddAnnotation(highlight, body)}
				onUpdate={(id, body) => onUpdateAnnotation(highlight, id, body)}
				onDelete={(id) => onDeleteAnnotation(highlight, id)}
				onRequestSelect={handleSelect}
			/>
		</div>
	</div>
</div>

<style>
	@keyframes shimmer {
		0% {
			background-position: -200% 0;
		}
		100% {
			background-position: 200% 0;
		}
	}

	:global(.shimmer-text) {
		background: linear-gradient(
			90deg,
			transparent 25%,
			rgba(150, 150, 150, 0.1) 50%,
			transparent 75%
		);
		background-size: 200% 100%;
		animation: shimmer 2s infinite linear;
		display: inline-block;
		width: 100%;
	}

	:global(.dark .shimmer-text) {
		background: linear-gradient(
			90deg,
			transparent 25%,
			rgba(255, 255, 255, 0.05) 50%,
			transparent 75%
		);
		background-size: 200% 100%;
	}
</style>
