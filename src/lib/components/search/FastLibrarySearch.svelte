<script lang="ts">
	import { goto } from '$app/navigation';
	import { Loader2, Search, X } from '@lucide/svelte';
	import { Badge } from '$lib/components/ui/badge/index.js';
	import { Separator } from '$lib/components/ui/separator';
	import { cn } from '$lib/utils.js';

	type FastSearchResult =
		| {
				kind: 'direct_highlight' | 'summary_highlight' | 'semantic_highlight';
				highlightId: string;
				documentId: string;
				documentTitle: string;
				pageNumber: number;
				highlightKind: 'text' | 'area';
				text: string | null;
				annotationPreview: string | null;
				color: string;
				href: string;
		  }
		| {
				kind: 'document';
				documentId: string;
				documentTitle: string;
				text: string;
				href: string;
		  };

	type FastSearchLane = {
		id: 'direct' | 'summary' | 'semantic' | 'document';
		label: string;
		results: FastSearchResult[];
	};

	type FastSearchResponse = {
		results: FastSearchResult[];
		lanes: FastSearchLane[];
	};

	type LegacyFastSearchResult = {
		highlightId: string;
		documentId: string;
		documentTitle: string;
		pageNumber: number;
		kind: 'text' | 'area';
		text: string | null;
		annotationPreview: string | null;
		color: string;
		href: string;
	};

	const DEBOUNCE_MS = 220;

	let {
		class: className,
		searchBasePath = '/chat'
	}: {
		class?: string;
		searchBasePath?: string;
	} = $props();

	let query = $state('');
	let lanes = $state<FastSearchLane[]>([]);
	let highlightedIndex = $state(0);
	let isSearching = $state(false);
	let isEnrichmentSearching = $state(false);
	let isSemanticSearching = $state(false);
	let error = $state<string | null>(null);
	let enrichmentError = $state<string | null>(null);
	let semanticError = $state<string | null>(null);
	let completedQuery = $state<string | null>(null);
	let abortController: AbortController | null = null;
	let debounceTimer: number | null = null;

	const trimmedQuery = $derived(query.trim());
	const results = $derived(lanes.flatMap((lane) => lane.results));
	const visibleLanes = $derived(lanes.filter((lane) => lane.results.length > 0));
	const isSearchCycleActive = $derived(
		isSearching || isEnrichmentSearching || isSemanticSearching
	);
	const hasEmptyResults = $derived(
		Boolean(trimmedQuery) &&
			completedQuery === trimmedQuery &&
			!isSearchCycleActive &&
			!error &&
			!enrichmentError &&
			!semanticError &&
			results.length === 0
	);
	const hasDropdown = $derived(
		Boolean(trimmedQuery) &&
			(results.length > 0 ||
				hasEmptyResults ||
				(!isSearchCycleActive &&
					(Boolean(error) || Boolean(enrichmentError) || Boolean(semanticError))))
	);

	const directSearchUrl = $derived(`${searchBasePath}/search?stage=direct`);
	const enrichmentSearchUrl = $derived(`${searchBasePath}/search?stage=enrichment`);
	const semanticSearchUrl = $derived(`${searchBasePath}/search?stage=semantic`);

	function cancelDebouncedSearch(): void {
		if (debounceTimer !== null) {
			clearTimeout(debounceTimer);
			debounceTimer = null;
		}
	}

	function clearSearchState(): void {
		abortController?.abort();
		lanes = [];
		error = null;
		enrichmentError = null;
		semanticError = null;
		isSearching = false;
		isEnrichmentSearching = false;
		isSemanticSearching = false;
		completedQuery = null;
	}

	function clearSearch(): void {
		cancelDebouncedSearch();
		query = '';
		clearSearchState();
		highlightedIndex = 0;
	}

	function scheduleDebouncedSearch(): void {
		cancelDebouncedSearch();
		debounceTimer = window.setTimeout((): void => {
			debounceTimer = null;
			const q = query.trim();
			if (!q) {
				clearSearchState();
				return;
			}
			void executeSearchCycle(q);
		}, DEBOUNCE_MS);
	}

	function handleInput(event: Event): void {
		const inputEvent = event as InputEvent;
		if (inputEvent.isComposing) return;
		const raw = (inputEvent.currentTarget as HTMLInputElement).value;

		if (!raw.trim()) {
			cancelDebouncedSearch();
			clearSearchState();
			return;
		}

		if (inputEvent.data === ' ') {
			cancelDebouncedSearch();
			void executeSearchCycle(raw.trim());
			return;
		}

		scheduleDebouncedSearch();
	}

	async function executeSearchCycle(currentQuery: string): Promise<void> {
		if (!currentQuery.trim()) {
			clearSearchState();
			return;
		}

		abortController?.abort();

		const controller = new AbortController();
		abortController = controller;

		isSearching = true;
		isEnrichmentSearching = false;
		isSemanticSearching = false;
		error = null;
		enrichmentError = null;
		semanticError = null;
		completedQuery = null;

		try {
			const directResponse = await fetchSearch(directSearchUrl, currentQuery, controller, null);

			lanes = normalizeLanes(directResponse);
			highlightedIndex = 0;
			completedQuery = currentQuery;
			isSearching = false;
			isEnrichmentSearching = true;

			try {
				const enrichmentResponse = await fetchSearch(
					enrichmentSearchUrl,
					currentQuery,
					controller,
					directResponse
				);

				lanes = normalizeLanes(enrichmentResponse);
				const merged = lanes.flatMap((lane) => lane.results);
				highlightedIndex = Math.min(highlightedIndex, Math.max(merged.length - 1, 0));
				completedQuery = currentQuery;

				isEnrichmentSearching = false;
				isSemanticSearching = true;

				try {
					const semanticResponse = await fetchSearch(
						semanticSearchUrl,
						currentQuery,
						controller,
						enrichmentResponse
					);

					lanes = normalizeLanes(semanticResponse);
					const semanticMerged = lanes.flatMap((lane) => lane.results);
					highlightedIndex = Math.min(
						highlightedIndex,
						Math.max(semanticMerged.length - 1, 0)
					);
					completedQuery = currentQuery;
				} catch (searchError) {
					if (controller.signal.aborted) return;
					void searchError;
					semanticError = 'Related ideas are unavailable.';
				}
			} catch (searchError) {
				if (controller.signal.aborted) return;
				void searchError;
				enrichmentError = 'More matches are unavailable.';
			}
		} catch (searchError) {
			if (controller.signal.aborted) return;
			error = searchError instanceof Error ? searchError.message : 'Search failed';
			lanes = [];
			completedQuery = null;
		} finally {
			if (!controller.signal.aborted) {
				isSearching = false;
				isEnrichmentSearching = false;
				isSemanticSearching = false;
			}
		}
	}

	async function fetchSearch(
		url: string,
		currentQuery: string,
		controller: AbortController,
		previousResponse: FastSearchResponse | null
	): Promise<FastSearchResponse> {
		const response = await fetch(url, {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ query: currentQuery, previousResponse }),
			signal: controller.signal
		});
		const payload = (await response.json()) as FastSearchResponse | { error?: string };

		if (!response.ok) {
			throw new Error('error' in payload && payload.error ? payload.error : 'Search failed');
		}

		return payload as FastSearchResponse;
	}

	function handleKeydown(event: KeyboardEvent): void {
		if (event.key === 'ArrowDown') {
			event.preventDefault();
			highlightedIndex = Math.min(highlightedIndex + 1, Math.max(results.length - 1, 0));
		}

		if (event.key === 'ArrowUp') {
			event.preventDefault();
			highlightedIndex = Math.max(highlightedIndex - 1, 0);
		}

		if (event.key === 'Enter' && results[highlightedIndex]) {
			event.preventDefault();
			void openResult(results[highlightedIndex]);
		}
	}

	async function openResult(result: FastSearchResult): Promise<void> {
		// eslint-disable-next-line svelte/no-navigation-without-resolve -- destination path comes from search API at runtime
		await goto(result.href);
	}

	function resultText(result: FastSearchResult): string {
		if (result.kind === 'document') return result.text.trim();
		if (result.highlightKind === 'area') return '[area highlight]';
		return result.text?.trim() || '[area highlight]';
	}

	function resultKindLabel(result: FastSearchResult): string {
		if (result.kind === 'document') return 'Document';
		if (result.kind === 'semantic_highlight') return 'Related idea';
		if (result.kind === 'summary_highlight') return 'Summary match';
		return 'Highlight';
	}

	function normalizeLanes(response: FastSearchResponse): FastSearchLane[] {
		if (response.lanes) return response.lanes;
		return [
			{
				id: 'direct',
				label: 'Direct matches',
				results: ((response.results ?? []) as unknown as LegacyFastSearchResult[]).map(
					(result) => ({
						kind: 'direct_highlight',
						highlightId: result.highlightId,
						documentId: result.documentId,
						documentTitle: result.documentTitle,
						pageNumber: result.pageNumber,
						highlightKind: result.kind,
						text: result.text,
						annotationPreview: result.annotationPreview,
						color: result.color,
						href: result.href
					})
				)
			}
		];
	}

	function resultKey(result: FastSearchResult): string {
		if (result.kind === 'document') return `document:${result.documentId}`;
		return `highlight:${result.highlightId}:${result.kind}`;
	}
