<script setup lang="ts">
import { appRepoUrl, appSoftwareStatusUrl, appVersion } from '~/config/app'
import { ref, onMounted } from 'vue'

// Partner logos come with their own intended background: ArduPilot is light on
// dark, Betaflight/INAV are dark on light. Each logo gets a fixed tile so it
// stays legible in both app themes instead of inverting brand colors.
const flightControllers = [
  { name: 'ArduPilot', logo: '/images/ardupilot_logo.webp', tile: 'bg-[#101418]' },
  { name: 'Betaflight', logo: '/images/betaflight_logo.svg', tile: 'bg-white' },
  { name: 'INAV', logo: '/images/inav_logo.png', tile: 'bg-white' }
]

const inputs = ['AUTO · autodetect', 'NMEA', 'MSP', 'MAVLink', 'DroneCAN']

const outputs = [
  { name: 'WiFi Beacon', icon: 'i-lucide-wifi' },
  { name: 'WiFi NAN', icon: 'i-lucide-signal' },
  { name: 'Bluetooth LE 4.0', icon: 'i-lucide-bluetooth' },
  { name: 'Bluetooth LE 5.0', icon: 'i-lucide-bluetooth' }
]

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
const changelogLoading = ref(true)
const tasksLoading = ref(true)
const changelogUnavailable = ref(false)
const tasksUnavailable = ref(false)

async function loadChangelog() {
  try {
    const raw = await $fetch<string>('https://raw.githubusercontent.com/VOLTEKOVER/OmniRID-Universal-Drone-ID/omnirid-webapp-pwa/CHANGELOG.md')
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
    changelogUnavailable.value = true
  } finally {
    changelogLoading.value = false
  }
}

