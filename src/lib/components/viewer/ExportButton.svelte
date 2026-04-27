<script lang="ts">
	import { exportPdf, type ExportableHighlight } from '$lib/pdf-highlighter';
	import type { Highlight } from '$lib/pdf-highlighter/types';
	import { Download, Loader2 } from '@lucide/svelte';
	import { Button } from '$lib/components/ui/button';
	import * as Tooltip from '$lib/components/ui/tooltip';

	interface Props {
		pdfSource: string;
		highlights: Highlight[];
		fileName?: string;
	}

	let { pdfSource, highlights, fileName = 'annotated.pdf' }: Props = $props();

	let busy = $state(false);
	let progress = $state('');

	function toExportable(list: Highlight[]): ExportableHighlight[] {
		return list
			.filter((h) => h.id && h.position)
			.map((h) => ({
				id: h.id!,
				type: h.type ?? 'area',
				content: h.content,
				position: h.position!
			}));
	}

	async function runExport() {
		busy = true;
		progress = '';
		try {
			const bytes = await exportPdf(pdfSource, toExportable(highlights), {
				onProgress: (c: number, t: number) => {
					progress = `${c} / ${t} pages`;
				}
			});
			const buffer = bytes.buffer.slice(
				bytes.byteOffset,
				bytes.byteOffset + bytes.byteLength
			) as ArrayBuffer;
			const blob = new Blob([buffer], { type: 'application/pdf' });
			const url = URL.createObjectURL(blob);
			const a = document.createElement('a');
			a.href = url;
			a.download = fileName;
			a.click();
			URL.revokeObjectURL(url);
		} finally {
			busy = false;
			progress = '';
		}
	}
</script>

<Tooltip.Root>
	<Tooltip.Trigger>
		{#snippet child({ props })}
			<Button {...props} disabled={busy} onclick={runExport} variant="default" class="min-w-0">
				{#if busy}
					<Loader2 class="size-4 shrink-0 animate-spin" />
					<span class="truncate">{progress || 'Exporting…'}</span>
				{:else}
					<Download class="size-4 shrink-0" />
					Export PDF
				{/if}
			</Button>
		{/snippet}
	</Tooltip.Trigger>
	<Tooltip.Content side="bottom">Download a copy of this PDF with highlights</Tooltip.Content>
</Tooltip.Root>
