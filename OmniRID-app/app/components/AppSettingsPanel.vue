<script setup lang="ts">
import { defaults, useAppSettings } from '~/composables/useAppSettings'
import type { VirtualConnection } from '~/composables/useAppSettings'

// The scroll area is capped in the desktop popover but should fill the
// available height when hosted in a slideover.
withDefaults(defineProps<{ scrollClass?: string }>(), { scrollClass: 'max-h-[60vh]' })

const { settings } = useAppSettings()

const themeOptions = [
  { label: 'Blue', value: 'blue' },
  { label: 'Violet', value: 'violet' },
  { label: 'Emerald', value: 'emerald' },
  { label: 'Amber', value: 'amber' },
  { label: 'Yellow', value: 'yellow' }
]

const languageOptions = [
  { label: 'English', value: 'en' },
  { label: 'Italiano', value: 'it' }
]

const virtualConnectionOptions: { label: string, value: VirtualConnection, icon: string }[] = [
  { label: 'WiFi', value: 'wifi', icon: 'i-lucide-wifi' },
  { label: 'USB', value: 'usb', icon: 'i-lucide-usb' },
  { label: 'Off', value: 'off', icon: 'i-lucide-power' }
]

const resetSettings = () => {
  settings.value = { ...defaults }
}
</script>

<template>
  <div class="flex min-h-0 flex-col">
    <div class="space-y-6 overflow-y-auto px-4 py-4" :class="scrollClass">
      <section>
        <p class="text-xs font-semibold uppercase tracking-[0.18em] text-muted">
          Options
        </p>
        <div class="mt-2 divide-y divide-default border-y border-default">
          <div class="flex items-start justify-between gap-4 py-3">
            <div>
              <p class="text-sm font-medium text-highlighted">
                Enable Expert Mode
              </p>
              <p class="mt-0.5 text-xs text-muted">
                Unlock pages marked as WIP and experimental tools.
              </p>
            </div>
            <USwitch v-model="settings.expertMode" />
          </div>
          <div class="flex items-start justify-between gap-4 py-3">
            <div>
              <p class="text-sm font-medium text-highlighted">
                Reopen last tab on connect
              </p>
              <p class="mt-0.5 text-xs text-muted">
                Restore the last visited page when the ESP gets connected.
              </p>
            </div>
            <USwitch v-model="settings.reopenLastTab" />
          </div>
          <div class="flex items-start justify-between gap-4 py-3">
            <div>
              <p class="text-sm font-medium text-highlighted">
                Disable internet access
              </p>
              <p class="mt-0.5 text-xs text-muted">
                For metered or slow connections. Hides external links.
              </p>
            </div>
            <USwitch v-model="settings.disableInternet" />
          </div>
        </div>
      </section>

      <section>
        <p class="text-xs font-semibold uppercase tracking-[0.18em] text-muted">
          Interface
        </p>
        <div class="mt-2 divide-y divide-default border-y border-default">
          <div class="flex items-start justify-between gap-4 py-3">
            <div>
              <p class="text-sm font-medium text-highlighted">
                Enable dark theme
              </p>
              <p class="mt-0.5 text-xs text-muted">
                Use the dark color scheme instead of the system default.
              </p>
            </div>
            <USwitch v-model="settings.enableDarkTheme" />
          </div>
          <div class="flex items-center justify-between gap-4 py-3">
            <div>
              <p class="text-sm font-medium text-highlighted">
                Color Theme
              </p>
              <p class="mt-0.5 text-xs text-muted">
                Accent color used across the application.
              </p>
            </div>
            <USelect
              v-model="settings.colorTheme"
              :items="themeOptions"
              value-key="value"
              class="w-28 shrink-0"
            />
          </div>
          <div class="flex flex-col gap-3 py-3 sm:flex-row sm:items-center sm:justify-between">
            <div class="flex items-baseline gap-2">
              <p class="text-sm font-medium text-highlighted">
                UI Scale
              </p>
              <span class="rounded-md bg-elevated px-1.5 py-0.5 text-xs tabular-nums text-muted" aria-hidden="true">{{ settings.uiScale }}%</span>
            </div>
            <div class="w-full sm:w-40">
              <USlider
                v-model="settings.uiScale"
                :min="50"
                :max="150"
                :step="5"
              />
            </div>
          </div>
          <div class="flex items-center justify-between gap-4 py-3">
            <div>
              <p class="text-sm font-medium text-highlighted">
                Select default language
              </p>
              <p class="mt-0.5 text-xs text-muted">
                Language shown in the interface.
              </p>
            </div>
            <USelect
              v-model="settings.language"
              :items="languageOptions"
              value-key="value"
              class="w-28 shrink-0"
            />
          </div>
        </div>
      </section>

      <section>
        <p class="text-xs font-semibold uppercase tracking-[0.18em] text-muted">
          Connection
        </p>
        <div class="mt-2 divide-y divide-default border-y border-default">
          <div class="flex flex-col gap-3 py-3">
            <div>
              <p class="text-sm font-medium text-highlighted">
                Virtual connection
              </p>
              <p class="mt-0.5 text-xs text-muted">
                Simulate a WiFi link to the ESP to explore the app without hardware. Off connects to a real device.
              </p>
            </div>
            <div class="flex items-center gap-1 rounded-lg border border-default bg-elevated/60 p-1">
              <button
                v-for="option in virtualConnectionOptions"
                :key="option.value"
                type="button"
                class="flex flex-1 items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-medium transition"
                :class="settings.virtualConnection === option.value ? 'bg-primary text-inverted' : 'text-muted hover:text-highlighted'"
                @click="settings.virtualConnection = option.value"
              >
                <UIcon :name="option.icon" class="size-3.5" />
                <span>{{ option.label }}</span>
              </button>
            </div>
          </div>
        </div>
      </section>

      <UAlert
        title="Make a backup before applying presets"
        description="Please make sure you backup your current configuration (Save backup button or via CLI if the button is disabled) before picking and applying presets. Otherwise there is no way to return to previous configuration after applying presets."
        color="warning"
        variant="soft"
        icon="i-lucide-triangle-alert"
      />
    </div>

    <div class="flex items-center justify-between gap-3 border-t border-default px-4 py-3">
      <p class="text-xs text-muted">
        Stored locally on this device.
      </p>
      <UButton
        color="neutral"
        variant="ghost"
        size="sm"
        label="Reset to defaults"
        @click="resetSettings"
      />
    </div>
  </div>
</template>
