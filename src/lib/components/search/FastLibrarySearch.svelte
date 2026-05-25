<script lang="ts">
	import { goto, preloadData } from '$app/navigation';
	import { page } from '$app/state';
	import {
		Brain,
		Command,
		FileText,
		Highlighter,
		Loader2,
		Search,
		Sparkles,
		X
	} from '@lucide/svelte';
	import type { Component } from 'svelte';
	import { onMount, tick } from 'svelte';
	import FastDeepModeToggle from '$lib/components/search/FastDeepModeToggle.svelte';
	import FastLibrarySearchFilterChips from '$lib/components/search/FastLibrarySearchFilterChips.svelte';
	import FastSearchPagePreview from '$lib/components/search/FastSearchPagePreview.svelte';
	import { Badge } from '$lib/components/ui/badge/index.js';
	import { Separator } from '$lib/components/ui/separator';
	import {
		applyFastSearchClientFilters,
		countFastSearchClientResults,
		type FastSearchClientLane,
		type FastSearchClientResult
	} from '$lib/search/apply-fast-search-client-filters';
	import { readStoredDeepLibrarySearchMode } from '$lib/search/deep-library-search-helpers';
	import {
		DEEP_LIBRARY_SEARCH_MODE_STORAGE_KEY,
		type DeepLibrarySearchMode,
		type DeepLibrarySearchResult,
		type DeepLibrarySearchStatusPhase,
		type DeepLibrarySearchStatusStep
	} from '$lib/search/deep-library-search-types';
	import { consumeDeepSearchSseStream } from '$lib/search/parse-deep-search-sse';
	import { fastSearchResultKey } from '$lib/search/fast-search-result-key';
	import {
		hasActiveFastSearchColorFilter,
		type FastSearchFilters,
		type FastSearchResultScope
	} from '$lib/search/fast-search-types';
	import { resolveFastSearchSubtitle } from '$lib/search/resolve-fast-search-subtitle';
	import { parseWebsearchQuery } from '$lib/search/websearch-query';
	import {
		extractHighlightIdFromHref,
		resultPathname,
		shouldHandleFastSearchResultLocally,
		uniqueFastSearchPrefetchPathnames
	} from '$lib/search/fast-search-navigation';
	import {
		clearFastSearchOptimisticTarget,
		requestFastSearchLocalJump,
		setFastSearchOptimisticTarget
	} from '$lib/search/fast-search-navigation-state.svelte';
	import { cn } from '$lib/utils.js';
	import { toast } from 'svelte-sonner';

	type FastSearchResult =
		| {
				kind:
					| 'recommended_highlight'
					| 'direct_highlight'
					| 'summary_highlight'
					| 'semantic_highlight';
				highlightId: string;
				documentId: string;
				documentTitle: string;
				pageNumber: number;
				highlightKind: 'text' | 'area';
				text: string | null;
				comment: string | null;
				annotationPreview: string | null;
				aiAnnotationPreview: string | null;
				color: string;
				href: string;
		  }
		| {
				kind: 'document';
				documentId: string;
				documentTitle: string;
				text: string;
				tags: string[];
				entities: string[];
				href: string;
		  };

	type FastSearchLane = FastSearchClientLane;

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
		comment?: string | null;
		annotationPreview: string | null;
		aiAnnotationPreview?: string | null;
		color: string;
		href: string;
	};

	const DEBOUNCE_MS = 220;
	const OVERLAY_CLOSE_MS = 160;
	const SEARCH_SIZE_DURATION_MS = 150;
	const SEARCH_TEXT_ENTER_DURATION_MS = 100;
	const SEARCH_TEXT_SETTLE_DELAY_MS = 5;
	const SEARCH_TEXT_REVEAL_DELAY_MS =
		SEARCH_SIZE_DURATION_MS + SEARCH_TEXT_SETTLE_DELAY_MS - SEARCH_TEXT_ENTER_DURATION_MS;
	const EXPANDED_SEARCH_MAX_LINES = 8;
	const EXPANDED_SEARCH_SINGLE_LINE_TOLERANCE_PX = 1;
	const VISIBLE_RESULT_PREFETCH_LIMIT = 5;
	const prefetchedPathnames = new Set<string>();

	let {
		class: className,
		searchBasePath = '/chat',
		expanded = $bindable(false)
	}: {
		class?: string;
		searchBasePath?: string;
		expanded?: boolean;
	} = $props();

	let query = $state('');
	let searchMode = $state<DeepLibrarySearchMode>('fast');
	let searchFilters = $state<FastSearchFilters>({});
	let resultScope = $state<FastSearchResultScope>('both');
	let rawLanes = $state<FastSearchLane[]>([]);
	let recommendedLanes = $state<FastSearchLane[]>([]);
	let highlightedIndex = $state(0);
	let isSearching = $state(false);
	let isEnrichmentSearching = $state(false);
	let isSemanticSearching = $state(false);
	let error = $state<string | null>(null);
	let enrichmentError = $state<string | null>(null);
	let semanticError = $state<string | null>(null);
	let completedQuery = $state<string | null>(null);
	let completedClientFilterSignature = $state<string | null>(null);
	let overlayClosing = $state(false);
	let canHoverPreview = $state(false);
	let previewCursorX = $state(0);
	let previewCursorY = $state(0);
	let previewTarget = $state<FastSearchClientResult | null>(null);
	let previewHoveringListbox = $state(false);
	let isPointerOverListbox = $state(false);
	let isMacPlatform = $state(false);
	let navigationInFlight = $state(false);
	let prefersReducedMotion = $state(false);
	let shellWidthReady = $state(true);
	let deepResults = $state<DeepLibrarySearchResult[]>([]);
	let deepStatusSteps = $state<DeepLibrarySearchStatusStep[]>([]);
	let isDeepSearching = $state(false);
	let deepError = $state<string | null>(null);
	let completedDeepPrompt = $state<string | null>(null);
	let deepAbortController: AbortController | null = null;

	let abortController: AbortController | null = null;
	let recommendationAbortController: AbortController | null = null;
	let debounceTimer: number | null = null;
	let overlayCloseTimer: number | null = null;
	let shellWidthReadyTimer: number | null = null;
	let shellAnchor: HTMLDivElement | null = $state(null);
	let searchInput: HTMLInputElement | HTMLTextAreaElement | null = $state(null);
	let isSearchFieldMultiline = $state(false);
	let ignoreShellOpenClick = false;
	let lastRecommendationSignature: string | null = null;

	const trimmedQuery = $derived(query.trim());
	const parsedQuery = $derived(parseWebsearchQuery(trimmedQuery));
	const shouldSearch = $derived(Boolean(trimmedQuery));
	const isDeepMode = $derived(searchMode === 'deep');
	const deepSearchUrl = $derived(`${searchBasePath}/deep-search`);
	const clientFilterSignature = $derived(JSON.stringify({ searchFilters, resultScope }));
	const currentDocumentId = $derived(resolveCurrentDocumentId());
	const displayedRawLanes = $derived(shouldSearch ? rawLanes : recommendedLanes);
	const filteredLanes = $derived(
		applyFastSearchClientFilters(displayedRawLanes, searchFilters, resultScope)
	);
	const visibleLanes = $derived(filteredLanes.filter((lane) => lane.results.length > 0));
	const filteredResults = $derived(visibleLanes.flatMap((lane) => lane.results));
	const rawResultCount = $derived(countFastSearchClientResults(rawLanes));
	const isSearchCycleActive = $derived(
		isDeepMode ? isDeepSearching : isSearching || isEnrichmentSearching || isSemanticSearching
	);
	const hasDeepDropdown = $derived(isDeepMode && expanded);
	const hasServerEmptyResults = $derived(
		shouldSearch &&
			completedQuery === trimmedQuery &&
			completedClientFilterSignature === clientFilterSignature &&
			!isSearchCycleActive &&
			!error &&
			!enrichmentError &&
			!semanticError &&
			rawResultCount === 0
	);
	const hasFilterEmptyResults = $derived(
		shouldSearch &&
			completedQuery === trimmedQuery &&
			completedClientFilterSignature === clientFilterSignature &&
			!isSearchCycleActive &&
			!error &&
			!enrichmentError &&
			!semanticError &&
			rawResultCount > 0 &&
			filteredResults.length === 0
	);
	const hasEmptyResults = $derived(hasServerEmptyResults || hasFilterEmptyResults);
	const hasDropdown = $derived(
		isDeepMode
			? hasDeepDropdown
			: (!shouldSearch && filteredResults.length > 0) ||
					(shouldSearch &&
						(filteredResults.length > 0 ||
							hasEmptyResults ||
							(!isSearchCycleActive &&
								(Boolean(error) || Boolean(enrichmentError) || Boolean(semanticError)))))
	);
	const deepKeyboardResults = $derived(deepResults);
	const showClearControl = $derived(
		Boolean(trimmedQuery) || hasActiveFastSearchColorFilter(searchFilters) || resultScope !== 'both'
	);
	const SEARCH_HINT_CLASS =
		'fast-search-shortcut-hint inline-flex h-5 shrink-0 items-center justify-center gap-0.5 rounded-full border border-border bg-muted px-2 font-sans text-[10px] font-medium not-italic leading-none text-muted-foreground';
	const SEARCH_STATUS_MESSAGE_CLASS = 'py-2 text-sm leading-snug text-muted-foreground';
	const SEARCH_ERROR_MESSAGE_CLASS = 'py-2 text-sm leading-snug text-destructive';
	const overlayVisible = $derived(expanded || overlayClosing);
	const panelMotion = $derived(overlayClosing ? 'exit' : expanded ? 'enter' : 'instant');

	const directSearchUrl = $derived(`${searchBasePath}/search?stage=direct`);
	const recommendedSearchUrl = $derived(`${searchBasePath}/search?stage=recommended`);
	const enrichmentSearchUrl = $derived(`${searchBasePath}/search?stage=enrichment`);
	const semanticSearchUrl = $derived(`${searchBasePath}/search?stage=semantic`);
	const previewTargetPayload = $derived(
		previewTarget ? { result: previewTarget, resultKey: fastSearchResultKey(previewTarget) } : null
	);
	const isKeyboardHighlightVisible = $derived(!isPointerOverListbox);
	const isAiThinking = $derived(isDeepMode && isDeepSearching);
	const currentDeepStatusStep = $derived(
		deepStatusSteps.length > 0 ? deepStatusSteps[deepStatusSteps.length - 1] : null
	);
	const searchPlaceholder = $derived(
		isDeepMode ? 'Search your library in plain language…' : 'Search your library'
	);
	function deepStatusLabelBase(label: string): string {
		return label.replace(/[….]+\s*$/u, '').trimEnd();
	}

	function deepStatusPhaseIcon(phase: DeepLibrarySearchStatusPhase): Component {
		if (phase === 'interpreting') {
			return Sparkles;
		}
		if (phase === 'searching') {
			return Search;
		}
		if (phase === 'reading') {
			return FileText;
		}
		if (phase === 'ranking') {
			return Brain;
		}
		return Sparkles;
	}

	onMount(() => {
		if (typeof localStorage !== 'undefined') {
			localStorage.removeItem(DEEP_LIBRARY_SEARCH_MODE_STORAGE_KEY);
		}

		const storedMode = readStoredDeepLibrarySearchMode(
			sessionStorage.getItem(DEEP_LIBRARY_SEARCH_MODE_STORAGE_KEY)
		);
		if (storedMode) {
			searchMode = storedMode;
		}

		isMacPlatform = /Mac|iPhone|iPad|iPod/.test(navigator.platform);
		prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

		const hoverQuery = window.matchMedia('(hover: hover) and (pointer: fine)');
		const updateCanHoverPreview = (): void => {
			canHoverPreview = hoverQuery.matches;
			if (!canHoverPreview) {
				clearPagePreview();
			}
		};
		updateCanHoverPreview();
		hoverQuery.addEventListener('change', updateCanHoverPreview);

		const handleGlobalKeydown = (event: KeyboardEvent): void => {
			if ((event.metaKey || event.ctrlKey) && event.key === 'k') {
				event.preventDefault();
				openExpanded();
				return;
			}

			if (event.key === 'Escape' && expanded) {
				event.preventDefault();
				closeExpanded();
			}
		};

		window.addEventListener('keydown', handleGlobalKeydown);

		return () => {
			hoverQuery.removeEventListener('change', updateCanHoverPreview);
			window.removeEventListener('keydown', handleGlobalKeydown);
			recommendationAbortController?.abort();
			if (overlayCloseTimer !== null) {
				clearTimeout(overlayCloseTimer);
			}
			if (shellWidthReadyTimer !== null) {
				clearTimeout(shellWidthReadyTimer);
			}
		};
	});

	$effect(() => {
		if (!hasDropdown) {
			isPointerOverListbox = false;
			clearPagePreview();
		}
	});

	$effect(() => {
		if (expanded) {
			void tick().then(() => {
				searchInput?.focus();
				syncExpandedSearchFieldLayout();
			});
		}
	});

	$effect(() => {
		if (!expanded) {
			return;
		}

		void searchMode;
		void tick().then(() => {
			requestAnimationFrame(() => {
				syncExpandedSearchFieldLayout();
			});
		});
	});

	$effect(() => {
		if (!expanded) {
			return;
		}

		void query;
		void tick().then(() => {
			syncExpandedSearchFieldHeight();
		});
	});

	$effect(() => {
		if (typeof sessionStorage === 'undefined') {
			return;
		}
		sessionStorage.setItem(DEEP_LIBRARY_SEARCH_MODE_STORAGE_KEY, searchMode);
	});

	$effect(() => {
		if (searchMode === 'deep') {
			cancelDebouncedSearch();
			clearSearchState();
			return;
		}

		deepAbortController?.abort();
		clearDeepState();
	});

	$effect(() => {
		if (isDeepMode) {
			return;
		}

		const signature = JSON.stringify({ currentDocumentId, recommendedSearchUrl });
		if (signature === lastRecommendationSignature) {
			return;
		}

		lastRecommendationSignature = signature;
		void fetchRecommendedLanes(currentDocumentId);
	});

	$effect(() => {
		const results = filteredResults;
		if (!expanded || results.length === 0) {
			return;
		}

		void tick().then(() => {
			prefetchVisibleResultRoutes(results);
		});
	});

	function resolveCurrentDocumentId(): string | null {
		if (!page.url.pathname.startsWith('/doc/')) {
			return null;
		}

		const documentId = page.params.id;
		return typeof documentId === 'string' && documentId.trim().length > 0 ? documentId : null;
	}

	function clearPagePreview(): void {
		previewHoveringListbox = false;
		previewTarget = null;
	}

	function cancelOverlayCloseTimer(): void {
		if (overlayCloseTimer !== null) {
			clearTimeout(overlayCloseTimer);
			overlayCloseTimer = null;
		}
	}

	function cancelShellWidthReadyTimer(): void {
		if (shellWidthReadyTimer !== null) {
			clearTimeout(shellWidthReadyTimer);
			shellWidthReadyTimer = null;
		}
	}

	function markShellWidthReady(): void {
		cancelShellWidthReadyTimer();
		shellWidthReady = true;
	}

	function scheduleShellWidthReadyFallback(): void {
		cancelShellWidthReadyTimer();
		shellWidthReadyTimer = window.setTimeout(() => {
			markShellWidthReady();
		}, SEARCH_TEXT_REVEAL_DELAY_MS);
	}

	function beginShellWidthOpen(): void {
		if (prefersReducedMotion) {
			shellWidthReady = true;
			return;
		}
		shellWidthReady = false;
		scheduleShellWidthReadyFallback();
	}

	function handleShellTransitionEnd(event: TransitionEvent): void {
		if (event.propertyName !== 'width' || !expanded || shellWidthReady) {
			return;
		}
		markShellWidthReady();
	}

	function openExpanded(): void {
		cancelOverlayCloseTimer();
		overlayClosing = false;
		beginShellWidthOpen();
		expanded = true;
	}

	function scheduleIgnoreShellOpenClickReset(): void {
		ignoreShellOpenClick = true;
		window.setTimeout(() => {
			ignoreShellOpenClick = false;
		}, 0);
	}

	function closeExpanded(): void {
		if (!expanded) {
			return;
		}
		cancelShellWidthReadyTimer();
		shellWidthReady = true;
		scheduleIgnoreShellOpenClickReset();
		expanded = false;
		searchInput?.blur();
		overlayClosing = true;
		cancelOverlayCloseTimer();
		overlayCloseTimer = window.setTimeout(() => {
			overlayClosing = false;
			overlayCloseTimer = null;
			shellAnchor?.focus();
		}, OVERLAY_CLOSE_MS);
	}

	function handleListboxMouseEnter(): void {
		isPointerOverListbox = true;
		if (!canHoverPreview) {
			return;
		}
		previewHoveringListbox = true;
	}

	function prefetchResultRoute(result: FastSearchResult): void {
		const pathname = resultPathname(result.href);
		if (prefetchedPathnames.has(pathname)) {
			return;
		}
		prefetchedPathnames.add(pathname);
		void preloadData(pathname);
	}

	function prefetchVisibleResultRoutes(results: FastSearchResult[]): void {
		const pathnames = uniqueFastSearchPrefetchPathnames({
			results,
			limit: VISIBLE_RESULT_PREFETCH_LIMIT
		});

		for (const pathname of pathnames) {
			if (prefetchedPathnames.has(pathname)) {
				continue;
			}
			prefetchedPathnames.add(pathname);
			void preloadData(pathname);
		}
	}

	function handleListboxMouseMove(event: MouseEvent): void {
		const eventTarget = event.target;
		if (!(eventTarget instanceof Element)) {
			return;
		}
		const row = eventTarget.closest('[data-fast-search-result-key]');
		if (!row) {
			return;
		}
		const key = row.getAttribute('data-fast-search-result-key');
		if (!key) {
			return;
		}
		const result = filteredResults.find((item) => fastSearchResultKey(item) === key);
		if (!result) {
			return;
		}
		const resultKey = fastSearchResultKey(result);
		const previousKey = previewTarget ? fastSearchResultKey(previewTarget) : null;
		if (resultKey !== previousKey) {
			prefetchResultRoute(result);
		}
		if (!canHoverPreview) {
			return;
		}
		previewHoveringListbox = true;
		previewCursorX = event.clientX;
		previewCursorY = event.clientY;
		previewTarget = result;
	}

	function applyDeepResultPreview(event: MouseEvent, result: DeepLibrarySearchResult): void {
		const previewResult = deepResultToPreviewTarget(result);
		if (!previewResult) {
			return;
		}
		const resultKey = fastSearchResultKey(previewResult);
		const previousKey = previewTarget ? fastSearchResultKey(previewTarget) : null;
		if (resultKey !== previousKey) {
			prefetchResultRoute(previewResult);
		}
		if (!canHoverPreview) {
			return;
		}
		isPointerOverListbox = true;
		previewHoveringListbox = true;
		previewCursorX = event.clientX;
		previewCursorY = event.clientY;
		previewTarget = previewResult;
	}

	function handleDeepListboxMouseMove(event: MouseEvent): void {
		const eventTarget = event.target;
		if (!(eventTarget instanceof Element)) {
			return;
		}
		const row = eventTarget.closest('[data-fast-search-result-key]');
		if (!row) {
			return;
		}
		const key = row.getAttribute('data-fast-search-result-key');
		if (!key) {
			return;
		}
		const result = deepResults.find((item) => deepSearchResultKey(item) === key);
		if (!result) {
			return;
		}
		applyDeepResultPreview(event, result);
	}

	function handleListboxMouseLeave(): void {
		isPointerOverListbox = false;
		clearPagePreview();
	}

	function cancelDebouncedSearch(): void {
		if (debounceTimer !== null) {
			clearTimeout(debounceTimer);
			debounceTimer = null;
		}
	}

	function clearSearchState(): void {
		abortController?.abort();
		rawLanes = [];
		error = null;
		enrichmentError = null;
		semanticError = null;
		isSearching = false;
		isEnrichmentSearching = false;
		isSemanticSearching = false;
		completedQuery = null;
		completedClientFilterSignature = null;
	}

	function clearDeepState(): void {
		deepAbortController?.abort();
		deepResults = [];
		deepStatusSteps = [];
		isDeepSearching = false;
		deepError = null;
		completedDeepPrompt = null;
	}

	function deepSearchResultKey(result: DeepLibrarySearchResult): string {
		if (result.kind === 'document') {
			return `deep-document:${result.documentId}`;
		}
		return `deep-highlight:${result.highlightId}`;
	}

	function deepResultToPreviewTarget(result: DeepLibrarySearchResult): FastSearchClientResult | null {
		if (result.kind === 'document') {
			return {
				kind: 'document',
				documentId: result.documentId,
				documentTitle: result.documentTitle,
				text: result.matchedEvidence,
				tags: [],
				entities: [],
				href: result.href
			};
		}

		if (!result.highlightId || result.pageNumber === null) {
			return null;
		}

		return {
			kind: 'direct_highlight',
			highlightId: result.highlightId,
			documentId: result.documentId,
			documentTitle: result.documentTitle,
			pageNumber: result.pageNumber,
			highlightKind: 'text',
			text: result.matchedEvidence,
			comment: null,
			annotationPreview: null,
			aiAnnotationPreview: null,
			color: '#facc15',
			href: result.href
		};
	}

	async function executeDeepSearch(currentPrompt: string): Promise<void> {
		const prompt = currentPrompt.trim();
		if (!prompt) {
			return;
		}

		deepAbortController?.abort();
		const controller = new AbortController();
		deepAbortController = controller;

		isDeepSearching = true;
		deepError = null;
		deepResults = [];
		deepStatusSteps = [];
		highlightedIndex = 0;
		clearPagePreview();

		try {
			const response = await fetch(deepSearchUrl, {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({
					prompt,
					currentDocumentId
				}),
				signal: controller.signal
			});

			if (!response.ok) {
				const payload = (await response.json()) as { error?: string };
				throw new Error(payload.error ?? 'Deep search failed');
			}

			if (!response.body) {
				throw new Error('Deep search returned no response body.');
			}

			await consumeDeepSearchSseStream(response.body, (event) => {
				if (controller.signal.aborted) {
					return;
				}

				if (event.event === 'status') {
					deepStatusSteps = [...deepStatusSteps, event];
					return;
				}

				if (event.event === 'complete') {
					deepResults = event.results;
					deepStatusSteps = event.statusSteps;
					completedDeepPrompt = prompt;
					return;
				}

				if (event.event === 'error') {
					throw new Error(event.message);
				}
			});
		} catch (searchError) {
			if (controller.signal.aborted) {
				return;
			}
			deepError =
				searchError instanceof Error ? searchError.message : 'Deep search is unavailable right now.';
			completedDeepPrompt = prompt;
		} finally {
			if (!controller.signal.aborted) {
				isDeepSearching = false;
			}
		}
	}

	async function openDeepResult(result: DeepLibrarySearchResult): Promise<void> {
		if (navigationInFlight) {
			return;
		}

		navigationInFlight = true;
		closeExpanded();
		try {
			const highlightId =
				result.highlightId ?? extractHighlightIdFromHref(result.href);
			const navigationResult = {
				kind: result.kind,
				documentId: result.documentId,
				highlightId: highlightId ?? undefined,
				href: result.href
			};

			if (
				shouldHandleFastSearchResultLocally({
					result: navigationResult,
					currentDocumentId
				}) &&
				highlightId
			) {
				history.pushState(null, '', `#highlight-${encodeURIComponent(highlightId)}`);
				requestFastSearchLocalJump(result.documentId, highlightId);
				return;
			}

			setFastSearchOptimisticTarget({
				documentId: result.documentId,
				documentTitle: result.documentTitle,
				href: result.href,
				highlightId
			});
			// eslint-disable-next-line svelte/no-navigation-without-resolve -- destination path comes from search API at runtime
			await goto(result.href);
			clearFastSearchOptimisticTarget();
		} catch (navError) {
			clearFastSearchOptimisticTarget();
			toast.error(navError instanceof Error ? navError.message : 'Could not open that result.');
		} finally {
			navigationInFlight = false;
		}
	}

	async function fetchRecommendedLanes(documentId: string | null): Promise<void> {
		recommendationAbortController?.abort();
		const controller = new AbortController();
		recommendationAbortController = controller;

		try {
			const response = await fetchSearch(recommendedSearchUrl, '', controller, null, documentId);
			if (controller.signal.aborted) {
				return;
			}

			recommendedLanes = normalizeLanes(response);
			if (!shouldSearch) {
				highlightedIndex = 0;
			}
		} catch (searchError) {
			if (controller.signal.aborted) return;
			void searchError;
			recommendedLanes = [];
		}
	}

	function clearSearch(): void {
		cancelDebouncedSearch();
		deepAbortController?.abort();
		query = '';
		searchFilters = {};
		resultScope = 'both';
		clearSearchState();
		clearDeepState();
		clearPagePreview();
		highlightedIndex = 0;
	}

	function scheduleDebouncedSearch(): void {
		cancelDebouncedSearch();
		debounceTimer = window.setTimeout((): void => {
			debounceTimer = null;
			if (!shouldSearch) {
				clearSearchState();
				return;
			}
			void executeSearchCycle(trimmedQuery);
		}, DEBOUNCE_MS);
	}

	function handleClientFilterChange(): void {
		if (!shouldSearch) {
			return;
		}
		completedClientFilterSignature = clientFilterSignature;
		highlightedIndex = 0;
	}

	function resetExpandedSearchFieldHeight(): void {
		const textarea = searchInput;
		if (!(textarea instanceof HTMLTextAreaElement)) {
			return;
		}

		textarea.style.height = '';
		textarea.style.overflowY = '';
		isSearchFieldMultiline = false;
	}

	function readExpandedSearchLineHeightPx(textarea: HTMLTextAreaElement): number {
		const textareaStyles = getComputedStyle(textarea);
		let lineHeightPx = Number.parseFloat(textareaStyles.lineHeight);
		if (!Number.isFinite(lineHeightPx)) {
			lineHeightPx = Number.parseFloat(textareaStyles.fontSize) * 1.25;
		}
		return lineHeightPx;
	}

	function syncExpandedSearchFieldHeight(): void {
		const textarea = searchInput;
		if (!(textarea instanceof HTMLTextAreaElement)) {
			return;
		}

		if (textarea.value.trim().length === 0) {
			resetExpandedSearchFieldHeight();
			return;
		}

		const lineHeightPx = readExpandedSearchLineHeightPx(textarea);
		const maxHeightPx = lineHeightPx * EXPANDED_SEARCH_MAX_LINES;

		textarea.style.height = '0px';
		const contentHeight = textarea.scrollHeight;
		const nextHeight = Math.min(Math.max(contentHeight, lineHeightPx), maxHeightPx);

		if (nextHeight <= lineHeightPx + EXPANDED_SEARCH_SINGLE_LINE_TOLERANCE_PX) {
			resetExpandedSearchFieldHeight();
			return;
		}

		textarea.style.height = `${nextHeight}px`;
		textarea.style.overflowY = contentHeight > maxHeightPx ? 'auto' : 'hidden';
		isSearchFieldMultiline = true;
	}

	function syncExpandedSearchFieldLayout(): void {
		syncExpandedSearchFieldHeight();
	}

	function handleInput(event: Event): void {
		const inputEvent = event as InputEvent;
		if (inputEvent.isComposing) return;
		const raw = (inputEvent.currentTarget as HTMLInputElement | HTMLTextAreaElement).value;

		if (expanded) {
			syncExpandedSearchFieldHeight();
		}

		if (!raw.trim()) {
			cancelDebouncedSearch();
			clearSearchState();
			if (isDeepMode) {
				clearDeepState();
			}
			return;
		}

		if (isDeepMode) {
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
		if (!shouldSearch) {
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

			rawLanes = normalizeLanes(directResponse);
			highlightedIndex = 0;
			completedQuery = currentQuery;
			completedClientFilterSignature = clientFilterSignature;
			isSearching = false;
			isEnrichmentSearching = true;

			try {
				const enrichmentResponse = await fetchSearch(
					enrichmentSearchUrl,
					currentQuery,
					controller,
					directResponse
				);

				rawLanes = normalizeLanes(enrichmentResponse);
				const merged = filteredResults;
				highlightedIndex = Math.min(highlightedIndex, Math.max(merged.length - 1, 0));
				completedQuery = currentQuery;
				completedClientFilterSignature = clientFilterSignature;

				isEnrichmentSearching = false;
				isSemanticSearching = true;

				try {
					const semanticResponse = await fetchSearch(
						semanticSearchUrl,
						currentQuery,
						controller,
						enrichmentResponse
					);

					rawLanes = normalizeLanes(semanticResponse);
					const semanticMerged = filteredResults;
					highlightedIndex = Math.min(highlightedIndex, Math.max(semanticMerged.length - 1, 0));
					completedQuery = currentQuery;
					completedClientFilterSignature = clientFilterSignature;
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
			rawLanes = [];
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
		previousResponse: FastSearchResponse | null,
		requestCurrentDocumentId: string | null = null
	): Promise<FastSearchResponse> {
		const response = await fetch(url, {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({
				query: currentQuery,
				filters: searchFilters,
				resultScope,
				previousResponse,
				currentDocumentId: requestCurrentDocumentId
			}),
			signal: controller.signal
		});
		const payload = (await response.json()) as FastSearchResponse | { error?: string };

		if (!response.ok) {
			throw new Error('error' in payload && payload.error ? payload.error : 'Search failed');
		}

		return payload as FastSearchResponse;
	}

	function handleKeydown(event: KeyboardEvent): void {
		if (event.key === 'Escape') {
			event.preventDefault();
			closeExpanded();
			return;
		}

		if (isDeepMode) {
			if (event.key === 'ArrowDown') {
				event.preventDefault();
				isPointerOverListbox = false;
				highlightedIndex = Math.min(
					highlightedIndex + 1,
					Math.max(deepKeyboardResults.length - 1, 0)
				);
				return;
			}

			if (event.key === 'ArrowUp') {
				event.preventDefault();
				isPointerOverListbox = false;
				highlightedIndex = Math.max(highlightedIndex - 1, 0);
				return;
			}

			if (event.key === 'Enter' && !event.shiftKey && trimmedQuery) {
				if (deepKeyboardResults.length > 0) {
					const enterTarget = deepKeyboardResults[highlightedIndex];
					if (enterTarget) {
						event.preventDefault();
						void openDeepResult(enterTarget);
					}
					return;
				}

				if (!isDeepSearching) {
					event.preventDefault();
					void executeDeepSearch(trimmedQuery);
				}
			}

			return;
		}

		if (event.key === 'ArrowDown') {
			event.preventDefault();
			isPointerOverListbox = false;
			highlightedIndex = Math.min(highlightedIndex + 1, Math.max(filteredResults.length - 1, 0));
		}

		if (event.key === 'ArrowUp') {
			event.preventDefault();
			isPointerOverListbox = false;
			highlightedIndex = Math.max(highlightedIndex - 1, 0);
		}

		if (event.key === 'Enter' && !event.shiftKey) {
			const enterTarget =
				isPointerOverListbox && previewTarget !== null
					? previewTarget
					: filteredResults[highlightedIndex];
			if (enterTarget) {
				event.preventDefault();
				void openResult(enterTarget);
			}
		}
	}

	async function openResult(result: FastSearchResult): Promise<void> {
		if (navigationInFlight) {
			return;
		}
		navigationInFlight = true;
		closeExpanded();
		try {
			const highlightId = extractHighlightIdFromHref(result.href);
			if (
				shouldHandleFastSearchResultLocally({
					result,
					currentDocumentId
				}) &&
				highlightId
			) {
				history.pushState(null, '', `#highlight-${encodeURIComponent(highlightId)}`);
				requestFastSearchLocalJump(result.documentId, highlightId);
				return;
			}

			setFastSearchOptimisticTarget({
				documentId: result.documentId,
				documentTitle: result.documentTitle,
				href: result.href,
				highlightId
			});
			// eslint-disable-next-line svelte/no-navigation-without-resolve -- destination path comes from search API at runtime
			await goto(result.href);
			clearFastSearchOptimisticTarget();
		} catch (navError) {
			clearFastSearchOptimisticTarget();
			toast.error(navError instanceof Error ? navError.message : 'Could not open that result.');
		} finally {
			navigationInFlight = false;
		}
	}

	function resultIcon(result: FastSearchResult): Component<{ class?: string }> {
		if (result.kind === 'document') return FileText;
		if (result.kind === 'summary_highlight') return Sparkles;
		if (result.kind === 'semantic_highlight') return Brain;
		return Highlighter;
	}

	function resultSubtitle(result: FastSearchResult) {
		return resolveFastSearchSubtitle(result, parsedQuery);
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
						comment: result.comment ?? null,
						annotationPreview: result.annotationPreview,
						aiAnnotationPreview: result.aiAnnotationPreview ?? null,
						color: result.color,
						href: result.href
					})
				)
			}
		];
	}
