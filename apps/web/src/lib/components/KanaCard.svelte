<script lang="ts">
	import { onMount } from 'svelte';
	import type { KanaEntry } from '@jptype/data';
	import { m } from '$lib/paraglide/messages';
	import Icon from '$lib/components/Icon.svelte';
	import { speak, speechAvailable } from '$lib/speech';

	let {
		entry,
		katakana = false,
		selected = false,
		onselect
	}: {
		entry: KanaEntry;
		katakana?: boolean;
		selected?: boolean;
		onselect?: (entry: KanaEntry) => void;
	} = $props();

	const primary = $derived(katakana ? entry.kata : entry.kana);
	const secondary = $derived(katakana ? entry.kana : entry.kata);

	// Browser TTS only: no audio assets, no Worker calls. Hidden where unsupported.
	// Resolved on mount, not in a $derived: the server render must match the first client render.
	let canSpeak = $state(false);
	onMount(() => {
		canSpeak = speechAvailable();
	});

	function play(e: MouseEvent) {
		// The card itself is a button; never let the play click select the card.
		e.stopPropagation();
		void speak(entry.kana);
	}
</script>

<div class="kana-card-slot">
	<button
		type="button"
		class="card kana-card"
		class:selected
		aria-pressed={selected}
		onclick={() => onselect?.(entry)}
		onfocus={() => onselect?.(entry)}
	>
		<span class="kana" lang="ja">{primary}</span>
		<span class="romaji">{entry.romaji[0]}</span>
		<span class="alt muted" lang="ja">{secondary}</span>
	</button>
	{#if canSpeak}
		<button
			type="button"
			class="play"
			aria-label={m.card_play()}
			title={m.card_play()}
			onclick={play}
		>
			<Icon name="speaker" size={16} />
		</button>
	{/if}
</div>

<style>
	.kana-card-slot {
		position: relative;
		display: flex;
	}
	.kana-card {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: var(--space-1);
		padding: var(--space-4) var(--space-3);
		min-width: 88px;
		flex: 1;
		cursor: pointer;
		transition:
			border-color var(--dur-fast) var(--ease-out),
			background-color var(--dur-fast) var(--ease-out);
	}
	.kana-card:hover {
		border-color: var(--fg-muted);
	}
	.kana-card.selected {
		border-color: var(--accent);
		background: var(--accent-soft);
	}
	.kana {
		font-size: 2.5rem;
		font-weight: 500;
		line-height: 1.1;
	}
	.romaji {
		font-size: 1rem;
		letter-spacing: 0.08em;
		font-variant-numeric: tabular-nums;
	}
	.alt {
		font-size: 0.875rem;
	}
	.play {
		position: absolute;
		top: var(--space-1);
		right: var(--space-1);
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 32px;
		height: 32px;
		padding: 0;
		border: 0;
		border-radius: var(--radius-sm);
		background: transparent;
		color: var(--fg-muted);
		cursor: pointer;
		transition: color var(--dur-fast) var(--ease-out);
	}
	.play:hover {
		color: var(--accent);
	}
</style>
