<script lang="ts">
	import { onMount } from 'svelte';
	import { Loader2 } from '@lucide/svelte';
	import { Badge } from '$lib/components/ui/badge/index.js';
	import type { FastSearchClientResult } from '$lib/search/apply-fast-search-client-filters';
	import {
		clampFastSearchPreviewPosition,
		fastSearchPreviewPlacementKey
	} from '$lib/search/clamp-fast-search-preview-position';
	import { loadFastSearchPageThumbnail } from '$lib/search/fast-search-pdf-cache';
	import { resolveFastSearchPreviewPage } from '$lib/search/resolve-fast-search-preview-page';
	import { cn } from '$lib/utils.js';

	const FAST_SEARCH_PREVIEW_DISPLAY_WIDTH_PX = 252;
	const FAST_SEARCH_PREVIEW_DISPLAY_HEIGHT_PX = 336;
	const CURSOR_OFFSET_X = 40;
	const CURSOR_OFFSET_Y = -80;
	const HOVER_OPEN_DELAY_MS = 300;
	const EXIT_TRANSITION_MS = 120;
	const PLACEMENT_TRANSITION_MS = 180;

	type PreviewTarget = {
		result: FastSearchClientResult;
		resultKey: string;
	};

	let {
		target = null,
		cursorX = 0,
		cursorY = 0,
		visible = false
	}: {
		target: PreviewTarget | null;
		cursorX: number;
		cursorY: number;
		visible: boolean;
	} = $props();

	let reducedMotion = $state(false);
	let displayTarget = $state<PreviewTarget | null>(null);
	let dataUrl = $state<string | null>(null);
	let isLoading = $state(false);
	let hasError = $state(false);
	let isCommitted = $state(false);
	let isExiting = $state(false);
	let exitAnimationActive = $state(false);
	let loadGeneration = 0;
	let openDelayTimer: number | null = null;
	let exitTimer: number | null = null;
	let exitFrame: number | null = null;
	let positionTransitionActive = $state(false);
	let placementTransitionTimer: number | null = null;
	let lastPlacementKey = '';

	const pageNumber = $derived(
		displayTarget ? resolveFastSearchPreviewPage(displayTarget.result) : 1
	);
	const position = $derived(
		clampFastSearchPreviewPosition(
			cursorX,
			cursorY,
			FAST_SEARCH_PREVIEW_DISPLAY_WIDTH_PX,
			FAST_SEARCH_PREVIEW_DISPLAY_HEIGHT_PX,
			CURSOR_OFFSET_X,
			CURSOR_OFFSET_Y
		)
	);
	const placementKey = $derived(fastSearchPreviewPlacementKey(position.placement));
	const isMounted = $derived(isCommitted || isExiting);
	const panelMotionClass = $derived(
		reducedMotion
			? 'fast-search-page-preview--reduced-motion'
			: isExiting && exitAnimationActive
				? 'fast-search-page-preview--exit'
				: 'fast-search-page-preview--enter'
	);

	function clearOpenDelayTimer(): void {
		if (openDelayTimer !== null) {
			clearTimeout(openDelayTimer);
			openDelayTimer = null;
		}
	}

	function clearExitTimer(): void {
		if (exitTimer !== null) {
			clearTimeout(exitTimer);
			exitTimer = null;
		}
	}

	function clearExitFrame(): void {
		if (exitFrame !== null) {
			cancelAnimationFrame(exitFrame);
			exitFrame = null;
		}
	}

	function clearPlacementTransitionTimer(): void {
		if (placementTransitionTimer !== null) {
			clearTimeout(placementTransitionTimer);
			placementTransitionTimer = null;
		}
	}

	function finishExit(): void {
		clearExitTimer();
		clearExitFrame();
		isExiting = false;
		exitAnimationActive = false;
		displayTarget = null;
		dataUrl = null;
		isLoading = false;
		hasError = false;
	}

	function beginExit(): void {
		if (!isCommitted && !isExiting) {
			return;
		}
		clearOpenDelayTimer();
		isCommitted = false;
		isExiting = true;
		exitAnimationActive = false;
		clearExitTimer();
		clearExitFrame();
		const exitDuration = reducedMotion ? 80 : EXIT_TRANSITION_MS;
		if (reducedMotion) {
			exitAnimationActive = true;
			exitTimer = window.setTimeout(() => {
				exitTimer = null;
				finishExit();
			}, exitDuration);
			return;
		}
		exitFrame = requestAnimationFrame(() => {
			exitFrame = null;
			exitAnimationActive = true;
			exitTimer = window.setTimeout(() => {
				exitTimer = null;
				finishExit();
			}, exitDuration);
		});
	}

	function loadThumbnailForTarget(currentTarget: PreviewTarget, currentPage: number): void {
		const currentGeneration = loadGeneration + 1;
		loadGeneration = currentGeneration;
		dataUrl = null;
		isLoading = true;
		hasError = false;

		void loadFastSearchPageThumbnail(currentTarget.result.documentId, currentPage)
			.then((thumbnail) => {
				if (loadGeneration !== currentGeneration) {
					return;
				}
				isLoading = false;
				if (thumbnail.dataUrl) {
					dataUrl = thumbnail.dataUrl;
					hasError = false;
					return;
				}
				hasError = true;
			})
			.catch(() => {
				if (loadGeneration !== currentGeneration) {
					return;
				}
				isLoading = false;
				hasError = true;
			});
	}

	function scheduleOpenDelay(currentTarget: PreviewTarget, currentPage: number): void {
		clearOpenDelayTimer();
		openDelayTimer = window.setTimeout(() => {
			openDelayTimer = null;
			if (!visible || !target || target.resultKey !== currentTarget.resultKey) {
				return;
			}
			isCommitted = true;
			isExiting = false;
			displayTarget = currentTarget;
			loadThumbnailForTarget(currentTarget, currentPage);
		}, HOVER_OPEN_DELAY_MS);
	}

	onMount(() => {
		const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
		const updateReducedMotion = (): void => {
			reducedMotion = motionQuery.matches;
		};
		updateReducedMotion();
		motionQuery.addEventListener('change', updateReducedMotion);
		return () => {
			motionQuery.removeEventListener('change', updateReducedMotion);
			clearOpenDelayTimer();
			clearExitTimer();
			clearExitFrame();
			clearPlacementTransitionTimer();
		};
	});

	$effect(() => {
		const key = placementKey;
		if (lastPlacementKey.length > 0 && lastPlacementKey !== key && !reducedMotion) {
			positionTransitionActive = true;
			clearPlacementTransitionTimer();
			placementTransitionTimer = window.setTimeout(() => {
				placementTransitionTimer = null;
				positionTransitionActive = false;
			}, PLACEMENT_TRANSITION_MS);
		}
		lastPlacementKey = key;
	});

	$effect(() => {
		if (target) {
			displayTarget = target;
		}
	});

	$effect(() => {
		if (!visible || !target) {
			loadGeneration += 1;
			clearOpenDelayTimer();
			if (isCommitted || isExiting) {
				beginExit();
			} else {
				isLoading = false;
				hasError = false;
				displayTarget = null;
			}
			return;
		}

		const currentTarget = target;
		const currentPage = resolveFastSearchPreviewPage(currentTarget.result);

		if (isExiting) {
			clearExitTimer();
			clearExitFrame();
			isExiting = false;
			exitAnimationActive = false;
			isCommitted = true;
			displayTarget = currentTarget;
			loadThumbnailForTarget(currentTarget, currentPage);
			return;
		}

		if (isCommitted) {
			clearOpenDelayTimer();
			displayTarget = currentTarget;
			loadThumbnailForTarget(currentTarget, currentPage);
			return;
		}

		scheduleOpenDelay(currentTarget, currentPage);

		return () => {
			clearOpenDelayTimer();
		};
	});
