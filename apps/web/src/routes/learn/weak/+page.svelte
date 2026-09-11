<script lang="ts">
	import { onMount } from 'svelte';
	import { findKana, TIMED_POOLS, WEAK_MODE, type Lesson } from '@jptype/data';
	import { m } from '$lib/paraglide/messages';
	import { resolve } from '$app/paths';
	import LessonFlow from '$lib/components/LessonFlow.svelte';
	import { weakPracticePool } from '$lib/practice/questions';
	import { loadKanaStats, weakKana } from '$lib/storage';

	let { data } = $props();

	// Server list for logged-in users; localStorage otherwise. Resolved after mount so SSR
	// and hydration agree (localStorage is client-only).
	let weak = $state<string[] | null>(null);
	onMount(() => {
		weak = data.weak ?? weakKana(loadKanaStats());
	});

	const lesson = $derived.by((): Lesson | null => {
		if (weak === null) return null;
		const pool = weakPracticePool(weak, TIMED_POOLS.all);
		return {
			id: WEAK_MODE,
			title: m.me_mode_weak(),
			mode: 'kana',
			units: pool,
			intro: weak.map((k) => findKana(k)).filter((e) => e !== undefined)
		};
	});
</script>

<svelte:head><title>{m.me_mode_weak()} · {m.seo_site_name()}</title></svelte:head>

{#if lesson}
	{#if weak && weak.length === 0}
		<div class="container stack">
			<h1>{m.me_mode_weak()}</h1>
			<p class="muted">{m.me_weak_none()}</p>
			<p><a class="btn" href={resolve('/learn')}>{m.lesson_back_to_map()}</a></p>
		</div>
	{:else}
		<LessonFlow
			{lesson}
			mode={WEAK_MODE}
			loggedIn={!!data.user}
			turnstileSiteKey={data.turnstileSiteKey}
			lead={m.weak_lead({ count: weak?.length ?? 0 })}
		/>
	{/if}
{/if}
