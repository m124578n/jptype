<script lang="ts">
	import { m } from '$lib/paraglide/messages';
	import { page } from '$app/state';
	import { resolve } from '$app/paths';
	import { fileReport } from '$lib/songs-api';
	import { parseYoutubeId } from '$lib/songs';

	let { data } = $props();

	/** The 檢舉 link next to a public song arrives as ?song=<id>. */
	const prefill = $derived(page.url.searchParams.get('song') ?? '');

	let contact = $state('');
	let target = $state('');
	let claim = $state('');
	let sending = $state(false);
	let sent = $state(false);
	let error = $state('');
	let prefilled = $state(false);

	// Fill the song field once, from the query string, without fighting later edits.
	$effect(() => {
		if (prefilled || prefill === '') return;
		prefilled = true;
		target = `${page.url.origin}/library/${prefill}`;
	});

	/** A song page URL identifies the row; anything else is treated as a YouTube link. */
	function splitTarget(input: string): { contentId?: string; videoId?: string } {
		const text = input.trim();
		const songMatch = /\/library\/([A-Za-z0-9_-]+)/.exec(text);
		if (songMatch?.[1]) return { contentId: songMatch[1] };
		const videoId = parseYoutubeId(text);
		return videoId === null ? {} : { videoId };
	}

	async function submit(event: SubmitEvent) {
		event.preventDefault();
		error = '';
		const where = splitTarget(target);
		if (contact.trim() === '' || claim.trim() === '' || (!where.contentId && !where.videoId)) {
			error = m.copyright_error_fields();
			return;
		}
		sending = true;
		const ok = await fileReport({
			contentId: where.contentId ?? null,
			videoId: where.videoId ?? '',
			reporterContact: contact.trim(),
			claim: claim.trim()
		});
		sending = false;
		if (!ok) {
			error = m.copyright_error({ email: data.contactEmail });
			return;
		}
		sent = true;
		contact = '';
		target = '';
		claim = '';
	}
</script>

<svelte:head><title>{m.copyright_title()} · {m.app_name()}</title></svelte:head>

<div class="container stack page">
	<header class="stack head">
		<h1>{m.copyright_title()}</h1>
		<p class="muted">{m.copyright_lead()}</p>
	</header>

	<section class="stack">
		<h2>{m.copyright_h_content()}</h2>
		<p>{m.copyright_p_content()}</p>
		<p>{m.copyright_p_no_curation()}</p>
	</section>

	<section class="stack">
		<h2>{m.copyright_h_notice()}</h2>
		<p>{m.copyright_p_notice({ email: data.contactEmail })}</p>
		<p>{m.copyright_p_process()}</p>
	</section>

	<section class="stack">
		<h2>{m.copyright_h_strikes()}</h2>
		<p>{m.copyright_p_strikes()}</p>
		<p class="muted"><a href={resolve('/terms')}>{m.footer_terms()}</a></p>
	</section>

	<section class="stack">
		<h2>{m.copyright_h_form()}</h2>
		<p class="muted">{m.copyright_form_lead()}</p>
		<form class="stack form" onsubmit={submit}>
			<div class="stack field">
				<label for="report-contact">{m.copyright_field_contact()}</label>
				<input id="report-contact" type="text" bind:value={contact} autocomplete="email" />
				<p class="muted small">{m.copyright_field_contact_hint()}</p>
			</div>

			<div class="stack field">
				<label for="report-song">{m.copyright_field_song()}</label>
				<input id="report-song" type="text" bind:value={target} autocomplete="off" />
				<p class="muted small">{m.copyright_field_song_hint()}</p>
			</div>

			<div class="stack field">
				<label for="report-claim">{m.copyright_field_claim()}</label>
				<textarea id="report-claim" rows="6" bind:value={claim}></textarea>
				<p class="muted small">{m.copyright_field_claim_hint()}</p>
			</div>

			{#if error !== ''}
				<p class="error" role="alert">{error}</p>
			{/if}
			{#if sent}
				<p class="ok" role="status">{m.copyright_sent()}</p>
			{/if}

			<p>
				<button type="submit" class="btn btn--primary" disabled={sending}>
					{sending ? m.copyright_sending() : m.copyright_submit()}
				</button>
			</p>
		</form>
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
	.small {
		font-size: 0.875rem;
	}
	.form {
		gap: var(--space-6);
	}
	.field {
		gap: var(--space-2);
	}
	label {
		font-weight: 500;
	}
	input,
	textarea {
		font: inherit;
		color: var(--fg);
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: var(--radius);
		padding: var(--space-3) var(--space-4);
		width: 100%;
	}
	input {
		min-height: 44px;
	}
	textarea {
		resize: vertical;
	}
	.error {
		color: var(--danger);
	}
	.ok {
		color: var(--accent);
	}
</style>
