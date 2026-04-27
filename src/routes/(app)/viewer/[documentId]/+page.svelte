<script lang="ts">
	let { data } = $props();
	import {
		PdfLoader,
		PdfHighlighter,
		HighlightsModel,
		LeftPanel,
		type Highlight,
		type PdfHighlighterUtils
	} from '$lib/pdf-highlighter';
	import pdfWorkerUrl from '$lib/pdf-worker-url';
	import Header from '$lib/components/viewer/Header.svelte';
	import Sidebar from '$lib/components/viewer/Sidebar.svelte';
	import CommentPopup from '$lib/components/viewer/CommentPopup.svelte';
	import CommentForm from '$lib/components/viewer/CommentForm.svelte';
	import FloatingActions from '$lib/components/viewer/FloatingActions.svelte';
	import { mode } from 'mode-watcher';
	import { onMount } from 'svelte';
	import type { Component } from 'svelte';

	const defaultUrl = '/sample.pdf';

	let docUrl = $state<string | null>(null);
	let fileName = $state('');
	let pdfHighlighterUtils = $state<Partial<PdfHighlighterUtils>>({});
	let highlightsStore = new HighlightsModel<Highlight>([]);
	let sidebarOpen = $state(true);
	let leftOpen = $state(true);
	let selectedObjectUrl = $state<string | null>(null);
	const PdfHighlighterComponent = PdfHighlighter as unknown as Component<Record<string, unknown>>;
	type ViewerEventBus = {
		on: (ev: string, fn: (e: { pageNumber: number }) => void) => void;
		off: (ev: string, fn: (e: { pageNumber: number }) => void) => void;
	};

	const pdfTheme = $derived({
		mode: mode.current === 'dark' ? ('dark' as const) : ('light' as const)
	});

	function scrollToHash() {
		const id = document.location.hash.replace('#highlight-', '');
		if (!id) return;
		const h = highlightsStore.getHighlightById(id);
		if (h && pdfHighlighterUtils.scrollToHighlight) {
			pdfHighlighterUtils.scrollToHighlight(h);
		}
	}

	onMount(() => {
		const onHash = () => scrollToHash();
		window.addEventListener('hashchange', onHash);
		return () => {
			window.removeEventListener('hashchange', onHash);
			if (selectedObjectUrl) {
				URL.revokeObjectURL(selectedObjectUrl);
			}
		};
	});

	function onFilePick(e: Event) {
		const input = e.target as HTMLInputElement;
		const file = input.files?.[0];
		if (!file) return;
		if (selectedObjectUrl) {
			URL.revokeObjectURL(selectedObjectUrl);
		}
		const nextObjectUrl = URL.createObjectURL(file);
		fileName = file.name;
		docUrl = nextObjectUrl;
		selectedObjectUrl = nextObjectUrl;
		highlightsStore.resetHighlights();
	}
</script>

