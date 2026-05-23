<script lang="ts">
	import { cn } from '$lib/utils';
	import { Upload } from '@lucide/svelte';

	let { onFilesDropped, class: className } = $props<{
		onFilesDropped: (files: FileList) => void;
		class?: string;
	}>();

	let isDragging = $state(false);

	function handleDragOver(e: DragEvent) {
		e.preventDefault();
		isDragging = true;
	}

	function handleDragLeave() {
		isDragging = false;
	}

	function handleDrop(e: DragEvent) {
		e.preventDefault();
		isDragging = false;
		if (e.dataTransfer?.files) {
			const pdfFiles = Array.from(e.dataTransfer.files).filter((f) => f.type === 'application/pdf');
			if (pdfFiles.length > 0) {
				onFilesDropped(e.dataTransfer.files);
			}
		}
	}
</script>

<div
	role="region"
	aria-label="File drop zone"
	ondragover={handleDragOver}
	ondragleave={handleDragLeave}
	ondrop={handleDrop}
	class={cn(
		'relative flex flex-col items-center justify-center rounded-xl border-2 border-dashed transition-all duration-200 py-25',
		isDragging ? 'border-primary bg-primary/5 scale-[1.01]' : 'border-muted bg-card hover:border-muted-foreground/50',
		className
	)}
>
	<input
		type="file"
		accept="application/pdf"
		class="absolute inset-0 z-10 cursor-pointer opacity-0"
		onchange={(e) => e.currentTarget.files && onFilesDropped(e.currentTarget.files)}
	/>
	<div class="pointer-events-none flex flex-col items-center justify-center space-y-4 p-8 text-center">
		<div class="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
			<Upload class="h-6 w-6 text-muted-foreground" />
		</div>
		<div class="space-y-1">
			<p class="text-sm font-medium">Drag & drop your PDF here</p>
			<p class="text-xs text-muted-foreground">Or click to browse (up to 10MB)</p>
		</div>
	</div>
</div>
