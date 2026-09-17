<script lang="ts">
	import type { Snippet } from 'svelte';

	/**
	 * Keyboard input for a practice run, wrapped around the typing area.
	 *
	 * Desktop: printable keydowns on the window are enough, no focus needed. Touch devices
	 * need a focused text field before the on-screen keyboard shows, so a visually hidden
	 * <input> lives inside the wrapper; tapping the typing area (or the page calling `focus()`
	 * from a start button) focuses it. While it has focus every keyboard goes through the
	 * input's value instead of keydown — Android keyboards report `key: "Unidentified"` and
	 * compose whole words (Gboard), so the value is diffed against what was already handed
	 * out and cleared once composition ends.
	 */
	let {
		active,
		onkey,
		onspecial,
		children
	}: {
		/** When false nothing is captured (result screens, dialogs). */
		active: boolean;
		/** One printable character. */
		onkey: (key: string, now: number) => void;
		/**
		 * First look at every keydown that did not come from another form field, for page
		 * shortcuts (Escape, Tab, space-to-start…). Return true when the event was handled.
		 */
		onspecial?: (e: KeyboardEvent) => boolean;
		children?: Snippet;
	} = $props();

	let input = $state<HTMLInputElement | null>(null);
	let focused = $state(false);
	let prev = '';
	let composing = false;

	export function focus(): void {
		input?.focus({ preventScroll: true });
	}

	function isOtherField(t: EventTarget | null): boolean {
		const el = t as HTMLElement | null;
		if (!el || el === input) return false;
		return el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable;
	}

	function onkeydown(e: KeyboardEvent) {
		if (isOtherField(e.target)) return;
		if (onspecial?.(e)) return;
		if (!active) return;
		if (e.ctrlKey || e.metaKey || e.altKey) return;
		if (e.key.length !== 1) return;
		// Focused input: the character arrives through `oninput` (one path, never both).
		if (e.target === input) return;
		e.preventDefault();
		onkey(e.key, performance.now());
	}

	function oninput(e: Event) {
		const el = e.currentTarget as HTMLInputElement;
		const val = el.value;
		if (active && val.startsWith(prev) && val.length > prev.length) {
			const now = performance.now();
			for (const ch of val.slice(prev.length)) onkey(ch, now);
		}
		if (composing) {
			prev = val;
		} else {
			el.value = '';
			prev = '';
		}
	}

	function oncompositionend(e: CompositionEvent) {
		composing = false;
		(e.currentTarget as HTMLInputElement).value = '';
		prev = '';
	}

	// A run that just started wants the keyboard; on iOS this only opens it when the call
	// is still inside the tap that started the run, hence `focus()` is also exported.
	$effect(() => {
		if (active) focus();
	});
</script>

<svelte:window {onkeydown} />

<!-- The wrapper is a tap target for the on-screen keyboard only; the keyboard itself is the
     "key event", so there is nothing extra to bind. -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<!-- svelte-ignore a11y_click_events_have_key_events -->
<div class="capture" class:focused onclick={focus}>
	{@render children?.()}
	<input
		bind:this={input}
		class="sink"
		type="text"
		autocomplete="off"
		autocapitalize="none"
		autocorrect="off"
		spellcheck="false"
		lang="en"
		enterkeyhint="done"
		aria-hidden="true"
		tabindex="-1"
		{oninput}
		oncompositionstart={() => (composing = true)}
		{oncompositionend}
		onfocus={() => (focused = true)}
		onblur={() => (focused = false)}
	/>
</div>

<style>
	.capture {
		position: relative;
	}
	/* Real but invisible: `display: none` / `visibility: hidden` cannot take focus.
	   16px keeps iOS from zooming in when it gains focus. */
	.sink {
		position: absolute;
		inset-block-end: 0;
		inset-inline-start: 0;
		width: 1px;
		height: 1px;
		padding: 0;
		border: 0;
		opacity: 0;
		font-size: 16px;
		pointer-events: none;
	}
</style>