async function loadPendingTasks() {
  try {
    const raw = await $fetch<string>('https://raw.githubusercontent.com/VOLTEKOVER/OmniRID-Universal-Drone-ID/omnirid-webapp-pwa/TASKS.md')
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
    tasksUnavailable.value = true
  } finally {
    tasksLoading.value = false
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

          <div class="mx-auto grid w-full max-w-[1400px] gap-8 px-4 py-10 sm:px-6 md:py-14 lg:grid-cols-[0.9fr_1.1fr] lg:items-center lg:gap-10 lg:px-10 lg:py-16">
            <div class="min-w-0">
              <h1
                class="text-display max-w-[15ch] text-4xl leading-[1.04] tracking-tight text-highlighted sm:text-5xl xl:text-[3.5rem]"
              >
                Broadcast Remote ID from any ESP32.
              </h1>

              <p
                class="mt-5 max-w-xl text-base leading-7 text-muted"
              >
                Read flight-controller data and transmit a signed ASTM F3411-22a
                Open Drone ID over WiFi and Bluetooth.
              </p>

              <div class="mt-7 flex flex-wrap items-center gap-3">
                <UButton
                  to="/firmware"
                  color="primary"
                  size="lg"
                  icon="i-lucide-flame"
                  label="Get started"
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

            <section aria-labelledby="data-flow-title" class="min-w-0 rounded-xl border border-default bg-elevated/20 p-4 sm:p-6">
              <div class="mb-5 flex flex-wrap items-end justify-between gap-2">
                <div>
                  <p class="label-data">
                    System overview
                  </p>
                  <h2 id="data-flow-title" class="text-display mt-1 text-lg font-semibold text-highlighted">
                    Inputs to Remote ID broadcasts
                  </h2>
                </div>
                <span class="font-mono text-xs text-primary">ASTM F3411-22a</span>
              </div>

              <div class="grid items-center gap-3 lg:grid-cols-[1fr_auto_0.9fr_auto_1fr]">
                <div>
                  <p class="mb-2 text-xs font-medium uppercase tracking-wide text-muted">
                    Flight-controller inputs
                  </p>
                  <div class="flex flex-wrap gap-2">
                    <span
                      v-for="input in inputs"
                      :key="input"
                      class="rounded-md border border-default bg-default px-2.5 py-1.5 font-mono text-xs text-highlighted"
                    >
                      {{ input }}
                    </span>
                  </div>
                </div>

                <UIcon name="i-lucide-arrow-right" class="hidden size-5 text-primary lg:block" aria-hidden="true" />
                <UIcon name="i-lucide-arrow-down" class="mx-auto size-5 text-primary lg:hidden" aria-hidden="true" />

                <div class="rounded-lg border border-primary/40 bg-primary/5 px-4 py-4 text-center">
                  <img src="/images/logo.svg" alt="" class="mx-auto size-8 dark:invert">
                  <p class="mt-2 text-sm font-semibold text-highlighted">
                    OmniRID
                  </p>
                  <p class="mt-0.5 font-mono text-[11px] text-muted">
                    Parse · identify · encode
                  </p>
                </div>

                <UIcon name="i-lucide-arrow-right" class="hidden size-5 text-primary lg:block" aria-hidden="true" />
                <UIcon name="i-lucide-arrow-down" class="mx-auto size-5 text-primary lg:hidden" aria-hidden="true" />

                <div>
                  <p class="mb-2 text-xs font-medium uppercase tracking-wide text-muted">
                    Broadcast outputs
                  </p>
                  <div class="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-1">
                    <div
                      v-for="output in outputs"
                      :key="output.name"
                      class="flex min-w-0 items-center gap-2 rounded-md border border-default bg-default px-2.5 py-2"
                    >
                      <UIcon :name="output.icon" class="size-4 shrink-0 text-primary" aria-hidden="true" />
                      <span class="min-w-0 text-xs font-medium text-highlighted">{{ output.name }}</span>
                    </div>
                  </div>
                </div>
              </div>
              <p class="mt-3 text-[11px] text-muted">
                Bluetooth LE 5.0 Long Range support depends on the ESP32 model.
              </p>
            </section>
          </div>
        </section>

        <!-- Body -->
        <div class="mx-auto w-full max-w-[1400px] space-y-10 px-4 py-10 sm:px-6 lg:px-10 lg:py-12">
          <div class="grid gap-10 lg:grid-cols-[1.45fr_0.75fr]">
            <section>
              <div class="mb-4 flex items-center gap-3">
                <h2 class="text-display text-lg text-highlighted">
                  What it does
                </h2>
                <div class="h-px flex-1 bg-accented" aria-hidden="true" />
              </div>
              <dl class="grid gap-px overflow-hidden rounded-xl border border-default bg-accented sm:grid-cols-3">
                <div
                  v-for="item in capabilities"
                  :key="item.title"
                  class="bg-default p-4 sm:p-5"
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
              <div class="mb-4 flex items-center gap-3">
                <h2 class="text-display text-lg text-highlighted">
                  Compatible with
                </h2>
                <div class="h-px flex-1 bg-accented" aria-hidden="true" />
              </div>
              <div class="grid grid-cols-1 gap-2 sm:grid-cols-3 lg:grid-cols-1">
                <div
                  v-for="fc in flightControllers"
                  :key="fc.name"
                  class="flex items-center gap-3 rounded-lg border border-default bg-elevated/40 px-3 py-2.5"
                >
                  <span class="flex size-9 shrink-0 items-center justify-center rounded-md p-1.5 ring-1 ring-default" :class="fc.tile">
                    <img :src="fc.logo" :alt="`${fc.name} logo`" class="size-full object-contain">
                  </span>
                  <span class="text-sm font-semibold text-highlighted">{{ fc.name }}</span>
                  <UIcon name="i-lucide-check" class="ml-auto size-4 text-success" aria-hidden="true" />
                </div>
              </div>
            </section>
          </div>

          <section
            class="flex items-start gap-3 rounded-xl border border-error/40 bg-error/10 p-4 sm:p-5"
          >
            <UIcon
              name="i-lucide-triangle-alert"
              class="mt-0.5 size-5 shrink-0 text-error"
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

          <div class="grid gap-10 lg:grid-cols-2">
            <section>
              <div class="mb-4 flex items-center gap-3">
                <h2 class="text-display text-lg text-highlighted">
                  Changelog
                </h2>
                <div class="h-px flex-1 bg-accented" aria-hidden="true" />
              </div>
              <div v-if="changelog.length" class="space-y-3">
                <article v-for="entry in changelog.slice(0, 2)" :key="entry.date" class="rounded-xl border border-default bg-elevated/30 p-4">
                  <h3 class="font-semibold text-highlighted">
                    {{ entry.title }} – {{ entry.date }}
                  </h3>
                  <ul class="mt-2 space-y-1 text-sm leading-6 text-muted">
                    <li v-for="item in entry.items.slice(0, 3)" :key="item" class="flex gap-2">
                      <span class="text-primary" aria-hidden="true">·</span>
                      {{ item }}
                    </li>
                  </ul>
                </article>
              </div>
              <p v-else-if="changelogLoading" class="rounded-xl border border-default p-4 text-sm text-muted">
                Loading changelog…
              </p>
              <p v-else-if="changelogUnavailable" class="rounded-xl border border-default p-4 text-sm text-muted">
                Changelog is temporarily unavailable.
                <UButton
                  :to="`${appRepoUrl}/blob/omnirid-webapp-pwa/CHANGELOG.md`"
                  target="_blank"
                  color="primary"
                  variant="link"
                  size="sm"
                  label="View changelog"
                />
              </p>
              <p v-else class="rounded-xl border border-default p-4 text-sm text-muted">
                No changelog entries are available.
              </p>
            </section>

            <section>
              <div class="mb-4 flex items-center gap-3">
                <h2 class="text-display text-lg text-highlighted">
                  In progress
                </h2>
                <div class="h-px flex-1 bg-accented" aria-hidden="true" />
              </div>
              <ul v-if="pendingTasks.length" class="space-y-2 rounded-xl border border-default bg-elevated/30 p-4 text-sm leading-6 text-muted">
                <li v-for="task in pendingTasks.slice(0, 5)" :key="task" class="flex gap-2">
                  <span class="mt-2 size-1.5 shrink-0 rounded-full bg-primary" aria-hidden="true" />
                  {{ task }}
                </li>
              </ul>
              <p v-else-if="tasksLoading" class="rounded-xl border border-default p-4 text-sm text-muted">
                Loading tasks…
              </p>
              <p v-else-if="tasksUnavailable" class="rounded-xl border border-default p-4 text-sm text-muted">
                Project status is temporarily unavailable.
                <UButton
                  :to="appSoftwareStatusUrl"
                  target="_blank"
                  color="primary"
                  variant="link"
                  size="sm"
                  label="View project roadmap"
                />
              </p>
              <p v-else class="rounded-xl border border-default p-4 text-sm text-muted">
                No open tasks are listed.
              </p>
            </section>
          </div>

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
