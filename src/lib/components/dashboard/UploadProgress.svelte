<script lang="ts">
	import type { UploadProgressData } from '$lib/features/document-upload/upload.client';
	import { cn } from '$lib/utils';
	import { Loader2, CheckCircle2, AlertCircle, X } from '@lucide/svelte';
	import { fade, slide } from 'svelte/transition';

	let { progress, onClear } = $props<{ 
		progress: UploadProgressData;
		onClear: () => void;
	}>();
</script>

{#if progress.stage !== 'ready' || progress.progress < 100}
	<div 
		transition:slide={{ axis: 'y' }}
		class="fixed inset-x-0 bottom-8 z-50 flex justify-center px-4"
	>
		<div class="flex w-full max-w-md flex-col space-y-3 rounded-xl border bg-card p-4 shadow-2xl">
			<div class="flex items-center justify-between">
				<div class="flex items-center space-x-3">
					{#if progress.stage === 'error'}
						<AlertCircle class="h-5 w-5 text-destructive" />
					{:else if progress.stage === 'ready'}
						<CheckCircle2 class="h-5 w-5 text-green-500" />
					{:else}
						<Loader2 class="h-5 w-5 animate-spin text-primary" />
					{/if}
					<span class="text-sm font-medium">
						{progress.message || 'Processing document...'}
					</span>
				</div>
				<div class="flex items-center space-x-2">
					<span class="text-xs text-muted-foreground">{Math.round(progress.progress)}%</span>
					{#if progress.stage === 'error'}
						<button 
							onclick={onClear}
							class="rounded-full p-1 hover:bg-muted"
						>
							<X class="h-4 w-4" />
						</button>
					{/if}
				</div>
			</div>

			<div class="h-2 w-full overflow-hidden rounded-full bg-muted">
				<div
					class={cn(
						'h-full transition-all duration-300',
						progress.stage === 'error' ? 'bg-destructive' : progress.stage === 'ready' ? 'bg-green-500' : 'bg-primary'
					)}
					style="width: {progress.progress}%"
				></div>
			</div>

			{#if progress.stage === 'error'}
				<p class="text-xs text-destructive">Please try again with a different file.</p>
			{/if}
		</div>
	</div>
{/if}
