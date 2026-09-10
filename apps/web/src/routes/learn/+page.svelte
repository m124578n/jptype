<script lang="ts">
	import { onMount } from 'svelte';
	import { LESSON_GROUPS, findLesson } from '@jptype/data';
	import { m } from '$lib/paraglide/messages';
	import { resolve } from '$app/paths';
	import Icon from '$lib/components/Icon.svelte';
	import { loadResults, type LessonResults } from '$lib/storage';

	// localStorage is client-only; read it after mount so SSR and hydration agree.
	let results: LessonResults = $state({});
	onMount(() => {
		results = loadResults();
	});
</script>

<svelte:head><title>{m.learn_title()} · {m.app_name()}</title></svelte:head>

<div class="container container--wide stack map">
	<header class="stack intro">
		<h1>{m.learn_title()}</h1>
		<p class="muted">{m.learn_lead()}</p>
	</header>

	{#each LESSON_GROUPS as group (group.id)}
		<section class="stack group" aria-labelledby="g-{group.id}">
			<h2 id="g-{group.id}">{group.title}</h2>
			<ol class="lessons">
				{#each group.lessonIds as id (id)}
					{@const lesson = findLesson(id)}
					{@const r = results[id]}
					{#if lesson}
						<li>
							<a
								class="card lesson"
								href={resolve('/learn/[lessonId]', { lessonId: id })}
								class:done={!!r}
							>
								<span class="title" lang="ja">{lesson.title}</span>
								<span class="meta muted">
									{#if r}
										<Icon name="check" size={16} />
										{m.learn_best({ score: r.best.score })}
									{:else}
										{m.learn_lesson_count({ count: lesson.units.length })}
									{/if}
								</span>
							</a>
						</li>
					{/if}
				{/each}
			</ol>
		</section>
	{/each}
</div>

<style>
	.map {
		gap: var(--space-12);
	}
	.intro {
		gap: var(--space-2);
	}
	.group {
		gap: var(--space-4);
	}
	.lessons {
		list-style: none;
		margin: 0;
		padding: 0;
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
		gap: var(--space-3);
	}
	.lesson {
		display: flex;
		flex-direction: column;
		gap: var(--space-1);
		padding: var(--space-4);
		text-decoration: none;
		min-height: 88px;
		transition: border-color var(--dur-fast) var(--ease-out);
	}
	.lesson:hover {
		border-color: var(--fg-muted);
	}
	.lesson.done {
		border-color: var(--accent);
	}
	.title {
		font-size: 1.125rem;
		font-weight: 500;
	}
	.meta {
		display: inline-flex;
		align-items: center;
		gap: var(--space-1);
		font-size: 0.875rem;
		font-variant-numeric: tabular-nums;
	}
	.lesson.done .meta {
		color: var(--accent);
	}
</style>
