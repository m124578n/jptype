<script lang="ts">
	/** QWERTY visual aid. `next` is filled; `highlight` keys get a soft outline. */
	let { next = '', highlight = [] as string[] }: { next?: string; highlight?: string[] } = $props();

	const ROWS: string[][] = [
		['1', '2', '3', '4', '5', '6', '7', '8', '9', '0', '-'],
		['q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p'],
		['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l', "'"],
		['z', 'x', 'c', 'v', 'b', 'n', 'm', ',', '.', '?']
	];
	const isHighlighted = (key: string) => highlight.includes(key);
</script>

<div class="kb" aria-hidden="true">
	{#each ROWS as row, r (r)}
		<div class="kb-row" style:--offset={r}>
			{#each row as key (key)}
				<span class="key" class:next={key === next} class:hl={isHighlighted(key)}>
					{key}
				</span>
			{/each}
		</div>
	{/each}
	<div class="kb-row">
		<span class="key space" class:next={next === ' '}></span>
	</div>
</div>

<style>
	.kb {
		display: flex;
		flex-direction: column;
		gap: 6px;
		padding: var(--space-3);
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: var(--radius-lg);
		user-select: none;
		width: 100%;
		max-width: 620px;
		margin-inline: auto;
	}
	.kb-row {
		display: flex;
		justify-content: center;
		gap: 6px;
		padding-left: calc(var(--offset, 0) * 14px);
	}
	.key {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: clamp(28px, 7.5vw, 44px);
		height: clamp(28px, 7.5vw, 44px);
		border-radius: var(--radius-sm);
		background: var(--key-bg);
		border: 1px solid var(--border);
		font-size: 0.875rem;
		font-weight: 500;
		text-transform: uppercase;
		transition:
			background-color var(--dur-fast) var(--ease-out),
			color var(--dur-fast) var(--ease-out),
			border-color var(--dur-fast) var(--ease-out);
	}
	.key.hl {
		border-color: var(--accent);
		background: var(--accent-soft);
	}
	.key.next {
		background: var(--accent);
		border-color: var(--accent);
		color: var(--on-accent);
	}
	.space {
		width: clamp(160px, 40vw, 280px);
	}
</style>
