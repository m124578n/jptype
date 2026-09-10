<script lang="ts">
	import { m } from '$lib/paraglide/messages';
	import { resolve } from '$app/paths';
	import { signInWith, type Provider } from '$lib/auth-client';

	let { data } = $props();
	let busy = $state<Provider | null>(null);
	let error = $state(false);

	async function login(provider: Provider) {
		busy = provider;
		error = false;
		try {
			const res = await signInWith(provider, '/learn');
			if (res.error) error = true;
		} catch {
			error = true;
		} finally {
			busy = null;
		}
	}
</script>

<svelte:head><title>{m.login_title()} · {m.app_name()}</title></svelte:head>

<div class="container stack login">
	<header class="stack head">
		<h1>{m.login_title()}</h1>
		<p class="muted">{m.login_lead()}</p>
	</header>

	{#if data.user}
		<p class="card signed">
			{m.login_already({ name: data.user.name })}
			<a class="btn" href={resolve('/learn')}>{m.nav_learn()}</a>
		</p>
	{:else}
		<div class="stack providers">
			<button
				type="button"
				class="btn provider"
				disabled={busy !== null}
				aria-busy={busy === 'google'}
				onclick={() => login('google')}
			>
				<svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
					<path
						fill="#EA4335"
						d="M12 10.2v3.9h5.5c-.2 1.3-1.6 3.9-5.5 3.9-3.3 0-6-2.7-6-6s2.7-6 6-6c1.9 0 3.1.8 3.9 1.5l2.6-2.6C16.8 3.3 14.6 2.4 12 2.4 6.7 2.4 2.4 6.7 2.4 12S6.7 21.6 12 21.6c5.5 0 9.2-3.9 9.2-9.4 0-.6-.1-1.1-.2-1.6H12z"
					/>
				</svg>
				{m.login_with_google()}
			</button>
			<button
				type="button"
				class="btn provider"
				disabled={busy !== null}
				aria-busy={busy === 'line'}
				onclick={() => login('line')}
			>
				<svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
					<path
						fill="#06C755"
						d="M12 2.5C6.5 2.5 2 6.1 2 10.6c0 4 3.6 7.4 8.4 8 .3.1.8.2.9.5.1.3.1.7 0 1l-.1.9c0 .3-.2 1 .9.6 1.1-.5 6-3.5 8.2-6 1.5-1.6 2.2-3.3 2.2-5C22 6.1 17.5 2.5 12 2.5z"
					/>
				</svg>
				{m.login_with_line()}
			</button>
		</div>
		{#if error}
			<p class="error" role="alert">{m.login_failed()}</p>
		{/if}
		<p class="muted small center">{m.login_note()}</p>
	{/if}
</div>

<style>
	.login {
		gap: var(--space-8);
		max-width: 420px;
	}
	.head {
		gap: var(--space-2);
		text-align: center;
	}
	.providers {
		gap: var(--space-3);
	}
	.provider {
		width: 100%;
		min-height: 52px;
		justify-content: center;
		gap: var(--space-3);
	}
	.provider[disabled] {
		opacity: 0.6;
		cursor: progress;
	}
	.signed {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: var(--space-4);
		padding: var(--space-6);
		text-align: center;
	}
	.error {
		color: var(--danger);
		text-align: center;
	}
	.small {
		font-size: 0.875rem;
	}
	.center {
		text-align: center;
	}
</style>
