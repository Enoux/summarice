<script lang="ts">
	import { cn } from '$lib/utils.js';

	let { class: className }: { class?: string } = $props();
</script>

<div class={cn('mb-4 flex justify-center', className)}>
	<div
		class="grid grid-cols-2 rounded-lg border border-border bg-muted p-1 text-sm font-medium"
		aria-label="Search mode"
	>
		<button
			type="button"
			class="rounded-md bg-background px-4 py-2 text-foreground shadow-sm"
			aria-pressed="true"
		>
			Fast
		</button>
		<button
			type="button"
			class="cursor-not-allowed rounded-md px-4 py-2 text-muted-foreground"
			disabled
			aria-disabled="true"
		>
			Deep
		</button>
	</div>
</div>
