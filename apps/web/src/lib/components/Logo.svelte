<script lang="ts">
	/**
	 * The ぱちぱち mark (owner 2026-09-11): a keycap with ぱ on it and three short "clack" strokes
	 * off its top-right corner — the sound of keys, the sound of applause. One accent colour on
	 * a two-tone key (the darker plinth gives it a press), the glyph and strokes in the on-accent
	 * colour so the same mark reads on light and dark backgrounds. `size` is the height in px;
	 * the wordmark is optional so the mark alone works as an icon.
	 */
	import { LOGO_GLYPH_PA } from '$lib/assets/logo-glyph';

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
		<!-- plinth: the key's side, 4px deeper than the cap -->
		<rect x="4" y="10" width="56" height="52" rx="14" class="plinth" />
		<!-- cap -->
		<rect x="4" y="4" width="56" height="52" rx="14" class="cap" />
		<!-- ぱ as a path (scripts/brand.mjs, Noto Sans CJK JP Bold), sitting a little left so the clacks have room -->
		<path d={LOGO_GLYPH_PA} class="glyph" />
		<!-- ぱち、ぱち: three clack strokes -->
		<g class="clack" stroke-width="3.2" stroke-linecap="round" fill="none">
			<path d="M47 20 L52 15" />
			<path d="M50 27 L57 25" />
			<path d="M43 15 L43 8" />
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
	.plinth {
		fill: color-mix(in srgb, var(--accent) 72%, black);
	}
	.cap {
		fill: var(--accent);
	}
	.glyph {
		fill: var(--on-accent);
	}
	.clack {
		stroke: var(--on-accent);
		opacity: 0.92;
	}
	.word {
		font-weight: 700;
		letter-spacing: 0.02em;
		font-size: calc(var(--size) * 0.7);
	}
</style>
