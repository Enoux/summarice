<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Separator } from '$lib/components/ui/separator';

	const { data } = $props();
	const { supabase } = $derived(data);

	let email = $state('');
	let loading = $state(false);
	let message = $state('');

	async function handleLogin(e: Event) {
		e.preventDefault();
		loading = true;
		message = '';

		const { error } = await supabase.auth.signInWithOtp({
			email,
			options: {
				emailRedirectTo: `${window.location.origin}/auth/callback`
			}
		});

		if (error) {
			message = error.message;
		} else {
			message = 'Check your email for the login link!';
		}
		loading = false;
	}

	async function loginWithGoogle() {
		loading = true;
		const { error } = await supabase.auth.signInWithOAuth({
			provider: 'google',
			options: {
				redirectTo: `${window.location.origin}/auth/callback`
			}
		});
		if (error) {
			message = error.message;
			loading = false;
		}
	}
</script>

<div class="space-y-6">
	<div class="space-y-2 text-center">
		<h1 class="text-3xl font-bold tracking-tight">Welcome back</h1>
		<p class="text-muted-foreground">Sign in to your account to continue</p>
	</div>

	<div class="grid gap-4">
		<Button variant="outline" type="button" disabled={loading} onclick={loginWithGoogle} class="w-full">
			<svg class="mr-2 h-4 w-4" aria-hidden="true" focusable="false" data-prefix="fab" data-icon="google" role="img" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 488 512">
				<path fill="currentColor" d="M488 261.8C488 403.3 391.1 504 248 504 110.8 504 0 393.2 0 256S110.8 8 248 8c66.8 0 123 24.5 166.3 64.9l-67.5 64.9C258.5 52.6 94.3 116.6 94.3 256c0 86.5 69.1 156.6 153.7 156.6 98.2 0 135-70.4 140.8-106.9H248v-85.3h236.1c2.3 12.7 3.9 24.9 3.9 41.4z"></path>
			</svg>
			Continue with Google
		</Button>
	</div>

	<div class="relative">
		<div class="absolute inset-0 flex items-center">
			<Separator class="w-full" />
		</div>
		<div class="relative flex justify-center text-xs uppercase">
			<span class="bg-card px-2 text-muted-foreground">Or continue with email</span>
		</div>
	</div>

	<form onsubmit={handleLogin} class="space-y-4">
		<div class="space-y-2">
			<Input
				type="email"
				placeholder="name@example.com"
				bind:value={email}
				required
				disabled={loading}
				class="w-full"
			/>
		</div>
		<Button type="submit" disabled={loading} class="w-full">
			{loading ? 'Sending link...' : 'Sign in'}
		</Button>
	</form>

	{#if message}
		<p class="text-center text-sm font-medium {message.includes('Check') ? 'text-green-600' : 'text-destructive'}">
			{message}
		</p>
	{/if}

	<p class="px-8 text-center text-sm text-muted-foreground">
		<a href="/signup" class="hover:text-brand underline underline-offset-4">
			Don't have an account? Sign up
		</a>
	</p>
</div>
