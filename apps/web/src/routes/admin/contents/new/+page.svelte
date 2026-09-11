<script lang="ts">
	import { m } from '$lib/paraglide/messages';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import ContentMetaForm from '$lib/components/ContentMetaForm.svelte';
	import { createContent, type ContentInputBody } from '$lib/contents-api';

	let value = $state<ContentInputBody>({
		type: 'song',
		title: '',
		description: '',
		videoId: '',
		jlptLevel: 'unknown',
		difficulty: 'normal',
		sourceType: 'original',
		sourceUrl: '',
		sourceName: '',
		license: '',
		rightsStatus: 'unknown'
	});

	let busy = $state(false);
	let failure = $state('');

	async function create() {
		if (value.title.trim() === '') {
			failure = m.admin_contents_error_title();
			return;
		}
		busy = true;
		failure = '';
		const result = await createContent(value);
		busy = false;
		if (!result.ok) {
			failure = m.admin_contents_save_failed({ reason: result.error });
			return;
		}
		// Straight into the import step: a content without lines cannot be published anyway.
		await goto(resolve('/admin/contents/[id]', { id: result.body.id }));
	}
</script>

<svelte:head><title>{m.admin_contents_new()} · {m.seo_site_name()}</title></svelte:head>

<div class="container stack page">
	<header class="stack head">
		<a class="muted back" href={resolve('/admin/contents')}>← {m.admin_contents_title()}</a>
		<h1>{m.admin_contents_new()}</h1>
		<p class="muted">{m.admin_contents_new_lead()}</p>
	</header>

	<ContentMetaForm
		bind:value
		{busy}
		error={failure}
		submitLabel={m.admin_contents_create()}
		onsubmit={create}
	/>
</div>

<style>
	.page {
		gap: var(--space-8);
	}
	.head {
		gap: var(--space-2);
	}
	.back {
		text-decoration: none;
		font-size: 0.875rem;
	}
</style>
