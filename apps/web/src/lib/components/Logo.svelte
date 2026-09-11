<script lang="ts">
	/**
	 * The ぱちぱち mark (owner's pick, 2026-09-11): two keys, one after the other — a front key
	 * with ぱ, a back key one step down and to the right with ち — and two short "clack" strokes
	 * off the front key's corner. ぱ・ち is half the name; two keys is what typing is. One accent
	 * colour (the back key a deeper step of it), glyphs in the on-accent colour, so the same mark
	 * reads on light and dark backgrounds. `size` is the height in px; the wordmark is optional
	 * so the mark alone works as an icon. Glyph paths come from scripts/brand.mjs.
	 */
	import { LOGO_GLYPH_CHI, LOGO_GLYPH_PA } from '$lib/assets/logo-glyph';

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
		<rect x="2" y="14" width="30" height="30" rx="8" class="cap" />
		<path d={LOGO_GLYPH_PA} class="glyph" />
		<rect x="33" y="24" width="29" height="29" rx="8" class="plinth" />
		<path d={LOGO_GLYPH_CHI} class="glyph" />
		<g class="clack" stroke-width="2.6" stroke-linecap="round" fill="none">
			<path d="M36 12 L40 8" />
			<path d="M39 18 L45 17" />
		</g>
	</svg>
	{#if wordmark}
		<span class="word" lang="ja">ぱちぱち</span>
	{/if}
</span>

<style>
	.logo {
		display: inline-flex;
		align-items: center;
		gap: 0.45em;
		line-height: 1;
	}
	.mark {
		display: block;
		flex: none;
	}
	.cap {
		fill: var(--accent);
	}
	.plinth {
		fill: color-mix(in srgb, var(--accent) 72%, black);
	}
	.glyph {
		fill: var(--on-accent);
	}
	.clack {
		stroke: var(--accent);
		opacity: 0.9;
	}
	.word {
		font-weight: 700;
		letter-spacing: 0.02em;
		font-size: calc(var(--size) * 0.7);
	}
</style>
