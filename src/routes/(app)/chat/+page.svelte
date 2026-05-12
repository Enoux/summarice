<script lang="ts">
	import FastLibrarySearch from '$lib/components/search/FastLibrarySearch.svelte';
</script>

<svelte:head>
	<title>Chat Search - Summarice</title>
</svelte:head>

<div class="flex min-h-0 flex-1 flex-col">
	<div class="mx-auto w-full max-w-3xl shrink-0 pt-2">
		<FastLibrarySearch />
	</div>
</div>
