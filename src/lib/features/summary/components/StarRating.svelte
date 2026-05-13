<script lang="ts">
  let hoverValue = $state(0);

  let {
    value = $bindable(0),
    max = 5,
    readonly = false
  } = $props();

  function setRating(rating: number) {
    if (readonly) return;
    value = rating;
  }
</script>

<div class="flex items-center gap-1">
  {#each Array(max) as _, i}
    {@const rating = i + 1}

    <button
      type="button"
      class="transition-transform hover:scale-110 focus:outline-none"
      onmouseenter={() => (hoverValue = rating)}
      onmouseleave={() => (hoverValue = 0)}
      onclick={() => setRating(rating)}
      aria-label={`Rate ${rating} out of ${max}`}
      disabled={readonly}
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="currentColor"
        class={`h-6 w-6 ${
          rating <= (hoverValue || value)
            ? "text-yellow-400"
            : "text-gray-300 dark:text-gray-600"
        }`}
      >
        <path
          fill-rule="evenodd"
          d="M10.788 3.21c.448-1.077 1.976-1.077 2.424 0l2.082 5.006
          5.404.434c1.164.093 1.636 1.545.749 2.305l-4.117 3.527
          1.257 5.273c.271 1.136-.964 2.033-1.96 1.425L12 18.354
          7.373 21.18c-.996.608-2.231-.29-1.96-1.425l1.257-5.273
          -4.117-3.527c-.887-.76-.415-2.212.749-2.305l5.404-.434
          2.082-5.005z"
          clip-rule="evenodd"
        />
      </svg>
    </button>
  {/each}
</div>