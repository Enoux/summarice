<script lang="ts">
	import { PUBLIC_MOCK_COMPONENTS } from '$env/static/public';
	import MockFileView from '$lib/components/dashboard/MockFileView.svelte';
	import FileView from '$lib/components/dashboard/FileView.svelte';

	let { data } = $props();
</script>

{#if PUBLIC_MOCK_COMPONENTS === 'true'}
	<MockFileView {data} />
{:else}
	<FileView {data} />
{/if}
