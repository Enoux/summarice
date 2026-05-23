<script lang="ts">
	import { page } from '$app/state';
	import { AlertCircle, FileText, LoaderCircle, RotateCcw, Sparkles, History, Star, CheckCircle2 } from '@lucide/svelte';
import type { CommentedHighlight, PdfHighlighterUtils } from '$lib/pdf-highlighter';
	import MockSummaryContent from './MockSummaryContent.svelte';
	import { ScrollArea } from '$lib/components/ui/scroll-area/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Badge } from '$lib/components/ui/badge/index.js';
	import * as Popover from '$lib/components/ui/popover';
	import { cn } from '$lib/utils';

	import StarRating from "$lib/features/summary/components/StarRating.svelte";
	import PillRating from "$lib/features/summary/components/PillRating.svelte";
	
	let rating = $state(4);

	let comments = [
		"Very helpful",
		"Very helpful p2",
		"Accurate",
		"Truth Nuke"
	];

	let selectedComments = $state<string[]>([]);

	function handleToggle(comment: string, selected: boolean) {
        if (selected) {
            selectedComments = [...selectedComments, comment];
        } else {
            selectedComments = selectedComments.filter(
                (c) => c !== comment
            );
        }

        // console.log(selectedComments);
    }

	type userFeedback = {
		rating: number;
		feedback: string;
		summary_id?: string;
		summary_version?: number;
	};

	type SummaryCitation = {
		id: string;
		highlight_id: string | null;
		ordinal: number;
		occurrence_index: number;
	};

	type SummaryVersion = {
		id: string;
		version: number;
		markdown: string;
		is_current: boolean;
		tags: string[];
		entities: string[];
		open_questions: string[];
		citations?: SummaryCitation[];
		created_at?: string | null;
	};

	interface Props {
		initialSummaries?: SummaryVersion[];
		initialSelectedSummaryId?: string | null;
		disableAutoLoad?: boolean;
		highlights?: CommentedHighlight[];
		viewerUtils?: Partial<PdfHighlighterUtils>;
		viewerColorMode?: 'light' | 'dark';
		onJumpToHighlight?: (id: string) => void;
		
		// Bidirectional bindings
		activeCitations?: SummaryCitation[];
		scrollToHighlightId?: string | null;
	}

	let {
		initialSummaries = [],
		initialSelectedSummaryId = null,
		disableAutoLoad = false,
		highlights = [],
		viewerUtils,
		viewerColorMode = 'light',
		onJumpToHighlight,
		activeCitations = $bindable([]),
		scrollToHighlightId = $bindable(null)
	}: Props = $props();

	let summaries = $state<SummaryVersion[]>(initialSummaries);
	let selectedSummaryId = $state<string | null>(initialSelectedSummaryId);
	let isLoading = $state(false);
	let isGenerating = $state(false);
	let isSubmitting = $state(false);
	let loadError = $state<string | null>(null);
	let generationError = $state<string | null>(null);
	let streamingSummary = $state<SummaryVersion | null>(null);

	$effect(() => {
		activeCitations = activeSummary?.citations ?? [];
	});

	$effect(() => {
		if (scrollToHighlightId) {
			const el = document.getElementById(`summary-citation-${scrollToHighlightId}`);
			if (el) {
				el.scrollIntoView({ behavior: 'smooth', block: 'center' });
				// Flash effect for the pill
				el.animate([
					{ transform: 'scale(1)', filter: 'brightness(1)' },
					{ transform: 'scale(1.5)', filter: 'brightness(1.5)' },
					{ transform: 'scale(1)', filter: 'brightness(1)' }
				], { duration: 1000, easing: 'ease-out' });
			}
			scrollToHighlightId = null;
		}
	});

	// Track which document we've already attempted to load for, to prevent re-triggering.
	let loadedForDocumentId = $state<string | null>(null);

	$effect(() => {
		if (documentId && !disableAutoLoad && loadedForDocumentId !== documentId) {
			loadedForDocumentId = documentId;
			void loadSummaries();
		}
	});

	const documentId = $derived(page.params.id);

	const sortedSummaries = $derived.by(() => [...summaries].sort((a, b) => b.version - a.version));
	const currentSummary = $derived.by(
		() => sortedSummaries.find((summary) => summary.is_current) ?? sortedSummaries[0] ?? null
	);
	const activeSummary = $derived.by(() => {
		if (streamingSummary) return streamingSummary;
		if (selectedSummaryId) {
			return sortedSummaries.find((summary) => summary.id === selectedSummaryId) ?? currentSummary;
		}
		return currentSummary;
	});
	const viewingPastVersion = $derived.by(() => {
		if (streamingSummary) return false;
		if (!activeSummary || !currentSummary) return false;
		return activeSummary.id !== currentSummary.id;
	});
	const hasAnySummary = $derived.by(() => Boolean(currentSummary || streamingSummary));
	const nextVersionNumber = $derived.by(
		() => sortedSummaries.reduce((max, summary) => Math.max(max, summary.version), 0) + 1
	);

	function normalizeSummary(input: unknown): SummaryVersion | null {
		if (!input || typeof input !== 'object') return null;

		const raw = input as Record<string, unknown>;
		const rawVersion = raw.version;
		const version =
			typeof rawVersion === 'number'
				? rawVersion
				: typeof rawVersion === 'string'
					? Number(rawVersion)
					: Number.NaN;

		if (!Number.isFinite(version)) return null;

		const markdown = typeof raw.markdown === 'string' ? raw.markdown : '';
		const tags = Array.isArray(raw.tags) ? raw.tags.map(String) : [];
		const entities = Array.isArray(raw.entities) ? raw.entities.map(String) : [];
		const open_questions = Array.isArray(raw.open_questions) ? raw.open_questions.map(String) : [];
		const citations = Array.isArray(raw.citations) ? (raw.citations as SummaryCitation[]) : [];

		const rawId = raw.id;
		const id =
			typeof rawId === 'string' && rawId.length > 0 ? rawId : `summary-v${String(version)}`;

		return {
			id,
			version,
			markdown,
			is_current: Boolean(raw.is_current),
			tags,
			entities,
			open_questions,
			citations,
			created_at: typeof raw.created_at === 'string' ? raw.created_at : null
		};
	}

	function normalizeSummaries(payload: unknown) {
		if (Array.isArray(payload)) {
			return payload
				.map(normalizeSummary)
				.filter((summary): summary is SummaryVersion => Boolean(summary));
		}

		if (!payload || typeof payload !== 'object') return [];

		const data = payload as Record<string, unknown>;
		const versionsSource: unknown[] = Array.isArray(data.versions)
			? data.versions
			: Array.isArray(data.summaries)
				? data.summaries
				: Array.isArray(data.data)
					? data.data
					: [];
		const list = versionsSource
			.map(normalizeSummary)
			.filter((summary): summary is SummaryVersion => Boolean(summary));
		const current = normalizeSummary(data.current);

		if (current && !list.some((summary) => summary.id === current.id)) {
			list.unshift({ ...current, is_current: true });
		}

		return list.sort((a, b) => b.version - a.version);
	}

	function setSelectedToCurrent() {
		selectedSummaryId = currentSummary?.id ?? null;
	}

	async function loadSummaries() {
		if (!documentId) {
			isLoading = false;
			loadError = 'Document context is unavailable.';
			return;
		}

		isLoading = true;
		loadError = null;

		try {
			const response = await fetch(`/doc/${documentId}/summary`);
			if (!response.ok) {
				throw new Error('Could not load summary history.');
			}

			const payload = await response.json();
			summaries = normalizeSummaries(payload);
			generationError = null;
			setSelectedToCurrent();
		} catch (error) {
			console.error('[Summary] load failed', error);
			loadError = error instanceof Error ? error.message : 'Could not load summary history.';
		} finally {
			isLoading = false;
		}
	}

	function parseSseEvent(block: string): any {
		const lines = block
			.split('\n')
			.map((line) => line.trimEnd())
			.filter(Boolean);
		if (lines.length === 0) return null;

		let eventName = 'message';
		const dataLines: string[] = [];
		for (const line of lines) {
			if (line.startsWith('event:')) {
				eventName = line.slice(6).trim();
			} else if (line.startsWith('data:')) {
				dataLines.push(line.slice(5).trimStart());
			}
		}

		const data = dataLines.join('\n');
		if (!data) return null;

		try {
			const parsed = JSON.parse(data) as Record<string, unknown>;
			return { event: eventName, ...parsed };
		} catch {
			if (eventName === 'delta') {
				return { event: eventName, partial_markdown: data };
			}
			return { event: eventName, data };
		}
	}

	function applyStreamChunk(chunk: Record<string, unknown>, markdown: string) {
		if (typeof chunk.partial_markdown === 'string') {
			return markdown + chunk.partial_markdown;
		}

		if (typeof chunk.markdown === 'string') {
			return chunk.markdown;
		}

		return markdown;
	}

	function persistGeneratedSummary(summary: SummaryVersion) {
		const next = [
			{ ...summary, is_current: true },
			...sortedSummaries
				.filter((item) => item.id !== summary.id && item.version !== summary.version)
				.map((item) => ({ ...item, is_current: false }))
		];

		summaries = next.sort((a, b) => b.version - a.version);
		selectedSummaryId = summary.id;
	}

	async function generateSummary() {
		if (!documentId || isGenerating) return;

		generationError = null;
		loadError = null;
		isGenerating = true;

		const previousCurrent = currentSummary;
		let streamedMarkdown = '';
		streamingSummary = {
			id: `draft-v${String(nextVersionNumber)}`,
			version: nextVersionNumber,
			markdown: '',
			is_current: true,
			tags: [],
			entities: [],
			open_questions: [],
			created_at: null
		};
		selectedSummaryId = streamingSummary.id;

		try {
			const response = await fetch(`/doc/${documentId}/summary/stream`, { method: 'POST' });
			if (!response.ok || !response.body) {
				throw new Error('Summary generation failed.');
			}

			const reader = response.body.getReader();
			const decoder = new TextDecoder();
			let buffer = '';
			let finalSummary: SummaryVersion | null = null;

			while (true) {
				const { done, value } = await reader.read();
				buffer += decoder.decode(value ?? new Uint8Array(), { stream: !done });

				let boundaryIndex = buffer.indexOf('\n\n');
				while (boundaryIndex !== -1) {
					const block = buffer.slice(0, boundaryIndex);
					buffer = buffer.slice(boundaryIndex + 2);

					const chunk = parseSseEvent(block);
					if (chunk) {
						if (chunk.event === 'error') {
							throw new Error(
								typeof chunk.message === 'string' ? chunk.message : 'Summary generation failed.'
							);
						}
						if (typeof chunk.error === 'string' && chunk.error.length > 0) {
							throw new Error(chunk.error);
						}

						streamedMarkdown = applyStreamChunk(chunk, streamedMarkdown);
						if (streamingSummary && streamedMarkdown !== streamingSummary.markdown) {
							streamingSummary = { ...streamingSummary, markdown: streamedMarkdown };
						}

						const maybeSummary = normalizeSummary(chunk.summary);
						if (maybeSummary) {
							finalSummary = maybeSummary;
						}
					}

					boundaryIndex = buffer.indexOf('\n\n');
				}

				if (done) break;
			}

			const committedSummary = finalSummary ?? {
				id: `summary-v${String(nextVersionNumber)}`,
				version: nextVersionNumber,
				markdown: streamedMarkdown,
				is_current: true,
				tags: [],
				entities: [],
				open_questions: [],
				created_at: null
			};

			persistGeneratedSummary({
				...committedSummary,
				markdown: committedSummary.markdown || streamedMarkdown,
				is_current: true
			});
			streamingSummary = null;
		} catch (error) {
			console.error('[Summary] generation failed', error);
			generationError = error instanceof Error ? error.message : 'Summary generation failed.';
			streamingSummary = null;
			selectedSummaryId = previousCurrent?.id ?? null;
		} finally {
			isGenerating = false;
		}
	}

	async function submitFeedback() {
		if (!documentId || isSubmitting) return;

		isSubmitting = true;

		const userFeedback: userFeedback = {
			rating: rating,
			feedback: selectedComments.join(","),
			summary_id: selectedSummaryId == null ? undefined : selectedSummaryId,
			summary_version: sortedSummaries.find((s) => s.id === selectedSummaryId)?.version
		};

		try {
			const response = await fetch(`/doc/${documentId}/summary/feedback`, { method: 'POST', body: JSON.stringify(userFeedback) });
			if (!response.ok || !response.body) {
				throw new Error('Submission of feedback failed.');
			}
		} catch (error) {
			console.error('[Summary Feedback] submission failed', error);
		} finally {
			isSubmitting = false;
		}
	}

	// URL hash on-load: if the URL contains #hl-<ordinal>, navigate to that citation
	// once activeSummary is populated and the component is mounted.
	let hashHandled = $state(false);
	$effect(() => {
		if (hashHandled || !activeSummary?.citations?.length) return;
		const hashMatch = /^#hl-(\d+)$/.exec(typeof window !== 'undefined' ? window.location.hash : '');
		if (!hashMatch) return;
		const targetOrdinal = parseInt(hashMatch[1], 10);
		const citation = activeSummary.citations.find((c) => c.ordinal === targetOrdinal);
		if (!citation?.highlight_id) return;
		hashHandled = true;
		onJumpToHighlight?.(citation.highlight_id);
		scrollToHighlightId = citation.highlight_id;
	});
