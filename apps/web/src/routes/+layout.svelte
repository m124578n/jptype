<script lang="ts">
	import '../app.css';
	import favicon from '$lib/assets/favicon.svg';
	import { m } from '$lib/paraglide/messages';
	import { page } from '$app/state';
	import { resolve } from '$app/paths';
	import { invalidateAll } from '$app/navigation';
	import { signOut } from '$lib/auth-client';

	let { children, data } = $props();
	const isLearn = $derived(page.url.pathname.startsWith('/learn'));
	const isTimed = $derived(page.url.pathname.startsWith('/timed'));
	const isListen = $derived(page.url.pathname.startsWith('/listen'));
	const isSongs = $derived(page.url.pathname.startsWith('/songs'));
	const isContents = $derived(page.url.pathname.startsWith('/contents'));
	const isBoard = $derived(page.url.pathname.startsWith('/leaderboard'));
	const isMe = $derived(page.url.pathname.startsWith('/me'));
	const isAdminPage = $derived(page.url.pathname.startsWith('/admin'));
	const isLogin = $derived(page.url.pathname.startsWith('/login'));

	async function logout() {
		await signOut();
		await invalidateAll();
	}
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
	<title>{m.app_name()}</title>
</svelte:head>

<header class="site-header">
	<nav class="container container--wide row" aria-label="主要">
		<a class="brand" href={resolve('/')}>{m.app_name()}</a>
		<a href={resolve('/learn')} aria-current={isLearn ? 'page' : undefined}>{m.nav_learn()}</a>
		<a href={resolve('/timed')} aria-current={isTimed ? 'page' : undefined}>{m.nav_timed()}</a>
		<a href={resolve('/listen')} aria-current={isListen ? 'page' : undefined}>{m.nav_listen()}</a>
		<a href={resolve('/songs')} aria-current={isSongs ? 'page' : undefined}>{m.nav_songs()}</a>
		<a href={resolve('/contents')} aria-current={isContents ? 'page' : undefined}>
			{m.nav_contents()}
		</a>
		<a href={resolve('/leaderboard')} aria-current={isBoard ? 'page' : undefined}
			>{m.nav_leaderboard()}</a
		>
		<span class="spacer"></span>
		{#if data.user}
			<a href={resolve('/me')} aria-current={isMe ? 'page' : undefined}>{m.nav_me()}</a>
			{#if data.isAdmin}
				<a href={resolve('/admin')} aria-current={isAdminPage ? 'page' : undefined}>
					{m.nav_admin()}
				</a>
			{/if}
			<span class="user">
				{#if data.user.image}
					<img class="avatar" src={data.user.image} alt="" width="28" height="28" />
				{/if}
				<span class="name">{data.user.name}</span>
			</span>
			<button type="button" class="btn btn--small" onclick={logout}>{m.nav_logout()}</button>
		{:else}
			<a
				class="btn btn--small"
				href={resolve('/login')}
				aria-current={isLogin ? 'page' : undefined}
			>
				{m.nav_login()}
			</a>
		{/if}
	</nav>
</header>

<main class="site-main">
	{@render children()}
</main>

<footer class="site-footer container muted">
	<p>{m.footer_note()}</p>
	<p class="row links">
		<a href={resolve('/terms')}>{m.footer_terms()}</a>
		<a href={resolve('/copyright')}>{m.footer_copyright()}</a>
	</p>
</footer>

<style>
	.site-header {
		border-bottom: 1px solid var(--border);
	}
	nav {
		min-height: 56px;
		gap: var(--space-6);
	}
	nav a:not(.btn) {
		text-decoration: none;
		padding: var(--space-2) 0;
		border-bottom: 2px solid transparent;
	}
	nav a:not(.btn)[aria-current='page'] {
		border-bottom-color: var(--accent);
	}
	.brand {
		font-weight: 700;
		margin-right: var(--space-4);
	}
	.spacer {
		flex: 1;
	}
	.user {
		display: inline-flex;
		align-items: center;
		gap: var(--space-2);
		font-size: 0.875rem;
	}
	.avatar {
		border-radius: 50%;
	}
	.name {
		max-width: 10em;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.btn--small {
		min-height: 36px;
		padding-inline: var(--space-4);
		font-size: 0.875rem;
	}
	.site-main {
		padding: var(--space-12) 0 var(--space-24);
		min-height: calc(100vh - 56px - 80px);
	}
	.site-footer {
		padding: var(--space-6) 0;
		font-size: 0.875rem;
		text-align: center;
	}
	.site-footer p {
		margin: 0;
	}
	.site-footer .links {
		justify-content: center;
		gap: var(--space-4);
		margin-top: var(--space-2);
	}
</style>
