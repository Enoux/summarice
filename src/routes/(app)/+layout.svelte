<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import * as Popover from '$lib/components/ui/popover';
	import FastLibrarySearch from '$lib/components/search/FastLibrarySearch.svelte';
	import { LogOut, User, Settings, LayoutDashboard, Command, Sun, Moon } from '@lucide/svelte';
	import { page } from '$app/state';
	import { toggleMode, mode } from 'mode-watcher';

	const { children, data } = $props();
	const { user, profile } = $derived(data);
	const currentMode = $derived(mode.current);
</script>

<div
	class="flex flex-col bg-muted/30 {page.url.pathname.startsWith('/doc')
		? 'h-dvh overflow-hidden'
		: page.url.pathname.startsWith('/chat')
			? 'h-dvh max-h-dvh min-h-0 overflow-x-hidden'
			: 'min-h-screen'}"
>
	<!-- Top Navbar -->
	<header class="navbar-solid px-2 sm:px-6">
		<div class="mx-auto grid h-full w-full grid-cols-[1fr_auto_1fr] items-center gap-2">
			<!-- Left: Logo & Breadcrumb -->
			<div class="flex min-w-0 items-center gap-2 justify-self-start pl-2.5">
				<a href="/" class="flex items-center gap-2 text-muted-foreground/80 hover:text-foreground transition-colors">
					<Command class="h-3.5 w-3.5" />
					{#if !page.url.pathname.startsWith('/doc')}
						<span class="text-foreground text-sm font-bold">Summarice</span>
					{/if}
				</a>
				
				<span class="text-muted-foreground/40 select-none">/</span>
				
				<div class="flex items-center gap-1.5 text-sm font-medium text-foreground">
					{#if page.url.pathname === '/'}
						<LayoutDashboard class="h-3.5 w-3.5 text-muted-foreground/80" />
						Dashboard
					{:else if page.url.pathname.startsWith('/doc')}
						<a href="/" class="flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors">
							<LayoutDashboard class="h-3.5 w-3.5" />
							Dashboard
						</a>
						<span class="text-muted-foreground/40 select-none">/</span>
						<span class="truncate max-w-[200px] font-medium">
							{page.data.document?.title || 'Document'}
						</span>
					{:else if page.url.pathname.startsWith('/settings')}
						<Settings class="h-3.5 w-3.5 text-muted-foreground/80" />
						Settings
					{:else}
						<LayoutDashboard class="h-3.5 w-3.5 text-muted-foreground/80" />
						Dashboard
					{/if}
				</div>
			</div>

			<div class="relative z-0 flex justify-self-center overflow-visible">
				<FastLibrarySearch />
			</div>

			<!-- Right: User Account -->
			<div class="flex items-center justify-self-end gap-4">
				<Popover.Root>
					<Popover.Trigger
						class="flex items-center gap-3 rounded-lg py-1 transition-colors hover:bg-muted/50"
					>
						<div class="hidden flex-col items-end text-right sm:flex">
							<span class="text-sm font-bold leading-tight">{profile?.full_name || user?.email?.split('@')[0]}</span>
							<span class="text-[10px] text-muted-foreground leading-tight">{user?.email}</span>
						</div>
						<div class="flex h-9 w-9 items-center justify-center rounded-full border bg-muted text-muted-foreground">
							<User class="h-5 w-5" />
						</div>
					</Popover.Trigger>
					<Popover.Content class="w-56 p-1" align="end">
						<form action="/logout" method="POST" class="w-full">
							<Button variant="ghost" type="submit" class="w-full justify-start gap-2 text-sm text-destructive hover:bg-destructive/10 hover:text-destructive">
								<LogOut class="h-4 w-4" />
								Sign out
							</Button>
						</form>
					</Popover.Content>
				</Popover.Root>
				<Button 
					variant="ghost" 
					size="icon" 
					class="h-9 w-9 rounded-full border border-border bg-muted text-muted-foreground hover:bg-muted/80" 
					onclick={() => toggleMode()}
				>	
					{#if currentMode === 'dark'}
						<Sun class="h-5 w-5" />
					{:else}
						<Moon class="h-5 w-5" />
					{/if}
				</Button>
				<Button 
					variant="ghost" 
					size="icon" 
					class="h-9 w-9 rounded-full border border-border bg-muted text-muted-foreground hover:bg-muted/80" 
					href="/settings"
				>	
					<Settings class="h-5 w-5" />
				</Button>
			</div>
		</div>
	</header>

	<!-- Main Content -->
	<main class="flex-1 min-h-0">
		<div
			class={page.url.pathname.startsWith('/doc')
				? 'h-full w-full'
				: page.url.pathname.startsWith('/chat')
					? 'mx-auto flex h-full min-h-0 w-full max-w-7xl flex-col p-4 sm:p-8'
					: 'mx-auto max-w-7xl p-4 sm:p-8'}
		>
			{@render children()}
		</div>
	</main>
</div>
