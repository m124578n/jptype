<script lang="ts">
	/** Inline Lucide-style outline icons (stroke 1.75, 20px). Decorative by default. */
	let {
		name,
		size = 20
	}: {
		name:
			| 'keyboard'
			| 'volume'
			| 'volume-off'
			| 'text'
			| 'check'
			| 'speaker'
			| 'music'
			| 'film'
			| 'newspaper'
			| 'book'
			| 'clipboard'
			| 'pen'
			| 'sparkles'
			| 'target'
			| 'list-checks'
			| 'zap'
			| 'flame'
			| 'clock';
		size?: number;
	} = $props();
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
	{:else if name === 'music'}
		<path d="M9 18V5l12-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="18" cy="16" r="3" />
	{:else if name === 'film'}
		<rect x="2" y="4" width="20" height="16" rx="2" /><path
			d="M7 4v16M17 4v16M2 9h5M2 15h5M17 9h5M17 15h5"
		/>
	{:else if name === 'newspaper'}
		<path d="M4 4h13v16H5a2 2 0 0 1-2-2V6" /><path d="M17 8h3a1 1 0 0 1 1 1v9a2 2 0 0 1-2 2" /><path
			d="M7 8h6M7 12h6M7 16h4"
		/>
	{:else if name === 'book'}
		<path d="M4 5a2 2 0 0 1 2-2h13v18H6a2 2 0 0 1-2-2z" /><path d="M9 3v18" />
	{:else if name === 'clipboard'}
		<rect x="8" y="3" width="8" height="4" rx="1" /><path
			d="M16 5h2a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h2"
		/><path d="M9 13h6M9 17h4" />
	{:else if name === 'pen'}
		<path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" />
	{:else if name === 'sparkles'}
		<path d="M12 3l1.9 4.6L18.5 9.5 13.9 11.4 12 16l-1.9-4.6L5.5 9.5l4.6-1.9z" /><path
			d="M18 15l.9 2.1L21 18l-2.1.9L18 21l-.9-2.1L15 18l2.1-.9z"
		/>
	{:else if name === 'target'}
		<circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="5" /><circle
			cx="12"
			cy="12"
			r="1.5"
		/>
	{:else if name === 'list-checks'}
		<path d="M3 6l2 2 3-3M3 14l2 2 3-3M12 7h9M12 15h9" />
	{:else if name === 'zap'}
		<path d="M13 2 4 14h7l-1 8 9-12h-7z" />
	{:else if name === 'flame'}
		<path
			d="M12 22a7 7 0 0 0 7-7c0-4-3-6-4.5-9C13 3.5 12 2 12 2s-1 3-3 5.5S5 12 5 15a7 7 0 0 0 7 7z"
		/><path d="M12 22a3 3 0 0 0 3-3c0-1.8-1.5-2.6-2-3.8-.6 1.2-2 2-2 3.8a3 3 0 0 0 1 3z" />
	{:else if name === 'clock'}
		<circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" />
	{/if}
</svg>