</script>

<div class={cn('w-full text-foreground', className)}>
	<div class="mb-4 flex justify-center">
		<div
			class="grid grid-cols-2 rounded-lg border border-border bg-muted p-1 text-sm font-medium"
			aria-label="Search mode"
		>
			<button
				type="button"
				class="rounded-md bg-background px-4 py-2 text-foreground shadow-sm"
				aria-pressed="true"
			>
				Fast
			</button>
			<button
				type="button"
				class="cursor-not-allowed rounded-md px-4 py-2 text-muted-foreground"
				disabled
				aria-disabled="true"
			>
				Deep
			</button>
		</div>
	</div>

	<div class="relative">
		<div
			class="flex min-h-14 items-center gap-3 rounded-2xl border border-border bg-card px-4 shadow-sm"
		>
			<Search class="size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
			<input
				bind:value={query}
				oninput={handleInput}
				onkeydown={handleKeydown}
				class="h-12 min-w-0 flex-1 border-0 bg-transparent text-base outline-none placeholder:text-muted-foreground focus-visible:ring-0 md:text-base"
				placeholder="Search highlights, notes, summaries..."
				aria-label="Search your library"
				aria-autocomplete="list"
				aria-expanded={hasDropdown}
				aria-busy={isSearchCycleActive}
				autocomplete="off"
				spellcheck="false"
			/>
			{#if isSearchCycleActive}
				<Loader2
					class="size-5 shrink-0 animate-spin text-muted-foreground"
					aria-hidden="true"
				/>
			{:else if trimmedQuery}
				<button
					type="button"
					class="shrink-0 rounded-md p-0.5 text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
					aria-label="Clear search"
					onclick={clearSearch}
				>
					<X class="size-5" aria-hidden="true" />
				</button>
			{/if}
		</div>

		{#if hasDropdown}
			<!-- Outer: border + shadow (no overflow-hidden here — it would clip the shadow). Inner: overflow-hidden + rounded-xl masks list to full radius including bottom. -->
			<div class="absolute left-0 right-0 top-full z-50 mt-2" role="presentation">
				<div
					class="rounded-xl border border-border bg-popover text-popover-foreground shadow-xl"
				>
					<div class="overflow-hidden rounded-xl">
						<div
							class="minimal-scrollbar touch-pan-y max-h-[min(32rem,calc(100svh-15rem-max(env(safe-area-inset-bottom,0px),12px)))] overflow-y-auto overflow-x-hidden overscroll-y-contain p-2 pb-4 pt-1 [scrollbar-gutter:stable] sm:max-h-[min(36rem,calc(100svh-14rem-max(env(safe-area-inset-bottom,0px),12px)))]"
							role="listbox"
							aria-label="Search results"
						>
							{#if error}
								<div class="px-3 py-4 text-sm text-destructive" role="alert">{error}</div>
							{:else if hasEmptyResults}
								<div class="px-3 py-4 text-sm text-muted-foreground">
									No matching highlights found.
								</div>
							{:else}
								{#each visibleLanes as lane, laneIndex (lane.id)}
									{#if laneIndex > 0}
										<Separator class="my-2" />
									{/if}
									<div class="px-1" role="group" aria-label={lane.label}>
										<p class="px-2 py-1.5 text-xs font-medium leading-snug text-muted-foreground">
											{lane.label}
										</p>
										{#each lane.results as result (resultKey(result))}
											{@const index = results.findIndex(
												(visibleResult) => resultKey(visibleResult) === resultKey(result)
											)}
											<button
												type="button"
												class="flex w-full gap-3 rounded-lg px-2 py-3 text-left transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
												class:bg-muted={index === highlightedIndex}
												role="option"
												aria-selected={index === highlightedIndex}
												title={`${result.documentTitle} — ${resultText(result)}`}
												onclick={() => openResult(result)}
											>
												<span
													class="mt-0.5 h-12 w-1 shrink-0 rounded-full {result.kind === 'document'
														? 'bg-muted-foreground'
														: ''}"
													style={result.kind === 'document'
														? undefined
														: `background-color: ${result.color}`}
												></span>
												<span class="min-w-0 flex-1">
													<span class="flex flex-wrap items-start justify-between gap-2 gap-y-1">
														<span class="min-w-0 flex-1 text-sm font-semibold leading-snug text-foreground">
															{result.documentTitle}
														</span>
														<span class="flex shrink-0 flex-wrap items-center justify-end gap-1.5">
															<Badge variant="outline" class="font-normal text-muted-foreground">
																{resultKindLabel(result)}
															</Badge>
															{#if result.kind !== 'document'}
																<Badge variant="secondary" class="tabular-nums">
																	p. {result.pageNumber}
																</Badge>
															{/if}
														</span>
													</span>
													<span
														class="mt-1.5 block text-sm leading-relaxed text-muted-foreground line-clamp-3"
													>
														{resultText(result)}
													</span>
													{#if result.kind !== 'document' && result.annotationPreview}
														<span class="mt-1.5 block text-xs leading-relaxed text-muted-foreground line-clamp-2">
															Note: {result.annotationPreview}
														</span>
													{/if}
												</span>
											</button>
										{/each}
									</div>
								{/each}
								{#if enrichmentError}
									<div class="px-3 py-2 text-xs text-muted-foreground">{enrichmentError}</div>
								{/if}
								{#if semanticError}
									<div class="px-3 py-2 text-xs text-muted-foreground">{semanticError}</div>
								{/if}
							{/if}
						</div>
					</div>
				</div>
			</div>
		{/if}
	</div>
</div>
