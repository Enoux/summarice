<script lang="ts">
	let { children } = $props();
</script>

<div class="flex min-h-screen items-center justify-center bg-muted/30 p-4">
	<div class="w-full max-w-md space-y-8 rounded-xl border bg-card p-8 shadow-2xl">
		{@render children()}
	</div>
</div>
