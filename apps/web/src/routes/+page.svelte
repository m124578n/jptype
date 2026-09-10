<script lang="ts">
	import { m } from '$lib/paraglide/messages';
	import { resolve } from '$app/paths';
</script>

<section class="container hero stack">
	<h1>{m.home_tagline()}</h1>
	<p class="lead muted">{m.home_lead()}</p>
	<p><a class="btn btn--primary cta" href={resolve('/learn')}>{m.home_cta_start()}</a></p>
</section>

<section class="container benefits">
	<div>
		<h3>{m.home_benefit_1_title()}</h3>
		<p class="muted">{m.home_benefit_1_body()}</p>
	</div>
	<div>
		<h3>{m.home_benefit_2_title()}</h3>
		<p class="muted">{m.home_benefit_2_body()}</p>
	</div>
	<div>
		<h3>{m.home_benefit_3_title()}</h3>
		<p class="muted">{m.home_benefit_3_body()}</p>
	</div>
</section>

<style>
	.hero {
		text-align: center;
		gap: var(--space-6);
		padding-top: var(--space-12);
	}
	.lead {
		font-size: 1.125rem;
		max-width: 32em;
		margin-inline: auto;
	}
	.cta {
		min-height: 52px;
		padding-inline: var(--space-8);
		font-size: 1.125rem;
	}
	.benefits {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
		gap: var(--space-8);
		margin-top: var(--space-24);
	}
	.benefits h3 {
		margin-bottom: var(--space-2);
	}
</style>
