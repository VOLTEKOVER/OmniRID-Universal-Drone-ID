<script setup lang="ts">
const base = 'https://VOLTEKOVER.github.io/OmniRID-Universal-Drone-ID'
</script>

<template>
  <div class="flex flex-col gap-4">
    <div>
      <h1 class="text-xl font-bold">Guida</h1>
      <p class="text-sm text-muted">Documentazione tecnica del progetto (docs GitHub Pages)</p>
    </div>
    <UCard :ui="{ body: { padding: 'p-0' } }">
      <div class="h-[70vh]">
        <iframe
          :src="`${base}/guide.html`"
          class="w-full h-full border-0 rounded-lg"
          title="OmniRID Guide"
          loading="lazy"
        />
      </div>
    </UCard>
  </div>
</template>