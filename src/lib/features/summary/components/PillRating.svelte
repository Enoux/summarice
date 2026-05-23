<script lang="ts">
    import { Check } from '@lucide/svelte';

    let {
        comment = "text",
        onToggle
    } = $props();

    let isSelected = $state(false);

    function handleClick(){
        isSelected = !isSelected;
        onToggle?.(comment, isSelected);
    }
</script>

<button class="flex shrink-0 outline items-center rounded-lg px-2 w-fit hover:bg-gray-100" onclick={handleClick}>
    {#if isSelected}
        <Check class="size-3.5 pr-1" />
    {/if}
    <p> {comment} </p>
</button>