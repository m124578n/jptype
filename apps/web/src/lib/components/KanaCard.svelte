<script lang="ts">
	import type { KanaEntry } from '@jptype/data';

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
</script>

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

<style>
	.kana-card {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: var(--space-1);
		padding: var(--space-4) var(--space-3);
		min-width: 88px;
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
</style>
