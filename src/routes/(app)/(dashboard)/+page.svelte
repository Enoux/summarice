<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import { Plus, Library, Search } from '@lucide/svelte';
	import DropZone from '$lib/components/dashboard/DropZone.svelte';
	import DocumentList from '$lib/components/dashboard/DocumentList.svelte';
	import UploadProgress from '$lib/components/dashboard/UploadProgress.svelte';
	import { ingest, type IngestionProgress } from '$lib/ingestion';
	import { invalidate } from '$app/navigation';
	import { Input } from '$lib/components/ui/input';

	const { data } = $props();
	const { profile, user, supabase, documents: initialDocuments } = $derived(data);

	let ingestionProgress = $state<IngestionProgress | null>(null);
	let searchQuery = $state('');

	const filteredDocuments = $derived(
		initialDocuments.filter((doc: any) => 
			doc.title.toLowerCase().includes(searchQuery.toLowerCase())
		)
	);

	async function handleUpload(files: FileList) {
		const file = files[0];
		if (!file) return;

		try {
			await ingest(file, supabase, (p) => {
				ingestionProgress = p;
			});
			
			// Refresh documents list
			await invalidate('supabase:auth');
			
			// Clear progress after short delay if successful
			setTimeout(() => {
				if (ingestionProgress?.stage === 'ready') {
					ingestionProgress = null;
				}
			}, 3000);
		} catch (err) {
			console.error('Upload failed:', err);
		}
	}

	async function handleDelete(id: string) {
		if (!confirm('Are you sure you want to delete this document?')) return;
		
		const { error } = await supabase
			.from('documents')
			.delete()
			.eq('id', id);
			
		if (!error) {
			await invalidate('supabase:auth');
		}
	}
</script>

<div class="space-y-8">
	<div class="flex flex-col space-y-4 sm:flex-row sm:items-center sm:justify-between sm:space-y-0">
		<div>
			<h2 class="text-3xl font-bold tracking-tight">Your Library</h2>
			<p class="text-muted-foreground">
				Manage your PDFs and generated summaries.
			</p>
		</div>
		
		{#if initialDocuments.length > 0}
			<div class="flex items-center space-x-2">
				<div class="relative w-full max-w-xs">
					<Search class="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
					<Input
						type="search"
						placeholder="Search documents..."
						class="pl-9"
						bind:value={searchQuery}
					/>
				</div>
			</div>
		{/if}
	</div>

	{#if initialDocuments.length === 0}
		<div class="flex min-h-[40vh] flex-col items-center justify-center space-y-8 rounded-2xl border border-dashed p-12 text-center">
			<div class="flex h-20 w-20 items-center justify-center rounded-full bg-muted">
				<Library class="h-10 w-10 text-muted-foreground" />
			</div>
			<div class="space-y-2">
				<h3 class="text-2xl font-bold">Welcome, {profile?.full_name?.split(' ')[0] || user?.email?.split('@')[0]}</h3>
				<p class="mx-auto max-w-sm text-muted-foreground">
					You haven't uploaded any documents yet. Start by uploading a PDF to see AI-powered summaries and highlights.
				</p>
			</div>
			<DropZone onFilesDropped={handleUpload} class="w-full max-w-md" />
		</div>
	{:else}
		<div class="space-y-6">
			<DropZone onFilesDropped={handleUpload} class="h-32" />
			
			{#if filteredDocuments.length > 0}
				<DocumentList documents={filteredDocuments} onDelete={handleDelete} />
			{:else}
				<div class="flex flex-col items-center justify-center py-12 text-center">
					<Search class="mb-4 h-12 w-12 text-muted-foreground/50" />
					<p class="text-lg font-medium">No documents match your search</p>
					<p class="text-muted-foreground">Try a different search term or upload a new file.</p>
				</div>
			{/if}
		</div>
	{/if}
</div>

{#if ingestionProgress}
	<UploadProgress 
		progress={ingestionProgress} 
		onClear={() => ingestionProgress = null} 
	/>
{/if}
