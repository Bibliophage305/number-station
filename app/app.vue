<script setup lang="ts">
	interface CharEntry {
		char: string;
		time: string; // ISO string, as received from the API
	}

	interface DisplayEntry {
		char: string;
		time: Date;
	}

	const WINDOW_MS = 60_000;

	// Anchors the display window. Starts at page-load time, so on first paint
	// only "now" survives the trim below - the strip fills in over the first
	// minute, then becomes a proper sliding 60s window from then on.
	const startTime = ref(new Date());

	// Keyed by timestamp (ms since epoch) so overlapping fetch windows - each
	// request returns the last 60s - overwrite rather than duplicate entries
	// for the same second.
	const charsByTime = new Map<number, DisplayEntry>();
	const charsToDisplay = ref<DisplayEntry[]>([]);

	const { data, refresh } = await useFetch<CharEntry[]>("/api/char");

	function ingest(entries: CharEntry[] | null) {
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

	ingest(data.value);

	const ROW_LENGTH = 10;
	const MAX_ROWS = Math.ceil(WINDOW_MS / 1000 / ROW_LENGTH); // 6 rows for a 60s window

	const rows = computed(() => {
		const out: DisplayEntry[][] = [];
		for (let i = 0; i < charsToDisplay.value.length; i += ROW_LENGTH) {
			out.push(charsToDisplay.value.slice(i, i + ROW_LENGTH));
		}
		// Pad with empty rows at the front so the block is always MAX_ROWS tall.
		// Real rows stay anchored to the bottom and fill upward as they accumulate,
		// rather than the whole block growing downward from the top.
		while (out.length < MAX_ROWS) {
			out.unshift([]);
		}
		return out;
	});

	const latestTime = computed(() => {
		const entries = charsToDisplay.value;
		return entries.length ? entries[entries.length - 1].time : null;
	});

	let timer: ReturnType<typeof setTimeout> | undefined;

	async function tick() {
		try {
			await refresh();
			ingest(data.value);
		} catch {
			// Stay on the last known chars rather than reveal anything via an error state.
		}
		// Re-align to the next whole second rather than drifting via a plain
		// 1000ms interval (fetch latency would otherwise slowly desync clients).
		const msIntoSecond = Date.now() % 1000;
		timer = setTimeout(tick, 1000 - msIntoSecond);
	}

	onMounted(tick);
	onUnmounted(() => timer && clearTimeout(timer));
</script>

<template>
	<div class="page">
		<div class="number-station">
			<div class="chars">
				<div
					class="char-row"
					v-for="(row, i) in rows"
					:key="i"
				>
					<span
						v-for="entry in row"
						:key="entry.time.getTime()"
						>{{ entry.char }}</span
					>
				</div>
			</div>
			<div
				class="timestamp"
				v-if="latestTime"
			>
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
		white-space: nowrap;
	}

	.timestamp {
		font-size: 1rem;
		letter-spacing: 0.1em;
		opacity: 0.6;
	}
</style>
