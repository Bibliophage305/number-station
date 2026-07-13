<script setup lang="ts">
interface CharEntry {
	char: string;
	time: string; // ISO string, as received from the API
}

interface DisplayEntry {
	char: string;
	time: Date;
}

const WINDOW_MS = 70_000;
const NUMBER_OF_CHARS_TO_STORE = WINDOW_MS / 1000;
const NUMBER_OF_CHARS_TO_DISPLAY = NUMBER_OF_CHARS_TO_STORE - 10; // 10 extra to avoid trimming too aggressively
const ROW_LENGTH = 10;
const MAX_ROWS = Math.ceil(NUMBER_OF_CHARS_TO_DISPLAY / ROW_LENGTH); // 6 rows for a 60s window

// Anchors the display window. Starts at page-load time, so on first paint
// only "now" survives the trim below - the strip fills in over the first
// minute, then becomes a proper sliding 60s window from then on.
const startTime = ref(new Date());

// Keyed by timestamp (ms since epoch) so overlapping fetch windows - each
// request returns the last 60s - overwrite rather than duplicate entries
// for the same second.
const charsByTime = new Map<number, DisplayEntry>();
const charsToDisplay = ref<DisplayEntry[]>([]);

const ingest = (entries: CharEntry[] | null) => {
	if (!entries) return;

	for (const entry of entries) {
		const time = new Date(entry.time);
		charsByTime.set(time.getTime(), { char: entry.char, time });
	}

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
			ingest([entry]);
		} catch {
			// Malformed payload - stay on the last known chars.
		}
	};
	// EventSource retries automatically on drops; nothing to do in onerror
	// beyond letting the browser handle reconnection.
}

onMounted(connect);
onUnmounted(() => eventSource?.close());

const rows = computed(() => {
	const chars: string[] = [];

	for (const entry of charsToDisplay.value) {
		chars.push(entry.char);
	}

	if (chars.length === 0) chars.unshift(" ");

	while (chars.length % ROW_LENGTH !== 0) {
		chars.unshift(" ");
	}

	const rowsToReturn: string[][] = [];
	for (let i = 0; i < chars.length; i += ROW_LENGTH) {
		rowsToReturn.push(chars.slice(i, i + ROW_LENGTH));
	}

	while (rowsToReturn.length > MAX_ROWS) {
		rowsToReturn.shift();
	}

	return rowsToReturn;
});

const latestTime = computed(() => {
	const entries = charsToDisplay.value;
	return entries.length ? entries[entries.length - 1].time : null;
});
</script>

<template>
	<div class="page">
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
	min-height: 100vh;
	display: flex;
	align-items: center;
	justify-content: center;
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