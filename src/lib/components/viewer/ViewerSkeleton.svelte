<script lang="ts">
	import { Skeleton } from '$lib/components/ui/skeleton';
	import { cn } from '$lib/utils';

	interface Props {
		progress?: number; // 0 to 100
		leftOpen?: boolean;
		sidebarOpen?: boolean;
	}

	let { progress = 0, leftOpen = true, sidebarOpen = true }: Props = $props();

	const progressWidth = $derived(`${Math.min(100, Math.max(0, progress))}%`);
</script>

<div class="relative flex h-full w-full flex-col overflow-hidden bg-background">
	<!-- Fixed Top Loading Bar -->
	{#if progress >= 0}
		<div class="fixed left-0 top-0 z-[100] h-[2px] w-full bg-transparent">
			<div
				class="h-full bg-primary transition-all duration-300 ease-out"
				style:width={progressWidth}
			></div>
		</div>
	{/if}

	<div class="flex min-h-0 flex-1 overflow-hidden">
		<!-- Left Panel Skeleton -->
		{#if leftOpen}
			<div class="flex w-[260px] flex-col border-r bg-muted/5">
				<div class="flex h-14 items-center border-b px-4">
					<Skeleton class="h-4 w-24" />
				</div>
				<div class="flex-1 space-y-4 p-4">
					{#each Array(8) as _}
						<div class="flex items-center gap-3">
							<Skeleton class="h-10 w-10 shrink-0 rounded" />
							<div class="flex-1 space-y-2">
								<Skeleton class="h-3 w-full" />
								<Skeleton class="h-3 w-2/3" />
							</div>
						</div>
					{/each}
				</div>
			</div>
		{/if}

		<!-- Main Content Skeleton -->
		<div class="flex min-w-0 flex-1 flex-col overflow-hidden">
			<!-- Header Skeleton -->
			<div class="flex h-14 items-center justify-between border-b px-4">
				<div class="flex items-center gap-4">
					<Skeleton class="h-8 w-8 rounded" />
					<Skeleton class="h-4 w-48 rounded" />
				</div>
				<div class="flex items-center gap-2">
					<Skeleton class="h-8 w-24 rounded" />
					<Skeleton class="h-8 w-8 rounded" />
					<Skeleton class="h-8 w-8 rounded" />
				</div>
			</div>

			<!-- PDF Pages Skeleton -->
			<div class="flex-1 overflow-hidden bg-muted/20 p-8">
				<div class="mx-auto flex max-w-3xl flex-col items-center gap-8">
					{#each Array(3) as _}
						<div class="w-full bg-card shadow-sm border rounded-sm p-8 space-y-6 aspect-[1/1.4]">
							<div class="space-y-4">
								<Skeleton class="h-6 w-3/4" />
								<Skeleton class="h-4 w-full" />
								<Skeleton class="h-4 w-full" />
								<Skeleton class="h-4 w-5/6" />
							</div>
							<div class="space-y-4 pt-4">
								<Skeleton class="h-4 w-full" />
								<Skeleton class="h-4 w-full" />
								<Skeleton class="h-4 w-2/3" />
							</div>
							<div class="grid grid-cols-2 gap-4 pt-4">
								<Skeleton class="h-32 w-full rounded" />
								<Skeleton class="h-32 w-full rounded" />
							</div>
							<div class="space-y-4 pt-4">
								<Skeleton class="h-4 w-full" />
								<Skeleton class="h-4 w-1/2" />
							</div>
						</div>
					{/each}
				</div>
			</div>
		</div>

		<!-- Right Sidebar Skeleton -->
		{#if sidebarOpen}
			<div class="flex w-[300px] flex-col border-l bg-muted/5">
				<div class="flex h-14 items-center border-b px-4">
					<Skeleton class="h-4 w-32" />
				</div>
				<div class="flex-1 space-y-6 p-4">
					{#each Array(4) as _}
						<div class="space-y-3 rounded-lg border bg-card p-3 shadow-sm">
							<div class="flex items-center justify-between">
								<Skeleton class="h-3 w-16 rounded-full" />
								<Skeleton class="h-3 w-12" />
							</div>
							<Skeleton class="h-4 w-full" />
							<Skeleton class="h-3 w-2/3" />
							<div class="flex gap-2 pt-1">
								<Skeleton class="h-6 w-6 rounded-full" />
								<Skeleton class="h-6 w-6 rounded-full" />
							</div>
						</div>
					{/each}
				</div>
			</div>
		{/if}
	</div>
</div>