<div class="flex h-[100dvh] w-full flex-col overflow-hidden bg-background text-foreground">
	{#if docUrl}
		<Header
			utils={pdfHighlighterUtils}
			title={fileName}
			pdfSource={docUrl}
			highlights={highlightsStore.highlights}
			leftPanelOpen={leftOpen}
			onLeftPanelOpenChange={(v) => (leftOpen = v)}
			sidebarOpen={sidebarOpen}
			onSidebarOpenChange={(v) => (sidebarOpen = v)}
		/>

		<div class="flex min-h-0 flex-1">
			<main class="relative flex min-h-0 min-w-0 flex-1 flex-row">
				<PdfLoader document={docUrl} workerSrc={pdfWorkerUrl}>
					{#snippet pdfHighlighterWrapper(pdfDocument)}
						<div class="flex h-full min-w-0 flex-1">
							<LeftPanel
								{pdfDocument}
								goToPage={(n) => pdfHighlighterUtils.goToPage?.(n)}
								getEventBus={() => pdfHighlighterUtils.getEventBus?.() as ViewerEventBus | undefined}
								isOpen={leftOpen}
								onOpenChange={(v) => (leftOpen = v)}
							/>
							<div class="relative min-h-0 min-w-0 flex-1">
								<PdfHighlighterComponent
									bind:pdfHighlighterUtils
									{highlightsStore}
									{pdfDocument}
									theme={pdfTheme}
									scaleOnResize
									style=""
									onContextMenu={() => {}}
									onHighlightsRendered={scrollToHash}
								>
									{#snippet highlightPopup(hl: Highlight, setPinned: (value: boolean) => void)}
										<CommentPopup highlight={hl} {setPinned} />
									{/snippet}
									{#snippet editHighlightPopup(
										h: Highlight,
										colors: string[],
										onEdit: (comment: string) => void,
										onDelete: (highlight: Highlight) => void
									)}
										<CommentForm mode="edit" highlight={h} {colors} onSave={onEdit} {onDelete} />
									{/snippet}
									{#snippet newHighlightPopup(
										h: Highlight,
										colors: string[],
										onAdd: (highlight: Highlight) => void
									)}
										<CommentForm mode="new" highlight={h} {colors} {onAdd} />
									{/snippet}
								</PdfHighlighterComponent>

								<FloatingActions utils={pdfHighlighterUtils} {sidebarOpen} />
							</div>
						</div>
					{/snippet}
				</PdfLoader>
			</main>

			<Sidebar
				{highlightsStore}
				onJump={(h: Highlight) => pdfHighlighterUtils.scrollToHighlight?.(h)}
				bind:isOpen={sidebarOpen}
			/>
		</div>
	{:else}
		<div class="flex flex-1 items-center justify-center bg-muted/30">
			<div class="w-full max-w-md space-y-6 rounded-xl border bg-card p-8 shadow-2xl">
				<div class="flex flex-col items-center text-center space-y-2">
					<div class="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 text-primary mb-2">
						<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-file-text"><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M10 9H8"/><path d="M16 13H8"/><path d="M16 17H8"/></svg>
					</div>
					<h1 class="text-3xl font-bold tracking-tight">Summarice PDF</h1>
					<p class="text-muted-foreground">Modern PDF viewer with powerful highlighting capabilities.</p>
					{#if data.documentId}
						<div class="mt-4 rounded-md bg-muted px-3 py-1 text-xs font-mono">
							ID: {data.documentId}
						</div>
					{/if}
				</div>

				<div class="grid gap-4">
					<label class="group relative flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-muted-foreground/25 bg-muted/5 p-6 transition-all hover:border-primary/50 hover:bg-primary/5">
						<div class="flex flex-col items-center justify-center space-y-2">
							<div class="rounded-full bg-background p-2 shadow-sm group-hover:scale-110 transition-transform">
								<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-upload"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" x2="12" y1="3" y2="15"/></svg>
							</div>
							<p class="text-sm font-medium">Click to upload PDF</p>
						</div>
						<input type="file" accept="application/pdf" class="hidden" onchange={onFilePick} />
					</label>

					<div class="relative">
						<div class="absolute inset-0 flex items-center">
							<span class="w-full border-t"></span>
						</div>
						<div class="relative flex justify-center text-xs uppercase">
							<span class="bg-card px-2 text-muted-foreground">or</span>
						</div>
					</div>

					<button 
						onclick={() => { docUrl = defaultUrl; fileName = 'sample.pdf'; }}
						class="flex w-full items-center justify-center rounded-md border bg-background px-4 py-2.5 text-sm font-medium shadow-sm transition-colors hover:bg-accent hover:text-accent-foreground"
					>
						Load Sample PDF
					</button>
				</div>

				<div class="pt-4 text-xs text-center text-muted-foreground/60 border-t">
					<p>Powered by pdf-highlighter-plus</p>
				</div>
			</div>
		</div>
	{/if}
</div>