</script>

<div class="flex h-full min-h-0 flex-col bg-card/50">
	<header class="flex flex-col gap-4 border-b bg-background/80 px-4 py-5 backdrop-blur-md">
		<div class="flex items-start justify-between gap-4">
			<div class="space-y-1">
				<h2 class="text-lg font-bold tracking-tight">Summary</h2>
				<p class="text-xs text-muted-foreground leading-relaxed max-w-[200px]">
					Grounded analysis of your document based on highlights.
				</p>
			</div>

			{#if hasAnySummary}
				<div class="flex flex-col shrink-0 items-center gap-2">
					<Button
						size="sm"
						class="h-9 gap-2 shadow-sm font-semibold w-35"
						onclick={generateSummary}
						disabled={isGenerating || isSubmitting}
					>
						{#if isGenerating}
							<LoaderCircle class="size-3.5 animate-spin" />
						{:else}
							<RotateCcw class="size-3.5" />
						{/if}
						Regenerate
					</Button>

					<Popover.Root>
						<Popover.Trigger>
							<Button 
								variant="outline"
								size="sm"
								class="h-9 gap-2 shadow-sm font-semibold w-35"
								disabled={isGenerating || isSubmitting}
							>
								{#if isGenerating || isSubmitting}
									<LoaderCircle class="size-3.5 animate-spin" />
								{:else}
									<Star class="size-3.5" />
								{/if}
								Rate Summary
							</Button>
						</Popover.Trigger>
						<Popover.Content class="w-64 p-3" align="end">
							<div class="flex justify-center items-center">
								<StarRating bind:value={rating} />
							</div>

							<div class="flex flex-wrap gap-2">
								{#each comments as comment}
									<PillRating comment={comment} onToggle={handleToggle}/>
								{/each}
							</div>

							<Button 
								size="sm" type="submit" class="h-9 gap-2 shadow-sm font-semibold"
								onclick={submitFeedback}
							>
								Submit
							</Button>
						</Popover.Content>
					</Popover.Root>
				</div>
			{/if}
		</div>

		<div class="flex items-center gap-3">
			{#if sortedSummaries.length > 0}
				<div class="flex flex-1 items-center gap-2">
					<History class="size-3.5 text-muted-foreground" />
					<select
						id="summary-version"
						class="h-8 min-w-0 flex-1 rounded-md border border-input bg-background px-2 text-[13px] font-medium shadow-xs outline-none transition-all hover:border-primary/50 focus:border-primary focus:ring-1 focus:ring-primary"
						bind:value={selectedSummaryId}
						disabled={isGenerating}
					>
						{#each sortedSummaries as summary (summary.id)}
							<option value={summary.id}>
								v{summary.version} {summary.is_current ? '(Current)' : ''}
							</option>
						{/each}
					</select>
				</div>
			{/if}

			{#if activeSummary}
				<div class="flex items-center gap-1.5">
					<Badge variant="outline" class="h-6 px-1.5 py-0 text-[10px] font-bold uppercase tracking-widest bg-primary/5 text-primary border-primary/20">
						{isGenerating ? 'Draft' : `v${activeSummary.version}`}
					</Badge>
					{#if activeSummary.is_current && !isGenerating}
						<Badge class="h-6 px-1.5 py-0 text-[10px] font-bold uppercase tracking-widest bg-emerald-500/10 text-emerald-600 border-emerald-500/20 hover:bg-emerald-500/10 shadow-none">
							Current
						</Badge>
					{/if}
				</div>
			{/if}
		</div>
	</header>

	<ScrollArea class="min-h-0 flex-1" orientation="vertical">
		<div class="px-5 py-6">
			{#if isLoading}
				<div class="flex flex-col items-center justify-center py-20 text-center space-y-4">
					<LoaderCircle class="size-8 animate-spin text-primary/40" />
					<p class="text-sm font-medium text-muted-foreground">Synthesizing history...</p>
				</div>
			{:else if loadError && !hasAnySummary}
				<div class="flex flex-col items-center justify-center gap-5 py-20 text-center px-4">
					<div class="rounded-full bg-destructive/10 p-4 text-destructive">
						<AlertCircle class="size-8" />
					</div>
					<div class="space-y-2">
						<p class="text-sm font-bold">Summary unavailable</p>
						<p class="text-xs text-muted-foreground leading-relaxed">{loadError}</p>
					</div>
					<Button
						variant="outline"
						size="sm"
						onclick={() => {
							loadedForDocumentId = null;
							void loadSummaries();
						}}
					>
						<RotateCcw class="size-3.5 mr-2" />
						Retry
					</Button>
				</div>
			{:else if !activeSummary}
				<div class="flex flex-col items-center justify-center gap-6 py-24 text-center px-6">
					<div class="relative">
						<div class="absolute -inset-4 rounded-full bg-primary/10 blur-2xl animate-pulse"></div>
						<div class="relative rounded-full bg-card border shadow-xl p-5 text-primary">
							<Sparkles class="size-10" />
						</div>
					</div>
					<div class="space-y-2">
						<p class="text-base font-bold tracking-tight">Generate your first summary</p>
						<p class="text-xs text-muted-foreground leading-relaxed max-w-[240px] mx-auto">
							I'll analyze your {highlights.length} highlights to build a structured overview of this document.
						</p>
					</div>
					<Button
						size="lg"
						class="h-11 px-8 rounded-full font-bold shadow-lg shadow-primary/20 transition-all hover:scale-105 active:scale-95"
						onclick={generateSummary}
						disabled={isGenerating}
					>
						{#if isGenerating}
							<LoaderCircle class="size-4 animate-spin mr-2" />
							Synthesizing...
						{:else}
							<Sparkles class="size-4 mr-2" />
							Generate Summary
						{/if}
					</Button>
				</div>
			{:else}
				{#if viewingPastVersion && currentSummary}
					<div class="mb-8 flex items-center justify-between gap-4 rounded-xl border border-blue-500/20 bg-blue-500/5 p-3.5 shadow-sm">
						<div class="flex items-center gap-3 text-[13px] font-medium text-blue-700 dark:text-blue-400">
							<History class="size-4" />
							Viewing v{activeSummary?.version}
						</div>
						<Button
							variant="ghost"
							size="xs"
							class="h-7 rounded-lg font-bold text-blue-700 hover:bg-blue-500/10 dark:text-blue-400"
							onclick={setSelectedToCurrent}
						>
							Back to current
						</Button>
					</div>
				{/if}

				{#if generationError}
					<div class="mb-8 flex items-center justify-between gap-4 rounded-xl border border-destructive/20 bg-destructive/5 p-3.5">
						<div class="flex items-center gap-3 text-[13px] font-medium text-destructive">
							<AlertCircle class="size-4" />
							{generationError}
						</div>
						<Button
							variant="ghost"
							size="xs"
							class="h-7 rounded-lg font-bold text-destructive hover:bg-destructive/10"
							onclick={generateSummary}
						>
							Retry
						</Button>
					</div>
				{/if}

				<MockSummaryContent
					markdown={activeSummary.markdown}
					{highlights}
					{viewerUtils}
					{viewerColorMode}
					{onJumpToHighlight}
				/>

				{#if activeSummary.open_questions.length > 0 && !activeSummary.markdown.toLowerCase().includes('open questions')}
					<div class="mt-12 space-y-5">
						<h3 class="text-[11px] font-bold tracking-[0.2em] text-orange-600 dark:text-orange-500 uppercase">
							Open Questions
						</h3>
						<ul class="space-y-4">
							{#each activeSummary.open_questions as question}
								<li class="flex gap-4 text-[14px] leading-relaxed text-foreground/80 group">
									<span class="mt-2.5 size-1.5 shrink-0 rounded-full bg-orange-500/40 group-hover:bg-orange-500 transition-colors"></span>
									{question}
								</li>
							{/each}
						</ul>
					</div>
				{/if}

				{#if activeSummary.tags.length > 0 || activeSummary.entities.length > 0}
					<div class="mt-14 border-t border-border pt-8 pb-4">
						<div class="grid grid-cols-1 gap-8">
							{#if activeSummary.tags.length > 0}
								<div class="space-y-3">
									<span class="text-[10px] font-bold tracking-widest text-muted-foreground uppercase opacity-70">
										Themes
									</span>
									<div class="flex flex-wrap gap-2">
										{#each activeSummary.tags as tag}
											<Badge variant="secondary" class="font-medium bg-muted/50 hover:bg-muted text-muted-foreground border-none">
												{tag}
											</Badge>
										{/each}
									</div>
								</div>
							{/if}
							{#if activeSummary.entities.length > 0}
								<div class="space-y-3">
									<span class="text-[10px] font-bold tracking-widest text-muted-foreground uppercase opacity-70">
										Key Entities
									</span>
									<div class="flex flex-wrap gap-2">
										{#each activeSummary.entities as entity}
											<Badge variant="outline" class="font-medium text-foreground/70 border-border/50">
												{entity}
											</Badge>
										{/each}
									</div>
								</div>
							{/if}
						</div>
					</div>
				{/if}
				
				<div class="mt-12 flex items-center justify-center gap-2 text-[11px] text-muted-foreground/40 font-medium tracking-wide">
					<CheckCircle2 class="size-3" />
					END OF ANALYSIS
				</div>
			{/if}
		</div>
	</ScrollArea>
</div>

<style>
	/* Custom scrollbar handling if needed, though ScrollArea handles most of it */
</style>
