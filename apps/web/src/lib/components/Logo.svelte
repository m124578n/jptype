<script lang="ts">
	/**
	 * The jptype mark: a keycap with あ on it — the first kana you learn, on the key you press.
	 * One accent colour, one glyph, nothing else (MASTER.md「Quiet minimalism」). `size` is the
	 * height in px; the wordmark is optional so the same mark works as an icon.
	 */
	let { size = 28, wordmark = true }: { size?: number; wordmark?: boolean } = $props();
</script>

<span class="logo" style:--size="{size}px">
	<svg
		class="mark"
		viewBox="0 0 64 64"
		width={size}
		height={size}
		aria-hidden="true"
		focusable="false"
	>
		<rect x="4" y="4" width="56" height="56" rx="14" fill="var(--accent)" />
		<rect x="10" y="9" width="44" height="6" rx="3" fill="var(--on-accent)" opacity="0.28" />
		<text
			x="32"
			y="46"
			text-anchor="middle"
			font-family="'Noto Sans JP', system-ui, sans-serif"
			font-size="34"
			font-weight="700"
			fill="var(--on-accent)">あ</text
		>
	</svg>
	{#if wordmark}
		<span class="word">jptype</span>
	{/if}
</span>

<style>
	.logo {
		display: inline-flex;
		align-items: center;
		gap: 0.5em;
		line-height: 1;
	}
	.mark {
		display: block;
		flex: none;
	}
	.word {
		font-weight: 700;
		letter-spacing: -0.01em;
		font-size: calc(var(--size) * 0.72);
	}
</style>
