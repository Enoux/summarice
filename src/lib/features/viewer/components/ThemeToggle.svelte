<script lang="ts">
	import { toggleMode, mode } from 'mode-watcher';
	import { Moon, Sun } from '@lucide/svelte';
	import { Button } from '$lib/components/ui/button';

	let current = $derived(mode.current);
</script>

<Button variant="ghost" class="inline-flex min-w-22 gap-2" onclick={() => toggleMode()}>
	{#if current === 'dark'}
		<Sun class="size-4" />
		Light
	{:else}
		<Moon class="size-4" />
		Dark
	{/if}
</Button>
