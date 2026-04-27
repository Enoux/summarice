<script lang="ts">
	import type { PDFDocumentProxy } from 'pdfjs-dist';
	import type { ThumbnailData } from '$lib/pdf-highlighter/types';
	import { renderPageThumbnail } from '$lib/pdf-highlighter/hooks/thumbnails';
	import ThumbnailItem from './ThumbnailItem.svelte';
	import { onMount } from 'svelte';
	import { SvelteMap } from 'svelte/reactivity';

	interface Props {
		pdfDocument: PDFDocumentProxy;
		currentPage: number;
		onPageSelect: (pageNumber: number) => void;
		thumbnailWidth?: number;
	}

	let { pdfDocument, currentPage, onPageSelect, thumbnailWidth = 180 }: Props = $props();

	let thumbnails = new SvelteMap<number, ThumbnailData>();
	let rootEl: HTMLDivElement | null = $state(null);

	const totalPages = $derived(pdfDocument.numPages);

	async function ensureThumbnail(pageNumber: number) {
		const existing = thumbnails.get(pageNumber);
		if (existing?.dataUrl || existing?.isLoading) return;

		thumbnails.set(pageNumber, { pageNumber, dataUrl: null, isLoading: true });

		const data = await renderPageThumbnail(pdfDocument, pageNumber, thumbnailWidth);
		thumbnails.set(pageNumber, data);
	}

	function onScroll() {
		if (!rootEl) return;
		const buttons = rootEl.querySelectorAll('[data-thumb-page]');
		const viewTop = rootEl.scrollTop;
		const viewBottom = viewTop + rootEl.clientHeight;
		for (const el of buttons) {
			const page = Number((el as HTMLElement).dataset.thumbPage);
			if (!Number.isFinite(page)) continue;
			const top = (el as HTMLElement).offsetTop;
			const bottom = top + (el as HTMLElement).offsetHeight;
			if (bottom >= viewTop && top <= viewBottom) {
				void ensureThumbnail(page);
			}
		}
	}

	onMount(() => {
		void ensureThumbnail(currentPage);
		onScroll();
	});

	$effect(() => {
		void currentPage;
		void ensureThumbnail(currentPage);
	});
</script>

<div
	bind:this={rootEl}
	class="min-h-0 flex-1 space-y-2 overflow-y-auto px-2 py-2"
	onscroll={onScroll}
>
	{#if totalPages === 0}
		<p class="p-6 text-center text-[13px] text-[var(--lp-muted)]">No pages</p>
	{:else}
		{#each Array.from({ length: totalPages }, (_, i) => i + 1) as pageNumber (pageNumber)}
			<div data-thumb-page={pageNumber}>
				<ThumbnailItem
					{pageNumber}
					thumbnail={thumbnails.get(pageNumber) ?? { pageNumber, dataUrl: null, isLoading: false }}
					isActive={pageNumber === currentPage}
					onSelect={onPageSelect}
				/>
			</div>
		{/each}
	{/if}
</div>
