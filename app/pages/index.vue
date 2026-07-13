<script setup lang="ts">
interface CharEntry {
	char: string;
	time: string;
}

interface DisplayEntry {
	char: string;
	time: Date;
}

const chunk = <T,>(arr: T[], size: number): T[][] => {
	return Array.from({ length: Math.ceil(arr.length / size) }, (_, i) =>
		arr.slice(i * size, i * size + size)
	);
};

const WINDOW_MS = 70_000;
const NUMBER_OF_CHARS_TO_STORE = WINDOW_MS / 1000;
const NUMBER_OF_CHARS_TO_DISPLAY = NUMBER_OF_CHARS_TO_STORE - 10; // 10 extra to avoid trimming too aggressively
const ROW_LENGTH = 10;
const MAX_ROWS = Math.ceil(NUMBER_OF_CHARS_TO_DISPLAY / ROW_LENGTH); // 6 rows for a 60s window

const startTime = ref(new Date());

const charsByTime = new Map<number, DisplayEntry>();
const charsToDisplay = ref<DisplayEntry[]>([]);

const ingest = (entry: CharEntry | null) => {
	if (!entry) return;

	const time = new Date(entry.time);
	charsByTime.set(time.getTime(), { char: entry.char, time });

	const now = Date.now();
	if (now - startTime.value.getTime() > WINDOW_MS) {
		startTime.value = new Date(now - WINDOW_MS);
	}

	for (const key of charsByTime.keys()) {
		if (key < startTime.value.getTime()) charsByTime.delete(key);
	}

	charsToDisplay.value = [...charsByTime.values()].sort(
		(a, b) => a.time.getTime() - b.time.getTime(),
	);
}

let eventSource: EventSource | undefined;

const connect = () => {
	eventSource = new EventSource("/api/char-stream");
	eventSource.onmessage = (event) => {
		try {
			const entry: CharEntry = JSON.parse(event.data);
			ingest(entry);
		} catch {
			// Malformed payload - stay on the last known chars.
		}
	};
}

onMounted(connect);
onUnmounted(() => eventSource?.close());

const rows = computed(() => {
	const chars = charsToDisplay.value.map((entry) => entry.char);
	const paddedLength = Math.max(ROW_LENGTH, Math.ceil(chars.length / ROW_LENGTH) * ROW_LENGTH);
	chars.unshift(...Array(paddedLength - chars.length).fill(" "));

	return chunk(chars, ROW_LENGTH).slice(-MAX_ROWS);
});

const latestTime = computed(() => charsToDisplay.value.at(-1)?.time ?? null);

// null = no explicit choice yet; the CSS prefers-color-scheme media query
// handles that case with zero JS and zero flash. Once someone clicks the
// toggle, this becomes an explicit true/false and overrides it - and being
// a cookie (not localStorage), it's readable during SSR, so the correct
// class is present in the very first HTML sent down, not patched in after
// hydration.
const darkCookie = useCookie<boolean | null>("number-station-dark", {
	default: () => null,
	maxAge: 60 * 60 * 24 * 365,
});

// Only used to label the toggle button correctly ("switch to light/dark")
// once mounted. Not used for the actual background colour before a cookie
// exists - that's the media query's job, precisely so this can't cause a flash.
const systemPrefersDark = ref(false);

onMounted(() => {
	systemPrefersDark.value = window.matchMedia("(prefers-color-scheme: dark)").matches;
});

const isDark = computed(() => darkCookie.value ?? systemPrefersDark.value);

function toggleDark() {
	darkCookie.value = !isDark.value;
}
</script>

<template>
	<div class="page" :class="{ dark: darkCookie === true, light: darkCookie === false }">
		<button
			class="mode-toggle"
			type="button"
			:aria-pressed="isDark"
			@click="toggleDark"
		>
			{{ isDark ? "[ light mode ]" : "[ dark mode ]" }}
		</button>
		<div class="number-station">
			<div class="chars">
				<div class="char-row" v-for="(row, i) in rows" :key="i">
					<span v-for="(char, key) in row" :key="key">{{ char }}</span>
				</div>
			</div>
			<div class="timestamp" v-if="latestTime">
				{{ latestTime.toLocaleTimeString() }}
			</div>
		</div>
	</div>
</template>

<style scoped>
.page {
	--bg: #f4f4f0;
	--fg: #1a1a1a;

	min-height: 100vh;
	display: flex;
	align-items: center;
	justify-content: center;
	background-color: var(--bg);
	color: var(--fg);
	transition:
		background-color 0.2s ease,
		color 0.2s ease;
}

.page.dark {
	--bg: #05070a;
	--fg: #b6ffc2;
}

.page.light {
	--bg: #f4f4f0;
	--fg: #1a1a1a;
}

/* Only applies when no explicit cookie choice has been made yet
   (i.e. neither .dark nor .light is present) - this is what avoids
   a flash on first visit, since it's resolved by the browser at first
   paint rather than by JS after hydration. */
@media (prefers-color-scheme: dark) {
	.page:not(.dark):not(.light) {
		--bg: #05070a;
		--fg: #b6ffc2;
	}
}

.mode-toggle {
	position: fixed;
	top: 1.5rem;
	right: 1.5rem;
	font-family: monospace;
	font-size: 0.85rem;
	letter-spacing: 0.05em;
	color: var(--fg);
	background: none;
	border: none;
	cursor: pointer;
	opacity: 0.6;
}

.mode-toggle:hover {
	opacity: 1;
}

.number-station {
	display: flex;
	flex-direction: column;
	align-items: center;
	gap: 0.75rem;
	font-family: monospace;
}

.chars {
	display: flex;
	flex-direction: column;
	align-items: center;
}

.char-row {
	height: 3rem;
	font-size: 2.5rem;
	line-height: 1;
	letter-spacing: 0.15em;
	white-space: pre;
}

.timestamp {
	font-size: 1rem;
	letter-spacing: 0.1em;
	opacity: 0.6;
}
</style>