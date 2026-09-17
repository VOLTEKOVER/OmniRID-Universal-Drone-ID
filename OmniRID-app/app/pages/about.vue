<script setup lang="ts">
const pkg = useRuntimeConfig().app
</script>

<template>
  <div class="max-w-2xl flex flex-col gap-4">
    <div>
      <h1 class="text-xl font-bold">Info</h1>
      <p class="text-sm text-muted">OmniRID App — Ground Station Open DroneID (PWA)</p>
    </div>

    <UCard>
      <div class="flex items-center gap-3 mb-4">
        <img :src="`${useRuntimeConfig().app.baseURL}icons/logo.svg`" alt="OmniRID" class="w-12 h-12">
        <div>
          <div class="text-lg font-bold">OmniRID <span class="text-primary-500">App</span></div>
          <div class="text-xs text-muted">v1.0.0 · Nuxt 3 + Nuxt UI + Pinia + Vite PWA</div>
        </div>
      </div>

      <div class="flex flex-col gap-2 text-sm text-muted">
        <p>Decodifica OpenDroneID ASTM F3411-22a per trasmettitori ESP32 (firmware Rust).</p>
        <ul class="list-disc pl-5 flex flex-col gap-1">
          <li>Decoder puri JS — Basic ID, Location/Vector, System, Operator, Self-ID, Auth</li>
          <li>Cattura: Web Bluetooth, Web Serial, import PCAP (monitor mode offline)</li>
          <li>Mappa SVG con trail GPS dei droni</li>
          <li>Export CSV / KML / JSON del report sessione</li>
          <li>Installabile e 100% offline (Service Worker)</li>
        </ul>
      </div>

      <UDivider class="my-4" />

      <div class="flex flex-col gap-2">
        <NuxtLink
          to="/guide"
          class="flex items-center gap-2 text-sm text-primary-500 hover:underline"
        >
          <UIcon name="i-tabler-book" class="w-4 h-4" /> Guida completa
        </NuxtLink>
        <a
          href="https://github.com/VOLTEKOVER/OmniRID-Universal-Drone-ID"
          target="_blank"
          rel="noopener"
          class="flex items-center gap-2 text-sm text-primary-500 hover:underline"
        >
          <UIcon name="i-tabler-brand-github" class="w-4 h-4" /> Repository GitHub ↗
        </a>
        <p class="text-xs text-muted mt-2">Licenza Apache 2.0 · Progetto educativo/ricerca.</p>
      </div>
    </UCard>
  </div>
</template>