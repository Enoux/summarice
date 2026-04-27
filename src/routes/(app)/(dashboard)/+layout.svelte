<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import { Separator } from '$lib/components/ui/separator';
	import * as Popover from '$lib/components/ui/popover';
	import { LogOut, User, LayoutDashboard, Settings, Library } from '@lucide/svelte';

	const { children, data } = $props();
	const { user, profile } = $derived(data);
</script>

<div class="flex h-screen bg-muted/30">
	<!-- Sidebar -->
	<aside class="flex w-64 flex-col border-r bg-card">
		<div class="flex h-16 items-center px-6">
			<span class="text-xl font-bold tracking-tight text-primary">Summarice</span>
		</div>
		<Separator />
		<nav class="flex-1 space-y-1 p-4">
			<Button variant="ghost" class="w-full justify-start gap-3" href="/">
				<LayoutDashboard class="h-4 w-4" />
				Dashboard
			</Button>
			<Button variant="ghost" class="w-full justify-start gap-3" href="/library">
				<Library class="h-4 w-4" />
				Library
			</Button>
			<Button variant="ghost" class="w-full justify-start gap-3" href="/settings">
				<Settings class="h-4 w-4" />
				Settings
			</Button>
		</nav>
		<Separator />
		<div class="p-4">
			<Popover.Root>
				<Popover.Trigger
					class="w-full justify-start gap-3 px-2 py-6 hover:bg-muted"
				>
					<div class="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary">
						<User class="h-4 w-4" />
					</div>
					<div class="flex flex-col items-start overflow-hidden text-sm">
						<span class="truncate font-medium">{profile?.full_name || user?.email}</span>
						<span class="truncate text-xs text-muted-foreground">{user?.email}</span>
					</div>
				</Popover.Trigger>
				<Popover.Content class="w-56 p-1">
					<div class="px-2 py-1.5 text-sm font-semibold">My Account</div>
					<Separator class="my-1" />
					<Button variant="ghost" class="w-full justify-start gap-2 text-sm" href="/settings">
						<Settings class="h-4 w-4" />
						Profile Settings
					</Button>
					<form action="/logout" method="POST" class="w-full">
						<Button variant="ghost" type="submit" class="w-full justify-start gap-2 text-sm text-destructive hover:bg-destructive/10 hover:text-destructive">
							<LogOut class="h-4 w-4" />
							Sign out
						</Button>
					</form>
				</Popover.Content>
			</Popover.Root>
		</div>
	</aside>

	<!-- Main Content -->
	<main class="flex-1 overflow-y-auto">
		<header class="flex h-16 items-center border-b bg-card px-8">
			<h1 class="text-lg font-semibold">Dashboard</h1>
		</header>
		<div class="p-8">
			{@render children()}
		</div>
	</main>
</div>
