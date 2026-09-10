<script lang="ts">
	import { lessonMode } from '@jptype/data';
	import { m } from '$lib/paraglide/messages';
	import LessonFlow from '$lib/components/LessonFlow.svelte';

	let { data } = $props();
	const lesson = $derived(data.lesson);
</script>

<svelte:head><title>{lesson.title} · {m.app_name()}</title></svelte:head>

<LessonFlow
	{lesson}
	mode={lessonMode(lesson.id)}
	katakana={lesson.id.startsWith('kata')}
	loggedIn={!!data.user}
	turnstileSiteKey={data.turnstileSiteKey}
/>
