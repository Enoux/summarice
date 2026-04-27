<script lang="ts">
	let { children } = $props();
</script>

<div class="flex min-h-screen flex-col">
	<!-- TODO: Add authed app shell / navigation (Issue NN) -->
	<main class="flex-1">
		{@render children()}
	</main>
</div>
