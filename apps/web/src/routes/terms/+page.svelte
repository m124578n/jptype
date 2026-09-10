<script lang="ts">
	import { m } from '$lib/paraglide/messages';
	import { resolve } from '$app/paths';

	let { data } = $props();
</script>

<svelte:head><title>{m.terms_title()} · {m.app_name()}</title></svelte:head>

<div class="container stack page">
	<header class="stack head">
		<h1>{m.terms_title()}</h1>
		<p class="muted">{m.terms_lead()}</p>
	</header>

	<section class="stack">
		<h2>{m.terms_h_service()}</h2>
		<p>{m.terms_p_service()}</p>
	</section>

	<section class="stack">
		<h2>{m.terms_h_account()}</h2>
		<p>{m.terms_p_account()}</p>
	</section>

	<section class="stack">
		<h2>{m.terms_h_content()}</h2>
		<p>{m.terms_p_content()}</p>
		<p>{m.terms_p_takedown()}</p>
		<p><a href={resolve('/copyright')}>{m.footer_copyright()}</a></p>
	</section>

	<section class="stack">
		<h2>{m.terms_h_fair()}</h2>
		<p>{m.terms_p_fair()}</p>
	</section>

	<section class="stack">
		<h2>{m.terms_h_liability()}</h2>
		<p>{m.terms_p_liability()}</p>
		{#if data.contactEmail !== ''}
			<p class="muted">{m.terms_contact({ email: data.contactEmail })}</p>
		{/if}
	</section>
</div>

<style>
	.page {
		gap: var(--space-8);
	}
	.head {
		gap: var(--space-3);
	}
	section p {
		margin: 0;
	}
</style>
