<script setup lang="ts">
import { appName, appTagline } from '~/config/app'

const heroBadges: { label: string, color: 'success' | 'warning' | 'neutral' }[] = [
  { label: 'CI', color: 'success' },
  { label: 'BETA', color: 'warning' },
  { label: 'RELEASE', color: 'neutral' },
  { label: 'Platform', color: 'neutral' },
  { label: 'License', color: 'neutral' }
]

const flightControllers = [
  { name: 'ArduPilot', logo: '/images/ardupilot_logo.webp' },
  { name: 'Betaflight', logo: '/images/betaflight_logo.svg' },
  { name: 'INAV', logo: '/images/inav_logo.png' }
]

const presentation = [
  { icon: 'i-lucide-gamepad-2', title: 'Works with any flight controller', text: 'MAVLink · MSP · NMEA · DroneCAN' },
  { icon: 'i-lucide-shield-check', title: 'Speaks the Remote ID standard', text: 'ASTM F3411-22a Open DroneID' },
  { icon: 'i-lucide-wifi', title: 'Broadcasts over WiFi and BLE', text: 'Beacon · NAN · BLE 4.0/5.0' }
]
</script>

<template>
  <UDashboardPanel id="home" class="bg-default" :ui="{ root: 'pt-16' }">
    <template #body>
      <div class="mx-auto flex w-full max-w-2xl flex-col items-center px-4 pb-10 text-center">
        <img src="/images/logo.svg" alt="OmniRID logo" class="size-24 sm:size-28" />

        <h1 class="mt-4 text-3xl font-black tracking-tight text-highlighted sm:text-5xl">
          {{ appName }}
        </h1>
        <p class="mt-1 text-xs uppercase tracking-[0.3em] text-muted">{{ appTagline }}</p>

        <div class="mt-4 flex flex-wrap items-center justify-center gap-1.5">
          <UBadge
            v-for="badge in heroBadges"
            :key="badge.label"
            :color="badge.color"
            variant="soft"
            :label="badge.label"
          />
        </div>

        <p class="mt-5 max-w-xl text-base leading-7 text-muted">
          OmniRID is an open-source Drone ID transmitter for ESP32 that turns any flight controller
          into a standards-compliant Remote ID beacon. Written in Rust.
        </p>

        <div class="mt-5 grid w-full grid-cols-1 gap-2 sm:grid-cols-3">
          <div v-for="fc in flightControllers" :key="fc.name" class="flex items-center justify-center gap-2 rounded-xl border border-default bg-elevated/60 px-3 py-2">
            <img :src="fc.logo" :alt="`${fc.name} logo`" class="size-12 object-contain" />
            <span class="text-sm font-semibold text-highlighted">{{ fc.name }}</span>
          </div>
        </div>

        <div class="mt-5 grid w-full gap-2 sm:grid-cols-3">
          <div v-for="item in presentation" :key="item.title" class="rounded-xl border border-default bg-elevated/40 p-3">
            <div class="mx-auto flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary ring-1 ring-primary/15">
              <UIcon :name="item.icon" class="size-4" />
            </div>
            <h3 class="mt-2 text-sm font-semibold text-highlighted">{{ item.title }}</h3>
            <p class="mt-1 text-xs leading-5 text-muted">{{ item.text }}</p>
          </div>
        </div>

        <div class="mt-6 flex flex-wrap items-center justify-center gap-2">
          <UButton to="/firmware" color="primary" size="lg" icon="i-lucide-flame" label="Flash firmware" />
          <UButton to="/docs/guide" color="neutral" variant="outline" size="lg" icon="i-lucide-book-open" label="Open guide" />
        </div>

        <div class="mt-6 w-full rounded-xl border border-warning/30 bg-warning/10 p-4 text-left">
          <div class="flex items-start gap-3">
            <UIcon name="i-lucide-triangle-alert" class="mt-0.5 size-4 shrink-0 text-warning" />
            <div>
              <p class="text-sm font-semibold text-highlighted">No release until the security audit is complete</p>
              <p class="mt-1 text-sm leading-5 text-muted">
                This firmware has not been security tested yet. Development and ground testing only —
                <UButton to="/compliance-security/security" color="primary" variant="link" size="sm" icon="i-lucide-shield-check" label="see the Security page." />
              </p>
            </div>
          </div>
        </div>

        <p class="mt-8 text-xs text-muted">
          Open source · Apache 2.0 · Made with ❤️ by VOLTEKOVER
        </p>
      </div>
    </template>
  </UDashboardPanel>
</template>