<script lang="ts">
	import { enhance } from '$app/forms';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Separator } from '$lib/components/ui/separator';
	import { DEFAULT_CATEGORY_LABELS } from '$lib/highlights/color-slots';

	const { data, form } = $props();
	const settings = $derived(data.settings);

	let decorative = $state(false);
	let decorativeColor = $state('#facc15');

	$effect(() => {
		decorative = settings?.use_colors_decoratively ?? false;
		decorativeColor = settings?.decorative_default_color ?? '#facc15';
	});

	const defaults = DEFAULT_CATEGORY_LABELS;
</script>

<div class="mx-auto max-w-xl space-y-8">
	<div>
		<h2 class="text-2xl font-bold tracking-tight">Settings</h2>
		<p class="text-muted-foreground text-sm">Highlight categories and color semantics</p>
	</div>

	<form method="POST" action="?/save" use:enhance class="space-y-8">
		<div class="space-y-4 rounded-lg border border-border bg-card p-6">
			<label class="flex cursor-pointer items-start gap-3">
				<input
					type="checkbox"
					name="use_colors_decoratively"
					class="border-input text-primary mt-1 size-4 rounded"
					bind:checked={decorative}
				/>
				<span>
					<span class="text-sm font-medium">Use colors decoratively</span>
					<span class="text-muted-foreground block text-xs">
						When on, highlights have no semantic category; AI is told colors are not meaningful.
					</span>
				</span>
			</label>
			{#if decorative}
				<div class="space-y-2">
					<span class="text-sm font-medium" id="dec-l">Default highlight color</span>
					<Input
						id="dec"
						type="color"
						name="decorative_default_color"
						aria-labelledby="dec-l"
						class="h-10 w-24 cursor-pointer p-1"
						bind:value={decorativeColor}
					/>
				</div>
			{:else}
				<input type="hidden" name="decorative_default_color" value={decorativeColor} />
			{/if}
		</div>

		<div class="space-y-4 rounded-lg border border-border bg-card p-6">
			<h3 class="text-sm font-semibold">Category labels (slots 1–5)</h3>
			<p class="text-muted-foreground text-xs">
				These labels are shown in the viewer and passed to future AI prompts. Slots 4–5 map to “open
				questions” in summaries.
			</p>
			<div class="grid gap-3">
				{#each [1, 2, 3, 4, 5] as slot (slot)}
					<div class="flex items-center gap-3">
						<span class="text-muted-foreground w-6 text-xs font-medium">{slot}</span>
						<Input
							name="label_{slot}"
							class="flex-1"
							value={settings?.category_labels?.[String(slot)] ?? defaults[String(slot)]}
						/>
					</div>
				{/each}
			</div>
		</div>

		<Separator />

		<Button type="submit">Save settings</Button>
		{#if form?.success}
			<p class="text-sm text-green-600 dark:text-green-400">Saved.</p>
		{/if}
		{#if form?.message}
			<p class="text-destructive text-sm">{form.message}</p>
		{/if}
	</form>
</div>
