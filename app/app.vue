<script setup lang="ts">
useHead({
	htmlAttrs: { lang: "en" },
	titleTemplate: (title) => (title ? `${title} · Number Station` : "Number Station"),
	meta: [
		{ name: "viewport", content: "width=device-width, initial-scale=1" },
		{ name: "description", content: "A number station. Listen." },
		{ name: "theme-color", content: "#05070a" },
	],
	link: [{ rel: "icon", type: "image/svg+xml", href: "/favicon.ico" }],
});
</script>

<template>
	<div>
		<NuxtPage />
	</div>
</template>

<style>
body {
	margin: 0;
}
</style>