</script>

{#if isMounted && displayTarget}
	<div
		class={cn(
			'fast-search-page-preview-anchor pointer-events-none fixed top-0 left-0 z-[62]',
			positionTransitionActive && !reducedMotion && 'fast-search-page-preview-anchor--motion'
		)}
		style={`transform: translate(${position.left}px, ${position.top}px)`}
		aria-hidden="true"
	>
		<div
			class={cn(
				'fast-search-page-preview overflow-hidden rounded-lg border border-border bg-popover shadow-xl',
				panelMotionClass
			)}
			style:width="{FAST_SEARCH_PREVIEW_DISPLAY_WIDTH_PX}px"
		>
			<div
				class="relative flex aspect-3/4 w-full items-center justify-center bg-muted/40"
				style:min-height="{FAST_SEARCH_PREVIEW_DISPLAY_HEIGHT_PX}px"
			>
				{#if dataUrl && !hasError && !isLoading}
					<img
						src={dataUrl}
						alt=""
						class={cn(
							'h-full w-full object-contain',
							reducedMotion ? '' : 'fast-search-page-preview__image'
						)}
					/>
				{/if}
				{#if isLoading}
					<div class="absolute inset-0 flex items-center justify-center bg-muted/30">
						<Loader2 class="size-6 animate-spin text-muted-foreground" aria-hidden="true" />
					</div>
				{:else if hasError}
					<p class="px-4 text-center text-xs text-muted-foreground">Preview unavailable</p>
				{/if}
				<Badge
					variant="secondary"
					class="absolute right-2 bottom-2 tabular-nums shadow-sm backdrop-blur-sm"
				>
					p. {pageNumber}
				</Badge>
			</div>
		</div>
	</div>
{/if}

<style>
	.fast-search-page-preview-anchor--motion {
		transition: transform 180ms cubic-bezier(0.23, 1, 0.32, 1);
	}

	.fast-search-page-preview--enter {
		opacity: 1;
		transform: scale(1);
		transition:
			opacity 160ms cubic-bezier(0.23, 1, 0.32, 1),
			transform 160ms cubic-bezier(0.23, 1, 0.32, 1);
	}

	.fast-search-page-preview--enter {
		@starting-style {
			opacity: 0;
			transform: scale(0.97);
		}
	}

	.fast-search-page-preview--exit {
		opacity: 0;
		transform: scale(0.9);
		transition:
			opacity 120ms cubic-bezier(0.23, 1, 0.32, 1),
			transform 120ms cubic-bezier(0.23, 1, 0.32, 1);
	}

	.fast-search-page-preview--reduced-motion {
		opacity: 1;
		transform: none;
		transition: opacity 100ms ease;
	}

	.fast-search-page-preview--reduced-motion.fast-search-page-preview--exit {
		opacity: 0;
		transform: none;
	}

	.fast-search-page-preview__image {
		@starting-style {
			opacity: 0;
		}
	}
</style>
