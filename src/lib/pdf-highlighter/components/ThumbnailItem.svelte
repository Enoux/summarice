<script lang="ts">
	import type { ThumbnailData } from '$lib/pdf-highlighter/types';

	interface Props {
		pageNumber: number;
		thumbnail: ThumbnailData;
		isActive: boolean;
		onSelect: (pageNumber: number) => void;
	}

	let { pageNumber, thumbnail, isActive, onSelect }: Props = $props();
</script>

<button
	type="button"
	class="flex w-full flex-col items-center gap-1 rounded-lg border p-2 text-left transition-colors"
	class:border-[var(--lp-accent)]={isActive}
	class:bg-[var(--lp-hover)]={isActive}
	class:border-[var(--lp-border)]={!isActive}
	onclick={() => onSelect(pageNumber)}
>
	<div
		class="flex aspect-[3/4] w-full items-center justify-center overflow-hidden rounded bg-white/5 text-[11px] text-[var(--lp-muted)]"
	>
		{#if thumbnail.isLoading}
			<span
				class="h-4 w-4 animate-spin rounded-full border border-[var(--lp-border)] border-t-[var(--lp-accent)]"
			></span>
		{:else if thumbnail.dataUrl}
			<img src={thumbnail.dataUrl} alt="" class="h-full w-full object-contain" />
		{:else if thumbnail.error}
			{thumbnail.error}
		{:else}
			Page {pageNumber}
		{/if}
	</div>
	<span class="text-[12px] font-medium text-[var(--lp-text)]">{pageNumber}</span>
</button>
