<script lang="ts">
	import { MessageSquare } from '@lucide/svelte';
	import { Button } from '$lib/components/ui/button';
</script>

<div class="flex flex-1 flex-col items-center justify-center space-y-4 p-6 text-center">
	<div class="rounded-full bg-muted p-5">
		<MessageSquare class="text-muted-foreground/30 size-10" />
	</div>
	<div class="space-y-2">
		<h3 class="text-lg font-semibold">Generate Summary</h3>
		<p class="text-muted-foreground max-w-[240px] text-sm">
			Summarice can organize your highlights into a structured document. Add some highlights
			first!
		</p>
	</div>
	<Button variant="secondary" disabled class="mt-4">Generate (Coming soon)</Button>
</div>
