<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import { Plus, Library } from '@lucide/svelte';

	const { data } = $props();
	const { profile, user } = $derived(data);
</script>

<div class="flex min-h-[60vh] flex-col items-center justify-center space-y-6 text-center">
	<div class="flex h-20 w-20 items-center justify-center rounded-full bg-muted">
		<Library class="h-10 w-10 text-muted-foreground" />
	</div>
	<div class="space-y-2">
		<h2 class="text-2xl font-bold tracking-tight">Welcome to your library, {profile?.full_name?.split(' ')[0] || user?.email?.split('@')[0]}</h2>
		<p class="mx-auto max-w-sm text-muted-foreground">
			You haven't uploaded any documents yet. Start by uploading a PDF to see AI-powered summaries and highlights.
		</p>
	</div>
	<Button class="gap-2 shadow-lg transition-all hover:scale-105" size="lg">
		<Plus class="h-5 w-5" />
		Upload your first PDF
	</Button>
</div>
