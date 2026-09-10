<script lang="ts">
	/** Inline Lucide-style outline icons (stroke 1.75, 20px). Decorative by default. */
	let {
		name,
		size = 20
	}: { name: 'keyboard' | 'volume' | 'volume-off' | 'text' | 'check' | 'speaker'; size?: number } =
		$props();
</script>

<svg
	width={size}
	height={size}
	viewBox="0 0 24 24"
	fill="none"
	stroke="currentColor"
	stroke-width="1.75"
	stroke-linecap="round"
	stroke-linejoin="round"
	aria-hidden="true"
>
	{#if name === 'keyboard'}
		<rect x="2" y="6" width="20" height="12" rx="2" /><path
			d="M6 10h.01M10 10h.01M14 10h.01M18 10h.01M8 14h8"
		/>
	{:else if name === 'volume'}
		<path d="M11 5 6 9H2v6h4l5 4V5z" /><path d="M15.5 8.5a5 5 0 0 1 0 7M19 5a9 9 0 0 1 0 14" />
	{:else if name === 'volume-off'}
		<path d="M11 5 6 9H2v6h4l5 4V5z" /><path d="m22 9-6 6M16 9l6 6" />
	{:else if name === 'text'}
		<path d="M4 7V5h16v2M9 5v14M15 5v14M7 19h4M13 19h4" />
	{:else if name === 'speaker'}
		<path d="M11 5 6 9H2v6h4l5 4V5z" /><path d="M15.5 8.5a5 5 0 0 1 0 7" />
	{:else if name === 'check'}
		<path d="m5 12 5 5L20 7" />
	{/if}
</svg>
