<script lang="ts">
	import {
		Ban,
		Check,
		ChevronDown,
		FileText,
		Highlighter,
		Layers,
		Palette
	} from '@lucide/svelte';
	import * as DropdownMenu from '$lib/components/ui/dropdown-menu/index.js';
	import {
		CATEGORY_SLOT_IDS,
		DEFAULT_CATEGORY_LABELS,
		LIGHT_HIGHLIGHT_SLOT_HEX,
		type CategorySlotId
	} from '$lib/highlights/color-slots';
	import type { FastSearchFilters, FastSearchResultScope } from '$lib/search/fast-search-types';
	import { cn } from '$lib/utils.js';

	let {
		resultScope = $bindable('both' as FastSearchResultScope),
		searchFilters = $bindable({} as FastSearchFilters),
		disabled = false,
		onClientFilterChange
	}: {
		resultScope?: FastSearchResultScope;
		searchFilters?: FastSearchFilters;
		disabled?: boolean;
		onClientFilterChange: () => void;
	} = $props();

	const scopeOptions: { id: FastSearchResultScope; label: string; icon: typeof Layers }[] = [
		{ id: 'both', label: 'Both', icon: Layers },
		{ id: 'highlights', label: 'Highlights', icon: Highlighter },
		{ id: 'documents', label: 'Documents', icon: FileText }
	];

	const activeScope = $derived(scopeOptions.find((option) => option.id === resultScope) ?? scopeOptions[0]);

	const colorSlotOptions = CATEGORY_SLOT_IDS.map((slot) => ({
		slot,
		label: DEFAULT_CATEGORY_LABELS[String(slot)] ?? `Slot ${slot}`,
		hex: LIGHT_HIGHLIGHT_SLOT_HEX[slot as CategorySlotId]
	}));

	const activeColorSlot = $derived(
		colorSlotOptions.find((option) => option.hex === searchFilters.color) ?? null
	);

	const hasColorFilter = $derived(Boolean(searchFilters.color));
	const showColorChip = $derived(resultScope !== 'documents');

	function selectScope(scope: FastSearchResultScope): void {
		if (disabled) {
			return;
		}
		resultScope = scope;
		onClientFilterChange();
	}

	function clearColorFilter(): void {
		if (disabled) {
			return;
		}
		const nextFilters = { ...searchFilters };
		delete nextFilters.color;
		searchFilters = nextFilters;
		onClientFilterChange();
	}

	function selectColor(hex: string): void {
		if (disabled) {
			return;
		}
		searchFilters = { ...searchFilters, color: hex };
		onClientFilterChange();
	}
</script>

<div
	class={cn(
		'flex flex-wrap items-center gap-2 pb-0.5',
		disabled && 'pointer-events-none opacity-50'
	)}
	role="group"
	aria-label="Search filters"
	aria-disabled={disabled}
>
	<DropdownMenu.Root>
		<DropdownMenu.Trigger>
			{#snippet child({ props })}
				{@const ScopeIcon = activeScope.icon}
				<button
					{...props}
					type="button"
					class={cn(
						'inline-flex items-center gap-1 rounded-full border border-border bg-background px-2 py-0.5 text-sm font-medium leading-tight text-foreground shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'
					)}
					aria-pressed="true"
				>
					<ScopeIcon class="size-3 shrink-0" aria-hidden="true" />
					<span>{activeScope.label}</span>
					<ChevronDown class="size-3 opacity-70" aria-hidden="true" />
				</button>
			{/snippet}
		</DropdownMenu.Trigger>
		<DropdownMenu.Content align="start" class="w-52">
			{#each scopeOptions as option (option.id)}
				{@const OptionIcon = option.icon}
				<DropdownMenu.Item class="gap-2" onclick={() => selectScope(option.id)}>
					<OptionIcon class="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
					<span class="flex-1">{option.label}</span>
					{#if resultScope === option.id}
						<Check class="size-4 text-foreground" aria-hidden="true" />
					{/if}
				</DropdownMenu.Item>
			{/each}
		</DropdownMenu.Content>
	</DropdownMenu.Root>

	{#if showColorChip}
		<DropdownMenu.Root>
			<DropdownMenu.Trigger>
				{#snippet child({ props })}
					<button
						{...props}
						type="button"
						class={cn(
							'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-sm font-medium leading-tight transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
							hasColorFilter
								? 'border-border bg-background text-foreground shadow-sm'
								: 'border-dashed border-border/80 bg-muted/40 text-muted-foreground hover:bg-muted hover:text-foreground'
						)}
						aria-pressed={hasColorFilter}
					>
						{#if activeColorSlot}
							<span
								class="size-3 shrink-0 rounded-full border border-border/60"
								style="background-color: {activeColorSlot.hex}"
								aria-hidden="true"
							></span>
							<span>{activeColorSlot.label}</span>
						{:else}
							<Palette class="size-3 shrink-0" aria-hidden="true" />
							<span>Color</span>
						{/if}
						<ChevronDown class="size-3 opacity-70" aria-hidden="true" />
					</button>
				{/snippet}
			</DropdownMenu.Trigger>
			<DropdownMenu.Content align="start" class="w-52">
				<DropdownMenu.Item class="gap-2" onclick={clearColorFilter}>
					<Ban class="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
					<span class="flex-1">Any color</span>
					{#if !hasColorFilter}
						<Check class="size-4 text-foreground" aria-hidden="true" />
					{/if}
				</DropdownMenu.Item>
				<DropdownMenu.Separator />
				{#each colorSlotOptions as option (option.slot)}
					<DropdownMenu.Item class="gap-2" onclick={() => selectColor(option.hex)}>
						<span
							class="size-3 shrink-0 rounded-full border border-border/60"
							style="background-color: {option.hex}"
							aria-hidden="true"
						></span>
						<span class="flex-1">{option.label}</span>
						{#if searchFilters.color === option.hex}
							<Check class="size-4 text-foreground" aria-hidden="true" />
						{/if}
					</DropdownMenu.Item>
				{/each}
			</DropdownMenu.Content>
		</DropdownMenu.Root>
	{/if}
</div>
