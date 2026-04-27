<script lang="ts">
	//providing context
	import type { Snippet } from 'svelte';

	interface HighlightChildrenWrapperProps {
		child_context: unknown;
		children: Snippet;
	}

	import { setContext } from 'svelte';
	let { child_context, children }: HighlightChildrenWrapperProps = $props();
	setContext('highlightUtils', child_context);
</script>

{#key child_context}
	{@render children?.()}
{/key}
