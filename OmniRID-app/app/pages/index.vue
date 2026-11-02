<script setup lang="ts">
import { appName, appTagline, appVersion } from '~/config/app'
import { ref, onMounted } from 'vue'

// Partner logos come with their own intended background: ArduPilot is light on
// dark, Betaflight/INAV are dark on light. Each logo gets a fixed tile so it
// stays legible in both app themes instead of inverting brand colors.
const flightControllers = [
  { name: 'ArduPilot', logo: '/images/ardupilot_logo.webp', tile: 'bg-[#101418]' },
  { name: 'Betaflight', logo: '/images/betaflight_logo.svg', tile: 'bg-white' },
  { name: 'INAV', logo: '/images/inav_logo.png', tile: 'bg-white' }
]

const channels = [
  { name: 'WiFi Beacon', detail: '2.4 GHz', icon: 'i-lucide-wifi' },
  { name: 'WiFi NAN', detail: '2.4 / 5 GHz', icon: 'i-lucide-signal' },
  { name: 'Bluetooth', detail: 'BLE 4.0 / 5.0', icon: 'i-lucide-bluetooth' }
]

const inputs = ['MAVLink', 'MSP', 'NMEA', 'DroneCAN']

const capabilities = [
  {
    icon: 'i-lucide-cable',
    title: 'Reads any flight controller',
    text: 'MAVLink, MSP, NMEA and DroneCAN over a single serial link, auto-detected.'
  },
  {
    icon: 'i-lucide-radio',
    title: 'Broadcasts Remote ID',
    text: 'ASTM F3411-22a Open DroneID over WiFi Beacon, WiFi NAN and BLE.'
  },
  {
    icon: 'i-lucide-shield-check',
    title: 'Signed and auditable',
    text: 'Ed25519 OTA verification, lock levels and full config persistence.'
  }
]
// Reactive state for dynamic changelog and tasks
interface ChangelogEntry {
  date: string
  title: string
  items: string[]
}
const changelog = ref<ChangelogEntry[]>([])
const pendingTasks = ref<string[]>([])

async function loadChangelog() {
  try {
    const raw = await $fetch<string>('https://raw.githubusercontent.com/VOLTEKOVER/OmniRID-Universal-Drone-ID/main/CHANGELOG.md')
    const entries: ChangelogEntry[] = []
    const sectionRegex = /## \[(\d{4}‑\d{2}‑\d{2})\] – "(.*?)"([\s\S]*?)(?=## |$)/g
    let match
    while ((match = sectionRegex.exec(raw))) {
      const [, date, title, body] = match
      if (!date || !title || body === undefined) continue
      const items = body.trim().split('\n')
        .filter(line => line.startsWith('-'))
        .map(line => line.slice(1).trim())
      entries.push({ date, title, items })
    }
    changelog.value = entries
  } catch (e) {
    console.error('Failed to load changelog', e)
  }
}

