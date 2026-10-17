<script setup lang="ts">
import { appName, appTagline, appVersion } from "~/config/app";

const flightControllers = [
  { name: "ArduPilot", logo: "/images/ardupilot_logo.webp" },
  { name: "Betaflight", logo: "/images/betaflight_logo.svg" },
  { name: "INAV", logo: "/images/inav_logo.png" },
];

const channels = [
  { name: "WiFi Beacon", detail: "2.4 GHz", icon: "i-lucide-wifi" },
  { name: "WiFi NAN", detail: "2.4 / 5 GHz", icon: "i-lucide-signal" },
  { name: "Bluetooth", detail: "BLE 4.0 / 5.0", icon: "i-lucide-bluetooth" },
];

const inputs = ["MAVLink", "MSP", "NMEA", "DroneCAN"];

const capabilities = [
  {
    icon: "i-lucide-cable",
    title: "Reads any flight controller",
    text: "MAVLink, MSP, NMEA and DroneCAN over a single serial link, auto-detected.",
  },
  {
    icon: "i-lucide-radio",
    title: "Broadcasts Remote ID",
    text: "ASTM F3411-22a Open DroneID over WiFi Beacon, WiFi NAN and BLE.",
  },
  {
    icon: "i-lucide-shield-check",
    title: "Signed and auditable",
    text: "Ed25519 OTA verification, lock levels and full config persistence.",
  },
];
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
                  class="size-10 rounded-md ring-1 ring-default"
                />
                <span class="label-data">{{ appName }} / {{ appTagline }}</span>
                <UBadge color="warning" variant="soft" size="sm" label="Beta" />
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
                  to="/docs/guide"
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
                <span class="font-mono text-[11px] text-primary"
                  >ASTM F3411-22a</span
                >
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
                <img
                  :src="fc.logo"
                  :alt="`${fc.name} logo`"
                  class="size-7 object-contain"
                />
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
                  to="/compliance-security/security"
                  color="primary"
                  variant="link"
                  size="sm"
                  icon="i-lucide-shield-check"
                  label="Review the security model."
                />
              </p>
            </div>
          </section>

          <footer
            class="flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-default pt-6 font-mono text-xs text-muted"
          >
            <span>{{ appVersion }}</span>
            <span aria-hidden="true" class="text-dimmed">/</span>
            <span>Apache 2.0</span>
            <span aria-hidden="true" class="text-dimmed">/</span>
            <span>Built by VOLTEKOVER</span>
          </footer>
        </div>
      </div>
    </template>
  </UDashboardPanel>
</template>
