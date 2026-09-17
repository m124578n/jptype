<script lang="ts">
	import { page } from '$app/state';
	import { resolve } from '$app/paths';
	import { m } from '$lib/paraglide/messages';

	const notFound = $derived(page.status === 404);
</script>

<svelte:head><title>{page.status} · {m.seo_site_name()}</title></svelte:head>

<div class="container stack error">
	<p class="muted code">{page.status}</p>
	<h1>{notFound ? m.error_404_title() : m.error_other_title()}</h1>
	<p class="muted">{notFound ? m.error_404_body() : m.error_other_body()}</p>
	<p><a class="btn btn--primary" href={resolve('/')}>{m.error_home()}</a></p>
</div>

<style>
	.error {
		text-align: center;
		align-items: center;
	}
	.code {
		font-size: 0.875rem;
		letter-spacing: 0.1em;
	}
</style>
