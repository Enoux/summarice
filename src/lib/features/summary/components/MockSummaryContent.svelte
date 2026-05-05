<script lang="ts">
	import type { CommentedHighlight } from '$lib/pdf-highlighter/types';
	import type { PdfHighlighterUtils } from '$lib/pdf-highlighter';
	import CitationPill from './CitationPill.svelte';

	interface Props {
		markdown: string;
		highlights: CommentedHighlight[];
		viewerUtils?: Partial<PdfHighlighterUtils>;
		viewerColorMode?: 'light' | 'dark';
		onJumpToHighlight?: (id: string) => void;
	}

	let {
		markdown,
		highlights,
		viewerUtils,
		viewerColorMode = 'light',
		onJumpToHighlight
	}: Props = $props();

	type Block = {
		type: 'heading' | 'paragraph';
		level?: number;
		segments: Segment[];
	};

	type Segment = {
		type: 'text' | 'citation';
		content: string;
		ordinal?: number;
		isFirst?: boolean;
	};

	function parseSegments(text: string): Segment[] {
		const segments: Segment[] = [];
		const regex = /\[\^(\d+)\]/g;
		let lastIndex = 0;
		let match;

		while ((match = regex.exec(text)) !== null) {
			if (match.index > lastIndex) {
				segments.push({ type: 'text', content: text.slice(lastIndex, match.index) });
			}
			segments.push({ type: 'citation', content: match[0], ordinal: parseInt(match[1], 10) });
			lastIndex = regex.lastIndex;
		}

		if (lastIndex < text.length) {
			segments.push({ type: 'text', content: text.slice(lastIndex) });
		}

		return segments;
	}

	const blocks = $derived.by(() => {
		const source = markdown.replaceAll('\r\n', '\n').trim();
		if (!source) return [];

		const seenOrdinals = new Set<number>();

		return source
			.split(/\n{2,}/)
			.map((blockText) => blockText.trim())
			.filter(Boolean)
			.map((blockText): Block => {
				const headingMatch = /^(#{1,6})\s+(.+)$/.exec(blockText);
				if (headingMatch) {
					const level = headingMatch[1]?.length ?? 1;
					const content = headingMatch[2] ?? '';
					return {
						type: 'heading',
						level: Math.min(level, 3),
						segments: parseSegments(content).map(s => {
							if (s.type === 'citation' && !seenOrdinals.has(s.ordinal!)) {
								seenOrdinals.add(s.ordinal!);
								return { ...s, isFirst: true };
							}
							return s;
						})
					};
				}

				const content = blockText
					.split('\n')
					.map((line) => line.trim())
					.filter(Boolean)
					.join(' ');

				return {
					type: 'paragraph',
					segments: parseSegments(content).map(s => {
						if (s.type === 'citation' && !seenOrdinals.has(s.ordinal!)) {
							seenOrdinals.add(s.ordinal!);
							return { ...s, isFirst: true };
						}
						return s;
					})
				};
			});
	});

	function getHighlightByOrdinal(ordinal: number) {
		return highlights.find((h) => h.ordinal === ordinal) ?? null;
	}
</script>

<div class="summary-content space-y-6">
	{#each blocks as block}
		{#if block.type === 'heading'}
			{#if block.level === 1}
				<h1 class="text-xl font-bold tracking-tight text-foreground/90">
					{#each block.segments as segment}
						{#if segment.type === 'citation'}
							<CitationPill
								id={(() => {
									const highlight = getHighlightByOrdinal(segment.ordinal!);
									if (!highlight?.id || !segment.isFirst) return undefined;
									return `summary-citation-${highlight.id}`;
								})()}
								ordinal={segment.ordinal!}
								highlight={getHighlightByOrdinal(segment.ordinal!)}
								{viewerUtils}
								{viewerColorMode}
								{onJumpToHighlight}
							/>
						{:else}
							{segment.content}
						{/if}
					{/each}
				</h1>
			{:else if block.level === 2}
				<h2 class="text-lg font-semibold tracking-tight text-foreground/80">
					{#each block.segments as segment}
						{#if segment.type === 'citation'}
							<CitationPill
								id={(() => {
									const highlight = getHighlightByOrdinal(segment.ordinal!);
									if (!highlight?.id || !segment.isFirst) return undefined;
									return `summary-citation-${highlight.id}`;
								})()}
								ordinal={segment.ordinal!}
								highlight={getHighlightByOrdinal(segment.ordinal!)}
								{viewerUtils}
								{viewerColorMode}
								{onJumpToHighlight}
							/>
						{:else}
							{segment.content}
						{/if}
					{/each}
				</h2>
			{:else}
				<h3 class="text-base font-semibold tracking-tight text-foreground/70 uppercase">
					{#each block.segments as segment}
						{#if segment.type === 'citation'}
							<CitationPill
								id={(() => {
									const highlight = getHighlightByOrdinal(segment.ordinal!);
									if (!highlight?.id || !segment.isFirst) return undefined;
									return `summary-citation-${highlight.id}`;
								})()}
								ordinal={segment.ordinal!}
								highlight={getHighlightByOrdinal(segment.ordinal!)}
								{viewerUtils}
								{viewerColorMode}
								{onJumpToHighlight}
							/>
						{:else}
							{segment.content}
						{/if}
					{/each}
				</h3>
			{/if}
		{:else}
			<p class="text-[15px] leading-relaxed text-foreground/80 font-normal">
				{#each block.segments as segment}
					{#if segment.type === 'citation'}
						<CitationPill
							id={(() => {
								const highlight = getHighlightByOrdinal(segment.ordinal!);
								if (!highlight?.id || !segment.isFirst) return undefined;
								return `summary-citation-${highlight.id}`;
							})()}
							ordinal={segment.ordinal!}
							highlight={getHighlightByOrdinal(segment.ordinal!)}
							{viewerUtils}
							{viewerColorMode}
							{onJumpToHighlight}
						/>
					{:else}
						{segment.content}
					{/if}
				{/each}
			</p>
		{/if}
	{/each}
</div>

<style>
	.summary-content {
		max-width: 100%;
		overflow-wrap: break-word;
	}
</style>