</script>

<div class={cn('fast-search-root text-foreground', className)}>
	{#if overlayVisible}
		<button
			type="button"
			class="fast-search-backdrop fixed inset-0 top-16 z-[60] bg-background/60"
			data-expanded={expanded}
			data-motion={panelMotion}
			aria-label="Close search"
			onclick={closeExpanded}
		></button>
	{/if}

	<!-- svelte-ignore a11y_no_noninteractive_tabindex -- role=button when collapsed -->
	<div
		bind:this={shellAnchor}
		class="fast-search-shell"
		data-expanded={expanded}
		data-closing={overlayClosing}
		data-width-ready={shellWidthReady}
		data-motion={panelMotion}
		data-ai-mode={isDeepMode}
		data-multiline={isSearchFieldMultiline}
		data-ai-thinking={isAiThinking}
		ontransitionend={handleShellTransitionEnd}
		role={expanded ? 'combobox' : 'button'}
		tabindex={expanded ? undefined : 0}
		aria-label={expanded ? undefined : 'Search your library'}
		aria-expanded={expanded}
		aria-haspopup={expanded ? 'listbox' : undefined}
		aria-controls={expanded && hasDropdown ? 'fast-search-results' : undefined}
		onclick={(event) => {
			if (!expanded) {
				if (ignoreShellOpenClick) {
					return;
				}
				event.preventDefault();
				openExpanded();
			}
		}}
		onkeydown={(event) => {
			if (!expanded && (event.key === 'Enter' || event.key === ' ')) {
				event.preventDefault();
				openExpanded();
			}
		}}
	>
		<div class="fast-search-input-row">
			<Search class="fast-search-input-icon size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
			{#if expanded}
				<textarea
					bind:this={searchInput}
					bind:value={query}
					tabindex={0}
					oninput={handleInput}
					onkeydown={handleKeydown}
					class="fast-search-input fast-search-field-input minimal-scrollbar min-w-0 flex-1 resize-none border-0 bg-transparent p-0 text-sm leading-tight outline-none placeholder:text-muted-foreground focus-visible:ring-0"
					placeholder={searchPlaceholder}
					aria-label="Search your library"
					aria-autocomplete="list"
					aria-busy={isSearchCycleActive}
					aria-controls="fast-search-results"
					spellcheck={isDeepMode && trimmedQuery.length > 0}
				></textarea>
			{:else}
				<input
					bind:this={searchInput}
					bind:value={query}
					readonly={true}
					tabindex={-1}
					oninput={handleInput}
					onkeydown={handleKeydown}
					class="fast-search-input min-w-0 flex-1 border-0 bg-transparent text-sm leading-tight outline-none placeholder:text-muted-foreground focus-visible:ring-0"
					placeholder={searchPlaceholder}
					aria-label="Search your library"
					aria-autocomplete="list"
					aria-expanded={hasDropdown}
					aria-busy={isSearchCycleActive}
					aria-controls="fast-search-results"
					autocomplete="off"
					spellcheck={false}
				/>
			{/if}
			<div class="fast-search-trailing">
				<span class="fast-search-trailing-kbd" data-visible={!expanded} aria-hidden={expanded}>
					<span
						class={cn(SEARCH_HINT_CLASS, 'pointer-events-none hidden sm:inline-flex')}
						aria-hidden="true"
					>
						{#if isMacPlatform}
							<Command class="size-2.5 shrink-0" strokeWidth={2.5} aria-hidden="true" />
							<span>K</span>
						{:else}
							Ctrl+K
						{/if}
					</span>
				</span>
				<span class="fast-search-trailing-expanded" data-visible={expanded} aria-hidden={!expanded}>
					{#if isSearchCycleActive}
						<Loader2
							class="size-4 shrink-0 animate-spin text-muted-foreground"
							aria-hidden="true"
						/>
					{:else if showClearControl}
						<button
							type="button"
							class="shrink-0 rounded-full p-0.5 text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none active:scale-[0.97] motion-reduce:active:scale-100"
							aria-label="Clear search"
							onclick={clearSearch}
						>
							<X class="size-4" aria-hidden="true" />
						</button>
					{/if}
					<button
						type="button"
						class={cn(
							SEARCH_HINT_CLASS,
							'pointer-events-auto hidden transition-[transform,background-color] duration-150 ease-out hover:bg-muted/80 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none active:scale-[0.97] motion-reduce:active:scale-100 sm:inline-flex'
						)}
						aria-label="Close search"
						onclick={closeExpanded}
					>
						Esc
					</button>
				</span>
			</div>
		</div>

		<div class="fast-search-shell-body" aria-hidden={!expanded && !overlayClosing}>
			<div class="fast-search-shell-body-inner">
				<div
					class="fast-search-chips flex items-center justify-between gap-3 px-3.5 pb-2"
					data-expanded={expanded}
					data-motion={panelMotion}
				>
					<FastLibrarySearchFilterChips
						bind:resultScope
						bind:searchFilters
						disabled={isDeepMode}
						onClientFilterChange={handleClientFilterChange}
					/>
					<FastDeepModeToggle bind:searchMode class="shrink-0" />
				</div>

				{#if hasDropdown}
					<div
						id="fast-search-results"
						class="fast-search-results minimal-scrollbar max-h-[min(32rem,calc(100svh-18rem-max(env(safe-area-inset-bottom,0px),12px)))] touch-pan-y overflow-x-hidden overflow-y-auto overscroll-y-contain border-t border-border px-3.5 py-3 sm:max-h-[min(36rem,calc(100svh-16rem-max(env(safe-area-inset-bottom,0px),12px)))]"
						role="listbox"
						aria-label={isDeepMode ? 'Summarice AI results' : 'Search results'}
						tabindex="-1"
						onmouseenter={handleListboxMouseEnter}
						onmousemove={isDeepMode ? handleDeepListboxMouseMove : handleListboxMouseMove}
						onmouseleave={handleListboxMouseLeave}
					>
						{#if isDeepMode}
							{#if deepError}
								<div class="{SEARCH_ERROR_MESSAGE_CLASS} fast-search-deferred-text" role="alert">
									{deepError}
								</div>
							{:else if isDeepSearching}
								<div
									class="fast-search-ai-thinking py-1"
									role="status"
									aria-live="polite"
									aria-busy="true"
								>
									{#if currentDeepStatusStep}
										{@const StatusIcon = deepStatusPhaseIcon(currentDeepStatusStep.phase)}
										<div
											class="fast-search-ai-thinking-card fast-search-deferred-text relative overflow-hidden rounded-lg border border-border/60 bg-card px-3 py-3"
										>
											<div class="fast-search-ai-thinking-sheen" aria-hidden="true"></div>
											<div class="fast-search-ai-thinking-streak" aria-hidden="true"></div>
											<div class="relative flex gap-3">
												<StatusIcon
													class="mt-0.5 size-4 shrink-0 text-primary"
													aria-hidden="true"
												/>
												<p
													class="fast-search-ai-thinking-label min-w-0 flex-1 text-sm leading-snug font-medium text-foreground"
													aria-label={currentDeepStatusStep.label}
												>
													<span>{deepStatusLabelBase(currentDeepStatusStep.label)}</span>
													<span class="fast-search-ai-ellipsis" aria-hidden="true">
														<span>.</span><span>.</span><span>.</span>
													</span>
												</p>
											</div>
										</div>
									{/if}
								</div>
							{:else if !shouldSearch}
								<div class="{SEARCH_STATUS_MESSAGE_CLASS} fast-search-deferred-text">
									Ask in plain language what you want to find, then press Enter.
								</div>
							{:else if deepResults.length === 0 && completedDeepPrompt === trimmedQuery}
								<div class="{SEARCH_STATUS_MESSAGE_CLASS} fast-search-deferred-text">
									Nothing in your library matched. Try different words or a shorter question.
								</div>
							{:else}
								{#each deepResults as result, index (deepSearchResultKey(result))}
									{@const ResultIcon = result.kind === 'document' ? FileText : Highlighter}
									<button
										type="button"
										data-fast-search-result-key={deepSearchResultKey(result)}
										class="grid w-full grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1.5 rounded-lg p-3 text-left transition-[background-color,transform] duration-150 ease-out hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none active:scale-[0.99] disabled:pointer-events-none disabled:opacity-60 motion-reduce:transition-none motion-reduce:active:scale-100"
										class:bg-muted={isKeyboardHighlightVisible && index === highlightedIndex}
										role="option"
										aria-selected={isKeyboardHighlightVisible && index === highlightedIndex}
										aria-busy={navigationInFlight}
										disabled={navigationInFlight}
										onmouseenter={(event) => applyDeepResultPreview(event, result)}
										onclick={() => openDeepResult(result)}
									>
										<span
											class="relative col-start-1 row-start-1 inline-flex size-4 shrink-0 self-start"
											aria-hidden="true"
										>
											<ResultIcon class="size-4 text-muted-foreground" />
										</span>
										<span
											class="col-start-2 row-start-1 flex min-w-0 items-start justify-between gap-2"
										>
											<span
												class="fast-search-deferred-text min-w-0 flex-1 text-sm leading-snug font-semibold text-foreground"
											>
												{result.documentTitle}
											</span>
											{#if result.pageNumber !== null}
												<Badge
													variant="secondary"
													class="fast-search-deferred-text shrink-0 tabular-nums"
												>
													p. {result.pageNumber}
												</Badge>
											{/if}
										</span>
										<p
											class="fast-search-deferred-text col-span-2 [display:-webkit-box] min-w-0 overflow-hidden text-sm leading-snug text-muted-foreground [-webkit-box-orient:vertical] [-webkit-line-clamp:2]"
										>
											{result.matchedEvidence}
										</p>
										<p
											class="fast-search-deferred-text col-span-2 text-sm leading-snug text-foreground/80"
										>
											{result.reason}
										</p>
									</button>
								{/each}
							{/if}
						{:else if error}
							<div class="{SEARCH_ERROR_MESSAGE_CLASS} fast-search-deferred-text" role="alert">
								{error}
							</div>
						{:else if hasFilterEmptyResults}
							<div class="{SEARCH_STATUS_MESSAGE_CLASS} fast-search-deferred-text">
								No results match your filters.
							</div>
						{:else if hasServerEmptyResults}
							<div class="{SEARCH_STATUS_MESSAGE_CLASS} fast-search-deferred-text">
								No matching highlights found.
							</div>
						{:else}
							{#each visibleLanes as lane, laneIndex (lane.id)}
								{#if laneIndex > 0}
									<Separator class="my-2" />
								{/if}
								<div class="px-1" role="group" aria-label={lane.label}>
									<p
										class="fast-search-deferred-text px-2 py-1.5 text-sm leading-snug font-medium text-muted-foreground"
									>
										{lane.label}
									</p>
									{#each lane.results as result (fastSearchResultKey(result))}
										{@const index = filteredResults.findIndex(
											(visibleResult) =>
												fastSearchResultKey(visibleResult) === fastSearchResultKey(result)
										)}
										{@const subtitle = resultSubtitle(result)}
										{@const ResultIcon = resultIcon(result)}
										<button
											type="button"
											data-fast-search-result-key={fastSearchResultKey(result)}
											class="grid w-full grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1.5 rounded-lg p-3 text-left transition-[background-color,transform] duration-150 ease-out hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none active:scale-[0.99] disabled:pointer-events-none disabled:opacity-60 motion-reduce:transition-none motion-reduce:active:scale-100"
											class:bg-muted={isKeyboardHighlightVisible && index === highlightedIndex}
											role="option"
											aria-selected={isKeyboardHighlightVisible && index === highlightedIndex}
											aria-busy={navigationInFlight}
											disabled={navigationInFlight}
											onclick={() => openResult(result)}
										>
											<span
												class="relative col-start-1 row-start-1 inline-flex size-4 shrink-0 self-start"
												aria-hidden="true"
											>
												<ResultIcon class="size-4 text-muted-foreground" />
												{#if result.kind !== 'document'}
													<span
														class="absolute -top-0.5 -right-0.5 size-2 rounded-full border border-background"
														style="background-color: {result.color}"
														aria-hidden="true"
													></span>
												{/if}
											</span>
											<span
												class="col-start-2 row-start-1 flex min-w-0 items-start justify-between gap-2"
											>
												<span
													class="fast-search-deferred-text min-w-0 flex-1 text-sm leading-snug font-semibold text-foreground"
												>
													{result.documentTitle}
												</span>
												{#if result.kind !== 'document'}
													<Badge
														variant="secondary"
														class="fast-search-deferred-text shrink-0 tabular-nums"
													>
														p. {result.pageNumber}
													</Badge>
												{/if}
											</span>
											{#if result.kind === 'document'}
												{#if subtitle.themesLine || subtitle.entitiesLine || subtitle.primary.length > 0}
													<span
														class="col-span-2 flex min-w-0 flex-col gap-1"
													>
														{#if subtitle.themesLine}
															<span
																class="fast-search-deferred-text truncate text-sm leading-snug text-muted-foreground"
															>
																{subtitle.themesLine}
															</span>
														{/if}
														{#if subtitle.entitiesLine}
															<span
																class="fast-search-deferred-text truncate text-sm leading-snug text-muted-foreground"
															>
																{subtitle.entitiesLine}
															</span>
														{/if}
														{#if subtitle.primary.length > 0}
															<span
																class="fast-search-deferred-text [display:-webkit-box] min-w-0 overflow-hidden text-sm leading-snug text-muted-foreground [-webkit-box-orient:vertical] [-webkit-line-clamp:2]"
															>
																{subtitle.primary}
															</span>
														{/if}
													</span>
												{/if}
											{:else if subtitle.primary.length > 0}
												<p
													class="fast-search-deferred-text col-span-2 [display:-webkit-box] min-w-0 overflow-hidden text-sm leading-snug text-muted-foreground [-webkit-box-orient:vertical] [-webkit-line-clamp:2]"
												>
													{subtitle.primary}
												</p>
											{/if}
											{#if subtitle.showAnnotationLine && result.kind !== 'document' && result.annotationPreview}
												<p
													class="fast-search-deferred-text col-span-2 [display:-webkit-box] min-w-0 overflow-hidden text-sm leading-snug text-muted-foreground [-webkit-box-orient:vertical] [-webkit-line-clamp:2]"
												>
													Note: {result.annotationPreview}
												</p>
											{/if}
										</button>
									{/each}
								</div>
							{/each}
							{#if enrichmentError}
								<div class="{SEARCH_STATUS_MESSAGE_CLASS} fast-search-deferred-text">
									{enrichmentError}
								</div>
							{/if}
							{#if semanticError}
								<div class="{SEARCH_STATUS_MESSAGE_CLASS} fast-search-deferred-text">
									{semanticError}
								</div>
							{/if}
						{/if}
					</div>
				{/if}
			</div>
		</div>
	</div>

	{#if overlayVisible}
		<FastSearchPagePreview
			target={previewTargetPayload}
			cursorX={previewCursorX}
			cursorY={previewCursorY}
			visible={previewHoveringListbox && previewTarget !== null}
		/>
	{/if}
</div>

<style>
	.fast-search-root {
		position: relative;
		display: flex;
		justify-content: center;
		min-height: calc(2.25rem + 2px);
		min-width: 2.25rem;
	}

	/* Hold navbar slot while the shell is out of flow (absolute) */
	.fast-search-root:has(.fast-search-shell[data-expanded='true'])::before,
	.fast-search-root:has(.fast-search-shell[data-closing='true'])::before {
		content: '';
		display: block;
		width: 2.25rem;
		height: calc(2.25rem + 2px);
		flex-shrink: 0;
		visibility: hidden;
		pointer-events: none;
	}

	@media (min-width: 640px) {
		.fast-search-root:has(.fast-search-shell[data-expanded='true'])::before,
		.fast-search-root:has(.fast-search-shell[data-closing='true'])::before {
			width: 17rem;
			max-width: min(28rem, 42vw);
		}
	}

	.fast-search-root:has(.fast-search-shell[data-expanded='true']),
	.fast-search-root:has(.fast-search-shell[data-closing='true']) {
		z-index: 61;
	}

	@media (min-width: 640px) {
		.fast-search-root {
			min-width: 17rem;
		}
	}

	/* Resting: compact pill in navbar; expands downward in place */
	.fast-search-shell {
		--fast-search-size-duration: 150ms;
		--fast-search-radius-duration: 0ms;
		--fast-search-body-delay: 0ms;
		--fast-search-body-duration: 150ms;
		--fast-search-text-enter-duration: 100ms;
		--fast-search-text-settle-delay: 5ms;
		--fast-search-text-reveal-delay: calc(
			var(--fast-search-size-duration) + var(--fast-search-text-settle-delay) -
				var(--fast-search-text-enter-duration)
		);
		display: flex;
		flex-direction: column;
		width: 2.25rem;
		overflow: hidden;
		border: 1px solid var(--border);
		border-radius: 9999px;
		background: var(--card);
		box-shadow: 0 1px 2px rgb(0 0 0 / 4%);
		transform-origin: top center;
		transition:
			width var(--fast-search-size-duration) var(--ease-out-strong),
			border-radius var(--fast-search-radius-duration) var(--ease-out-strong),
			box-shadow var(--fast-search-size-duration) var(--ease-out-strong);
	}

	@media (min-width: 640px) {
		.fast-search-shell {
			width: 17rem;
			max-width: min(28rem, 42vw);
		}
	}

	.fast-search-shell[data-expanded='true'],
	.fast-search-shell[data-closing='true'] {
		position: absolute;
		top: 0;
		left: 50%;
		z-index: 61;
		transform: translateX(-50%);
	}

	.fast-search-shell[data-expanded='true'] {
		width: min(42rem, calc(100vw - 2rem));
		max-width: calc(100vw - 2rem);
		border-radius: 1rem;
		box-shadow:
			0 4px 6px -1px rgb(0 0 0 / 8%),
			0 2px 4px -2px rgb(0 0 0 / 6%);
	}

	/* Close: shrink width in parallel with body collapse */
	.fast-search-shell[data-closing='true']:not([data-expanded='true']) {
		width: 2.25rem;
		box-shadow: 0 1px 2px rgb(0 0 0 / 4%);
	}

	@media (min-width: 640px) {
		.fast-search-shell[data-closing='true']:not([data-expanded='true']) {
			width: 17rem;
			max-width: min(28rem, 42vw);
		}
	}

	.fast-search-shell[data-motion='enter'] {
		--fast-search-body-delay: 0ms;
		--fast-search-body-duration: 150ms;
	}

	.fast-search-shell[data-closing='true'] {
		--fast-search-size-duration: 150ms;
		--fast-search-body-duration: 150ms;
	}

	.fast-search-shell[data-motion='exit'] {
		--fast-search-size-duration: 150ms;
		--fast-search-radius-duration: 4000ms;
		--fast-search-body-duration: 150ms;
		border-radius: 9999px;
		transition:
			width var(--fast-search-size-duration) var(--ease-out-strong),
			border-radius var(--fast-search-radius-duration) var(--ease-out-strong),
			box-shadow var(--fast-search-size-duration) var(--ease-out-strong);

		@starting-style {
			border-radius: 1rem;
		}
	}

	.fast-search-input-row {
		display: flex;
		min-height: 2.25rem;
		align-items: center;
		gap: 0.5rem;
		padding: 0 0.75rem;
		transition:
			min-height 150ms var(--ease-out-strong),
			padding 150ms var(--ease-out-strong),
			gap 150ms var(--ease-out-strong);
	}

	.fast-search-trailing {
		position: relative;
		display: flex;
		flex-shrink: 0;
		align-items: center;
		align-self: stretch;
	}

	.fast-search-trailing-kbd,
	.fast-search-trailing-expanded {
		display: flex;
		align-items: center;
		justify-content: flex-end;
		opacity: 0;
		pointer-events: none;
		transition: opacity 120ms var(--ease-out-strong);
	}

	.fast-search-trailing-kbd {
		gap: 0.25rem;
	}

	.fast-search-trailing-kbd:not([data-visible='true']),
	.fast-search-trailing-expanded:not([data-visible='true']) {
		position: absolute;
		right: 0;
		top: 50%;
		visibility: hidden;
		transform: translateY(-50%);
	}

	:global(.fast-search-shortcut-hint) {
		font-family: var(--font-sans);
		font-style: normal;
		font-synthesis: none;
	}

	.fast-search-trailing-expanded {
		gap: 0.5rem;
	}

	.fast-search-trailing-kbd[data-visible='true'],
	.fast-search-trailing-expanded[data-visible='true'] {
		opacity: 1;
	}

	.fast-search-trailing-expanded[data-visible='true'] {
		pointer-events: auto;
	}

	.fast-search-shell:not([data-expanded='true']):not([data-closing='true']) {
		cursor: pointer;
	}

	.fast-search-shell[data-expanded='true'] .fast-search-input-row {
		gap: 0.625rem;
		padding: 0.875rem;
	}

	.fast-search-field-input {
		box-sizing: border-box;
		display: block;
		margin: 0;
		min-height: 1lh;
		resize: none;
		white-space: pre-wrap;
		word-break: break-word;
		scrollbar-gutter: stable;
	}

	.fast-search-shell[data-expanded='true']:not([data-multiline='true']) .fast-search-field-input {
		height: 1lh;
		max-height: 1lh;
		overflow: hidden;
	}

	.fast-search-shell[data-expanded='true'][data-multiline='true'] .fast-search-field-input {
		height: auto;
		max-height: calc(1lh * 8);
		overflow-y: hidden;
	}

	.fast-search-shell[data-expanded='true'][data-multiline='true'] .fast-search-input-row {
		align-items: flex-start;
	}

	.fast-search-shell[data-expanded='true'][data-multiline='true'] .fast-search-input-icon {
		margin-top: 0.125rem;
	}

	.fast-search-shell[data-expanded='true'][data-multiline='true'] .fast-search-trailing {
		align-self: flex-start;
		padding-top: 0.125rem;
	}

	.fast-search-input {
		cursor: pointer;
	}

	.fast-search-shell[data-expanded='true'] .fast-search-input {
		cursor: text;
	}

	.fast-search-shell:not([data-expanded='true']):not([data-closing='true']) .fast-search-input {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		pointer-events: none;
	}

	.fast-search-shell:not([data-expanded='true']):not([data-closing='true'])
		.fast-search-shell-body {
		pointer-events: none;
	}

	.fast-search-shell-body {
		display: grid;
		grid-template-rows: 0fr;
		opacity: 0;
		transition:
			grid-template-rows var(--fast-search-body-duration) var(--ease-out-strong)
				var(--fast-search-body-delay),
			opacity var(--fast-search-body-duration) var(--ease-out-strong) var(--fast-search-body-delay);
	}

	.fast-search-shell[data-expanded='true'] .fast-search-shell-body {
		grid-template-rows: 1fr;
		opacity: 1;
	}

	.fast-search-shell[data-expanded='true'][data-width-ready='false'] .fast-search-deferred-text {
		opacity: 0;
		visibility: hidden;
		animation: none;
	}

	.fast-search-shell[data-expanded='true'][data-width-ready='true'] .fast-search-deferred-text {
		visibility: visible;
		animation: fast-search-text-in var(--fast-search-text-enter-duration) var(--ease-out-strong)
			both;
	}

	@keyframes fast-search-text-in {
		from {
			opacity: 0;
		}
		to {
			opacity: 1;
		}
	}

	.fast-search-shell[data-motion='exit'] .fast-search-shell-body,
	.fast-search-shell[data-closing='true'] .fast-search-shell-body {
		--fast-search-body-delay: 0ms;
		--fast-search-body-duration: 100ms;
	}

	.fast-search-shell-body-inner {
		min-height: 0;
		overflow: hidden;
	}

	.fast-search-backdrop {
		opacity: 0;
		transition: opacity 120ms var(--ease-out-strong);
	}

	.fast-search-backdrop[data-expanded='true'] {
		opacity: 1;
	}

	.fast-search-backdrop[data-motion='enter'][data-expanded='true'] {
		transition-duration: 120ms;
	}

	.fast-search-chips[data-motion='enter'][data-expanded='true'] :global([role='group'] > *) {
		animation: fast-search-chip-in 200ms var(--ease-out-strong) backwards;
	}

	.fast-search-chips[data-motion='enter'][data-expanded='true']
		:global([role='group'] > *:nth-child(1)) {
		animation-delay: 0ms;
	}

	.fast-search-chips[data-motion='enter'][data-expanded='true']
		:global([role='group'] > *:nth-child(2)) {
		animation-delay: 24ms;
	}

	.fast-search-chips[data-motion='exit'] {
		opacity: 0;
		transform: translateY(-2px);
		transition:
			opacity 40ms var(--ease-out-strong),
			transform 40ms var(--ease-out-strong);
		pointer-events: none;
	}

	.fast-search-chips[data-motion='exit'] :global([role='group'] > *) {
		animation: none;
		opacity: 0;
	}

	@keyframes fast-search-chip-in {
		from {
			opacity: 0;
			transform: translateY(4px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}

	.fast-search-shell[data-ai-thinking='true'] {
		--fast-search-ai-sheen-opacity: 0.14;
		border-color: transparent;
		box-shadow:
			0 4px 6px -1px rgb(0 0 0 / 8%),
			0 2px 4px -2px rgb(0 0 0 / 6%),
			0 0 36px color-mix(in oklch, var(--ai-accent-purple) 12%, transparent),
			0 0 64px color-mix(in oklch, var(--ai-accent-blue) 9%, transparent),
			0 0 96px color-mix(in oklch, var(--ai-accent-purple) 6%, transparent);
	}

	.fast-search-shell[data-ai-thinking='true']::after {
		content: '';
		position: absolute;
		inset: 0;
		z-index: 0;
		padding: 1px;
		border-radius: inherit;
		background: linear-gradient(
			135deg,
			color-mix(in oklch, var(--ai-accent-purple) 42%, transparent),
			color-mix(in oklch, var(--ai-accent-blue) 36%, transparent),
			color-mix(in oklch, var(--ai-accent-purple) 28%, transparent),
			color-mix(in oklch, var(--ai-accent-blue) 40%, transparent)
		);
		background-size: 280% 280%;
		animation: fast-search-ai-sheen 12s cubic-bezier(0.45, 0.05, 0.55, 0.95) infinite;
		-webkit-mask:
			linear-gradient(#fff 0 0) content-box,
			linear-gradient(#fff 0 0);
		-webkit-mask-composite: xor;
		mask:
			linear-gradient(#fff 0 0) content-box,
			linear-gradient(#fff 0 0);
		mask-composite: exclude;
		pointer-events: none;
	}

	.fast-search-shell[data-ai-thinking='true'] > * {
		position: relative;
		z-index: 1;
	}

	.fast-search-ai-thinking-card {
		isolation: isolate;
	}

	.fast-search-ai-thinking-sheen {
		position: absolute;
		inset: -55%;
		z-index: 0;
		background: radial-gradient(
			ellipse 120% 90% at 25% 15%,
			color-mix(
				in oklch,
				var(--ai-accent-purple) calc(var(--fast-search-ai-sheen-opacity) * 100%),
				transparent
			),
			transparent 78%
		),
		radial-gradient(
			ellipse 110% 95% at 75% 85%,
			color-mix(
				in oklch,
				var(--ai-accent-blue) calc(var(--fast-search-ai-sheen-opacity) * 100%),
				transparent
			),
			transparent 78%
		),
		radial-gradient(
			ellipse 90% 70% at 50% 50%,
			color-mix(in oklch, var(--ai-accent-purple) 6%, transparent),
			transparent 82%
		);
		background-size: 240% 240%;
		animation: fast-search-ai-sheen 12s cubic-bezier(0.45, 0.05, 0.55, 0.95) infinite;
		pointer-events: none;
	}

	.fast-search-ai-thinking-streak {
		position: absolute;
		inset: 0;
		z-index: 0;
		background: linear-gradient(
			105deg,
			transparent 22%,
			color-mix(in oklch, var(--ai-accent-purple) 14%, transparent) 38%,
			color-mix(in oklch, var(--ai-accent-blue) 18%, transparent) 50%,
			color-mix(in oklch, var(--ai-accent-purple) 12%, transparent) 62%,
			transparent 78%
		);
		background-size: 280% 100%;
		animation: fast-search-ai-streak 9s cubic-bezier(0.45, 0.05, 0.55, 0.95) infinite;
		pointer-events: none;
	}

	.fast-search-ai-thinking-card > .relative {
		position: relative;
		z-index: 1;
	}

	.fast-search-ai-thinking-label {
		transition: opacity 150ms var(--ease-out-strong);
	}

	.fast-search-ai-ellipsis {
		display: inline-flex;
		width: 1.1em;
		margin-left: 0.05em;
	}

	.fast-search-ai-ellipsis span {
		opacity: 0.25;
		animation: fast-search-ai-dot 1.2s ease-in-out infinite;
	}

	.fast-search-ai-ellipsis span:nth-child(2) {
		animation-delay: 0.15s;
	}

	.fast-search-ai-ellipsis span:nth-child(3) {
		animation-delay: 0.3s;
	}

	@keyframes fast-search-ai-sheen {
		0%,
		100% {
			background-position: 0% 40%;
		}
		33% {
			background-position: 55% 60%;
		}
		66% {
			background-position: 100% 35%;
		}
	}

	@keyframes fast-search-ai-streak {
		0%,
		100% {
			background-position: 130% 0%;
		}
		50% {
			background-position: -30% 0%;
		}
	}

	@keyframes fast-search-ai-dot {
		0%,
		70%,
		100% {
			opacity: 0.2;
		}
		35% {
			opacity: 1;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.fast-search-shell,
		.fast-search-shell-body,
		.fast-search-backdrop,
		.fast-search-input-row,
		.fast-search-trailing-kbd,
		.fast-search-trailing-expanded {
			transition:
				opacity 120ms ease,
				border-radius 120ms ease;
		}

		.fast-search-deferred-text {
			animation: none;
		}

		.fast-search-chips[data-motion='enter'][data-expanded='true'] :global([role='group'] > *) {
			animation: none;
		}

		.fast-search-chips[data-motion='exit'] {
			transition: opacity 40ms ease;
		}

		.fast-search-shell[data-ai-thinking='true']::after,
		.fast-search-ai-thinking-sheen,
		.fast-search-ai-thinking-streak {
			animation: none;
			background-position: 50% 50%;
		}

		.fast-search-ai-ellipsis span {
			animation: none;
			opacity: 0.55;
		}

		.fast-search-ai-thinking-label {
			animation: fast-search-ai-label-pulse 2s ease-in-out infinite;
		}
	}

	@keyframes fast-search-ai-label-pulse {
		0%,
		100% {
			opacity: 1;
		}
		50% {
			opacity: 0.65;
		}
	}
</style>
