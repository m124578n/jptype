<script lang="ts">
	import { KANA, toHiragana, type KanaEntry } from '@jptype/data';
	import { m } from '$lib/paraglide/messages';

	/** Per-unit stats keyed by the unit as typed (hiragana or katakana, may include っ prefix). */
	let { stats }: { stats: Record<string, { attempts: number; errors: number }> } = $props();

	// Fold katakana and sokuon-merged units onto their base hiragana entry.
	const folded = $derived.by(() => {
		const out: Record<string, { attempts: number; errors: number }> = {};
		for (const [unit, s] of Object.entries(stats)) {
			const base = toHiragana(unit).replace(/^っ(?=.)/, '');
			const cur = out[base] ?? { attempts: 0, errors: 0 };
			cur.attempts += s.attempts;
			cur.errors += s.errors;
			out[base] = cur;
		}
		return out;
	});

	const VOWEL_COL: Record<string, number> = { a: 0, i: 1, u: 2, e: 3, o: 4 };
	function col(entry: KanaEntry): number {
		const r = entry.romaji[0] ?? '';
		return VOWEL_COL[r.charAt(r.length - 1)] ?? 0;
	}

	interface Section {
		title: string;
		cols: number;
		rows: (KanaEntry | null)[][];
	}

	function rowsFor(
		entries: KanaEntry[],
		cols: number,
		placeByVowel: boolean
	): (KanaEntry | null)[][] {
		const byRow: Record<string, KanaEntry[]> = {};
		for (const e of entries) byRow[e.row] = [...(byRow[e.row] ?? []), e];
		return Object.values(byRow).map((row) => {
			const cells: (KanaEntry | null)[] = Array.from({ length: cols }, () => null);
			row.forEach((e, i) => {
				cells[placeByVowel ? col(e) : i] = e;
			});
			return cells;
		});
	}

	const sections: Section[] = [
		{
			title: m.me_heat_seion(),
			cols: 5,
			rows: rowsFor(
				KANA.filter((e) => e.group === 'seion'),
				5,
				true
			)
		},
		{
			title: m.me_heat_dakuon(),
			cols: 5,
			rows: rowsFor(
				KANA.filter((e) => e.group === 'dakuon' || e.group === 'handakuon'),
				5,
				true
			)
		},
		{
			title: m.me_heat_youon(),
			cols: 3,
			rows: rowsFor(
				KANA.filter((e) => e.group === 'youon'),
				3,
				false
			)
		}
	];

	function style(entry: KanaEntry): string {
		const s = folded[entry.kana];
		if (!s || s.attempts === 0) return '';
		const rate = s.errors / s.attempts;
		// 0 → soft accent, 1 → soft danger; opacity grows with confidence (attempts).
		const alpha = Math.min(1, 0.35 + s.attempts / 20);
		return `--heat: color-mix(in oklab, var(--danger-soft) ${Math.round(rate * 100)}%, var(--accent-soft)); --heat-alpha: ${alpha};`;
	}

	function title(entry: KanaEntry): string {
		const s = folded[entry.kana];
		if (!s || s.attempts === 0) return m.me_heat_none();
		return m.me_heat_cell({ attempts: s.attempts, errors: s.errors });
	}
</script>

<div class="heat stack">
	{#each sections as sec (sec.title)}
		<section>
			<h3 class="muted">{sec.title}</h3>
			<div class="grid" style:--cols={sec.cols} lang="ja">
				{#each sec.rows as row, r (r)}
					{#each row as cell, c (c)}
						{#if cell}
							<span
								class="cell"
								class:seen={cell.kana in folded}
								style={style(cell)}
								title={title(cell)}>{cell.kana}</span
							>
						{:else}
							<span class="cell empty" aria-hidden="true"></span>
						{/if}
					{/each}
				{/each}
			</div>
		</section>
	{/each}
	<p class="legend muted">
		<span class="swatch good"></span>{m.me_heat_legend_good()}
		<span class="swatch bad"></span>{m.me_heat_legend_bad()}
	</p>
</div>

<style>
	.heat {
		gap: var(--space-6);
	}
	h3 {
		font-size: 0.875rem;
		font-weight: 500;
		margin-bottom: var(--space-2);
	}
	.grid {
		display: grid;
		grid-template-columns: repeat(var(--cols), 2.4rem);
		gap: 4px;
	}
	.cell {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		height: 2.4rem;
		border-radius: var(--radius-sm);
		background: var(--surface);
		border: 1px solid var(--border);
		font-size: 1.125rem;
		position: relative;
	}
	.cell.seen {
		background: var(--heat);
		border-color: transparent;
		opacity: var(--heat-alpha, 1);
	}
	.cell.empty {
		border-color: transparent;
		background: transparent;
	}
	.legend {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		font-size: 0.875rem;
	}
	.swatch {
		display: inline-block;
		width: 1rem;
		height: 1rem;
		border-radius: 3px;
	}
	.swatch.good {
		background: var(--accent-soft);
	}
	.swatch.bad {
		background: var(--danger-soft);
		margin-left: var(--space-3);
	}
</style>