async function loadPendingTasks() {
  try {
    const raw = await $fetch<string>('https://raw.githubusercontent.com/VOLTEKOVER/OmniRID-Universal-Drone-ID/main/TASKS.md')
    const pending = raw.match(/## In‑progress \/ pending tasks([\s\S]*?)(?:\n##|$)/)
    if (pending && pending[1]) {
      const tasks = pending[1].split('\n')
        .map(l => l.trim())
        .filter(l => l.startsWith('- '))
        .map(l => l.slice(2).trim())
      pendingTasks.value = tasks
    }
  } catch (e) {
    console.error('Failed to load tasks', e)
  }
}

onMounted(() => {
  loadChangelog()
  loadPendingTasks()
})
</script>

<template>
  <UDashboardPanel id="home" class="bg-default" :ui="{ root: 'pt-16' }">
    <template #body>
      <div class="pb-16">
        <!-- Masthead -->
        <section
          class="relative isolate overflow-hidden border-b border-default"
        >
          <div
            aria-hidden="true"
            class="app-grid pointer-events-none absolute inset-0 -z-10 opacity-80"
          />
          <div
            aria-hidden="true"
            class="pointer-events-none absolute -top-32 left-1/4 -z-10 h-96 w-[52rem] max-w-full [background:radial-gradient(45%_60%_at_50%_30%,var(--app-glow),transparent_72%)]"
          />

          <div
            class="mx-auto grid w-full max-w-[1400px] gap-12 px-4 py-14 sm:px-6 lg:grid-cols-[1.12fr_0.88fr] lg:items-center lg:gap-16 lg:px-10 lg:py-20"
          >
            <div class="min-w-0">
              <div class="flex flex-wrap items-center gap-3">
                <img
                  src="/images/logo.svg"
                  alt="OmniRID logo"
                  class="size-10 rounded-md ring-1 ring-default dark:invert"
                >
                <span class="label-data">{{ appName }} / {{ appTagline }}</span>
                <UBadge
                  color="warning"
                  variant="soft"
                  size="sm"
                  label="Beta"
                />
              </div>

              <h1
                class="text-display mt-7 text-[2.5rem] leading-[1.02] tracking-tight text-highlighted sm:text-5xl lg:text-6xl"
              >
                OmniRID broadcast drone Remote ID from any ESP32.
              </h1>

              <p
                class="mt-6 max-w-xl text-base leading-7 text-muted sm:text-lg"
              >
                OmniRID reads your flight controller and transmits a signed ASTM
                F3411-22a Open DroneID identity over WiFi and Bluetooth.
                Firmware written in Rust.
              </p>

              <div class="mt-8 flex flex-wrap items-center gap-2">
                <UButton
                  to="/firmware"
                  color="primary"
                  size="lg"
                  icon="i-lucide-flame"
                  label="Flash firmware"
                />
                <UButton
                  to="/guide"
                  color="neutral"
                  variant="outline"
                  size="lg"
                  icon="i-lucide-book-open"
                  label="Read the guide"
                />
              </div>
            </div>

            <!-- Transmit stack -->
            <div
              class="w-full overflow-hidden rounded-lg border border-default bg-elevated/40 backdrop-blur-sm"
            >
              <div
                class="flex items-center justify-between gap-3 border-b border-default px-4 py-3"
              >
                <span class="label-data">Transmit stack</span>
                <span class="font-mono text-[11px] text-primary">ASTM F3411-22a</span>
              </div>

              <ul class="divide-y divide-default">
                <li
                  v-for="channel in channels"
                  :key="channel.name"
                  class="flex items-center justify-between gap-3 px-4 py-3.5"
                >
                  <span
                    class="flex items-center gap-3 text-sm font-medium text-highlighted"
                  >
                    <UIcon :name="channel.icon" class="size-4 text-primary" />
                    {{ channel.name }}
                  </span>
                  <span class="font-mono text-xs text-muted">{{
                    channel.detail
                  }}</span>
                </li>
              </ul>

              <div class="border-t border-default px-4 py-3.5">
                <span class="label-data">Flight-controller input</span>
                <div class="mt-2.5 flex flex-wrap gap-1.5">
                  <span
                    v-for="input in inputs"
                    :key="input"
                    class="rounded-sm border border-default px-2 py-0.5 font-mono text-[11px] text-muted"
                  >
                    {{ input }}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </section>

        <!-- Body -->
        <div
          class="mx-auto w-full max-w-[1400px] space-y-12 px-4 pt-12 sm:px-6 lg:px-10"
        >
          <section>
            <div class="mb-5 flex items-center gap-3">
              <h2 class="text-display text-lg text-highlighted">
                What it does
              </h2>
              <div class="h-px flex-1 bg-accented" aria-hidden="true" />
            </div>
            <dl
              class="grid gap-px overflow-hidden rounded-lg border border-default bg-accented sm:grid-cols-3"
            >
              <div
                v-for="item in capabilities"
                :key="item.title"
                class="bg-default p-5"
              >
                <UIcon :name="item.icon" class="size-5 text-primary" />
                <dt class="mt-4 text-sm font-semibold text-highlighted">
                  {{ item.title }}
                </dt>
                <dd class="mt-1.5 text-sm leading-6 text-muted">
                  {{ item.text }}
                </dd>
              </div>
            </dl>
          </section>

          <section>
            <div class="mb-5 flex items-center gap-3">
              <h2 class="text-display text-lg text-highlighted">
                Works out of the box with
              </h2>
              <div class="h-px flex-1 bg-accented" aria-hidden="true" />
            </div>
            <div class="flex flex-wrap items-center gap-3">
              <div
                v-for="fc in flightControllers"
                :key="fc.name"
                class="flex items-center gap-2.5 rounded-lg border border-default bg-elevated/40 px-4 py-2.5"
              >
                <span
                  class="flex size-8 shrink-0 items-center justify-center rounded-md p-1 ring-1 ring-default"
                  :class="fc.tile"
                >
                  <img
                    :src="fc.logo"
                    :alt="`${fc.name} logo`"
                    class="size-full object-contain"
                  >
                </span>
                <span class="text-sm font-semibold text-highlighted">{{
                  fc.name
                }}</span>
              </div>
            </div>
          </section>

          <section
            class="flex items-start gap-3 rounded-lg border border-warning/40 bg-warning/10 p-5"
          >
            <UIcon
              name="i-lucide-triangle-alert"
              class="mt-0.5 size-5 shrink-0 text-warning"
            />
            <div>
              <p class="text-sm font-semibold text-highlighted">
                Not released until the security audit is complete
              </p>
              <p class="mt-1 text-sm leading-6 text-muted">
                This firmware has not been security tested yet. Development and
                ground testing only.
                <UButton
                  to="/tx/security"
                  color="primary"
                  variant="link"
                  size="sm"
                  icon="i-lucide-shield-check"
                  label="Review the security model."
                />
              </p>
            </div>
          </section>

          <section>
            <div class="mb-5 flex items-center gap-3">
              <h2 class="text-display text-lg text-highlighted">
                Changelog
              </h2>
              <div class="h-px flex-1 bg-accented" aria-hidden="true" />
            </div>
            <div v-if="changelog.length" class="space-y-4">
              <div v-for="entry in changelog" :key="entry.date" class="bg-default p-4 rounded-lg">
                <h3 class="font-semibold text-highlighted">
                  {{ entry.title }} – {{ entry.date }}
                </h3>
                <ul class="list-disc list-inside mt-2 text-sm text-muted">
                  <li v-for="item in entry.items" :key="item">
                    {{ item }}
                  </li>
                </ul>
              </div>
            </div>
            <p v-else class="text-muted">
              Loading changelog…
            </p>
          </section>

          <section class="mt-8">
            <div class="mb-5 flex items-center gap-3">
              <h2 class="text-display text-lg text-highlighted">
                Upcoming tasks
              </h2>
              <div class="h-px flex-1 bg-accented" aria-hidden="true" />
            </div>
            <ul v-if="pendingTasks.length" class="list-disc list-inside text-sm text-muted">
              <li v-for="task in pendingTasks.slice(0, 5)" :key="task">
                {{ task }}
              </li>
            </ul>
            <p v-else class="text-muted">
              Loading tasks…
            </p>
          </section>

          <footer
            class="flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-default pt-6 font-mono text-xs text-muted"
          >
            <span>{{ appVersion }}</span>
            <span aria-hidden="true" class="text-dimmed">/</span>
            <span>AGPL-3.0</span>
            <span aria-hidden="true" class="text-dimmed">/</span>
            <span>Built by VOLTEKOVER</span>
          </footer>
        </div>
      </div>
    </template>
  </UDashboardPanel>
</template>
