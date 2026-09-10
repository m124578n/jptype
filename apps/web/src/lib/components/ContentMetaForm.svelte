<script lang="ts">
	import { m } from '$lib/paraglide/messages';
	import { CONTENT_TYPES, DIFFICULTIES, JLPT_LEVELS, SOURCE_TYPES } from '$lib/contents';
	import { difficultyLabel, jlptLabel, typeLabel } from '$lib/contents-labels';
	import type { ContentInputBody } from '$lib/contents-api';

	let {
		value = $bindable(),
		submitLabel,
		busy = false,
		error = '',
		note = '',
		onsubmit
	}: {
		/** The whole metadata body; the pages own it so they can send exactly what changed. */
		value: ContentInputBody;
		submitLabel: string;
		busy?: boolean;
		error?: string;
		note?: string;
		onsubmit: () => void;
	} = $props();

	const sourceTypeLabel: Record<(typeof SOURCE_TYPES)[number], () => string> = {
		original: m.admin_contents_source_original,
		licensed: m.admin_contents_source_licensed,
		public_domain: m.admin_contents_source_public_domain,
		user_provided: m.admin_contents_source_user_provided,
		other: m.admin_contents_source_other
	};

	function submit(event: SubmitEvent) {
		event.preventDefault();
		onsubmit();
	}
</script>

<form class="stack form" onsubmit={submit}>
	<div class="stack field">
		<label for="content-title">{m.admin_contents_field_title()}</label>
		<input id="content-title" type="text" bind:value={value.title} required maxlength="120" />
	</div>

	<div class="row pair">
		<div class="stack field">
			<label for="content-type">{m.admin_contents_field_type()}</label>
			<select id="content-type" bind:value={value.type}>
				{#each CONTENT_TYPES as type (type)}
					<option value={type}>{typeLabel[type]()}</option>
				{/each}
			</select>
		</div>
		<div class="stack field">
			<label for="content-video">{m.admin_contents_field_video()}</label>
			<input
				id="content-video"
				type="text"
				bind:value={value.videoId}
				placeholder={m.admin_contents_field_video_placeholder()}
			/>
		</div>
	</div>

	<div class="stack field">
		<label for="content-description">{m.admin_contents_field_description()}</label>
		<textarea id="content-description" rows="3" bind:value={value.description}></textarea>
	</div>

	<div class="row pair">
		<div class="stack field">
			<label for="content-jlpt">{m.admin_contents_field_jlpt()}</label>
			<select id="content-jlpt" bind:value={value.jlptLevel}>
				{#each JLPT_LEVELS as level (level)}
					<option value={level}>{jlptLabel[level]()}</option>
				{/each}
			</select>
		</div>
		<div class="stack field">
			<label for="content-difficulty">{m.admin_contents_field_difficulty()}</label>
			<select id="content-difficulty" bind:value={value.difficulty}>
				{#each DIFFICULTIES as level (level)}
					<option value={level}>{difficultyLabel[level]()}</option>
				{/each}
			</select>
		</div>
	</div>

	<fieldset class="stack rights">
		<legend>{m.admin_contents_rights_title()}</legend>
		<p class="muted small">{m.admin_contents_rights_rule()}</p>
		<div class="row pair">
			<div class="stack field">
				<label for="content-source-type">{m.admin_contents_field_source_type()}</label>
				<select id="content-source-type" bind:value={value.sourceType}>
					{#each SOURCE_TYPES as type (type)}
						<option value={type}>{sourceTypeLabel[type]()}</option>
					{/each}
				</select>
			</div>
			<div class="stack field">
				<label for="content-source-name">{m.admin_contents_field_source_name()}</label>
				<input id="content-source-name" type="text" bind:value={value.sourceName} />
			</div>
		</div>
		<div class="row pair">
			<div class="stack field">
				<label for="content-source-url">{m.admin_contents_field_source_url()}</label>
				<input id="content-source-url" type="url" bind:value={value.sourceUrl} />
			</div>
			<div class="stack field">
				<label for="content-license">{m.admin_contents_field_license()}</label>
				<input id="content-license" type="text" bind:value={value.license} />
			</div>
		</div>
		<div class="stack field">
			<label for="content-rights">{m.admin_contents_field_rights()}</label>
			<select id="content-rights" bind:value={value.rightsStatus}>
				<option value="unknown">{m.admin_contents_rights_unknown()}</option>
				<option value="cleared">{m.admin_contents_rights_cleared()}</option>
			</select>
		</div>
	</fieldset>

	<div class="row actions">
		<button type="submit" class="btn btn--primary" disabled={busy}>{submitLabel}</button>
		<span class="muted small" aria-live="polite">
			{#if error !== ''}<span class="error">{error}</span>{:else}{note}{/if}
		</span>
	</div>
</form>

<style>
	.form {
		gap: var(--space-4);
	}
	.field {
		gap: var(--space-2);
		flex: 1;
		min-width: 12rem;
	}
	.pair {
		gap: var(--space-4);
		align-items: flex-start;
	}
	label,
	legend {
		font-size: 0.875rem;
		color: var(--fg-muted);
	}
	input,
	select,
	textarea {
		font: inherit;
		color: var(--fg);
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: var(--radius);
		padding: var(--space-2) var(--space-3);
		min-height: 44px;
		width: 100%;
	}
	textarea {
		min-height: 5rem;
		resize: vertical;
	}
	.rights {
		gap: var(--space-4);
		border: 1px solid var(--border);
		border-radius: var(--radius-lg);
		padding: var(--space-4);
	}
	.rights p {
		margin: 0;
	}
	.small {
		font-size: 0.875rem;
	}
	.error {
		color: var(--danger);
	}
	.actions {
		gap: var(--space-3);
	}
</style>
