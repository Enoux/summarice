<script lang="ts">
	import { FileText, ChevronRight, Clock, Trash2 } from '@lucide/svelte';
	import { cn } from '$lib/utils';
	import { Button } from '$lib/components/ui/button';
	import type { LibraryDocument } from '$lib/types/library-document';

	let { documents, onDelete } = $props<{
		documents: LibraryDocument[];
		onDelete: (id: string) => void;
	}>();

	function formatDate(dateStr: string) {
		return new Date(dateStr).toLocaleDateString(undefined, {
			month: 'short',
			day: 'numeric',
			year: 'numeric'
		});
	}
</script>

<div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
	{#each documents as doc (doc.id)}
		<div class="group relative flex flex-col rounded-xl border bg-card p-5 transition-all hover:border-primary/50 hover:shadow-md">			
			<div class="flex-1 space-y-1">
				<h3 class="line-clamp-1 font-semibold leading-tight" title={doc.title}>
					{doc.title}
				</h3>
				<p class="text-xs text-muted-foreground">
					{doc.page_count} pages
				</p>
			</div>

			<div class="mt-4 flex items-center justify-between pt-4 border-t border-muted/50">
				<div class="flex items-center text-[10px] text-muted-foreground">
					<Clock class="mr-1 h-3 w-3" />
					{formatDate(doc.created_at)}
				</div>
				<div class="flex items-center rounded-full bg-green-500/10 px-2 py-0.5 text-[10px] font-medium text-green-600">
					Ready
				</div>
			</div>
			
			<a 
				href={`/doc/${doc.id}`}
				class="absolute inset-0 z-0"
				aria-label={`View ${doc.title}`}
			></a>

			<button 
				onclick={() => onDelete(doc.id)}
				class="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity rounded-md p-2 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
				title="Delete document"
			>
				<Trash2 class="h-4 w-4" />
			</button>
		</div>
	{/each}
</div>
