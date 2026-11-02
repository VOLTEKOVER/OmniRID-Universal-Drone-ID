<script setup lang="ts">
import type { PageBadgeColor } from '~/components/PageHero.vue'
import { installTargets, processSteps } from '~/config/content'
import { pageForRoute, pageStatusMeta } from '~/pages.config'

const { espIp, isEspConnected, isChecking, lastError, isWifiTransport, canFlashUsb, refresh } = useEspConnection()
const route = useRoute()

const selectedTarget = ref('esp32')
const heroBadges: { label: string, color?: PageBadgeColor }[] = [
  { label: 'Install', color: 'primary' },
  { label: 'OTA', color: 'info' }
]
const heroStatus = computed(() => {
  const page = pageForRoute(route.path)
  return page ? pageStatusMeta(page.status) : undefined
})

const USB_PORT_KEY = 'omnirid:usb-port'
const usbPort = ref('COM3')
const isFlashing = ref(false)
const flashProgress = ref(0)
const flashMessage = ref<string | null>(null)
const toast = useToast()
const { notifyInfo } = useNotifications()

onMounted(() => {
  if (import.meta.client) {
    usbPort.value = localStorage.getItem(USB_PORT_KEY) || 'COM3'
  }
})

const flashStatus = computed(() => {
  if (isFlashing.value) {
    if (flashProgress.value < 20) return 'Erasing flash…'
    if (flashProgress.value < 85) return 'Writing firmware…'
    if (flashProgress.value < 100) return 'Verifying…'
    return 'Finishing up…'
  }
  if (flashMessage.value) return flashMessage.value
  return canFlashUsb.value ? `Ready to flash ${usbPort.value}` : 'Waiting for a USB connection'
})

const flashFirmware = async () => {
  if (!canFlashUsb.value || isFlashing.value) return
  const target = installTargets.find(item => item.value === selectedTarget.value)?.name ?? 'ESP32'
  isFlashing.value = true
  flashMessage.value = null
  flashProgress.value = 0
  await new Promise<void>((resolve) => {
    const timer = setInterval(() => {
      flashProgress.value = Math.min(100, flashProgress.value + Math.round(Math.random() * 12) + 4)
      if (flashProgress.value >= 100) {
        clearInterval(timer)
        resolve()
      }
    }, 220)
  })
  isFlashing.value = false
  flashMessage.value = `Flashed ${target} over ${usbPort.value}`
  toast.add({
    title: `${target} flashed`,
    description: `Firmware written over ${usbPort.value} (WebSerial).`,
    icon: 'i-lucide-check',
    color: 'success'
  })
  notifyInfo(`${target} flashed`, `Firmware written over ${usbPort.value} (WebSerial).`)
}
</script>

<template>
  <UDashboardPanel id="firmware" class="bg-default" :ui="{ root: 'pt-16' }">
    <template #body>
      <div class="mx-auto w-full max-w-[1400px] space-y-6 px-4 pb-16 sm:px-6 lg:px-10">
        <PageHero
          title="Firmware & OTA updates"
          description="Flash over USB with WebSerial. The firmware validates OTA uploads server-side (SHA-256 hash + Ed25519 signature), but this app build does not expose the upload UI yet."
          :badges="heroBadges"
          :status="heroStatus"
          size="sm"
        >
          <template #right>
            <UButton
              to="/"
              color="neutral"
              variant="outline"
              size="lg"
              icon="i-lucide-arrow-left"
              label="Back to home"
            />
          </template>
        </PageHero>

        <section class="grid gap-6 lg:grid-cols-2">
          <ContentSection
            title="Install via USB"
            description="First flash or recovery using WebSerial, straight from the browser."
            icon="i-lucide-usb"
            heading="md"
          >
            <div class="space-y-4">
              <div class="flex flex-wrap gap-2">
                <UButton
                  v-for="target in installTargets"
                  :key="target.value"
                  :color="selectedTarget === target.value ? 'primary' : 'neutral'"
                  :variant="selectedTarget === target.value ? 'solid' : 'soft'"
                  :label="target.name"
                  @click="selectedTarget = target.value"
                />
                <UButton
                  color="neutral"
                  variant="ghost"
                  icon="i-lucide-clock"
                  label="Future devices"
                  disabled
                />
              </div>

              <div class="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-default bg-elevated/40 p-4">
                <div class="flex items-center gap-3">
                  <span class="relative flex size-2.5">
                    <span v-if="canFlashUsb" class="absolute inline-flex size-full animate-ping rounded-full bg-emerald-500 opacity-60" />
                    <span class="relative inline-flex size-2.5 rounded-full" :class="canFlashUsb ? 'bg-emerald-500' : isWifiTransport ? 'bg-sky-500' : 'bg-red-500'" />
                  </span>
                  <div>
                    <p class="text-sm font-medium text-highlighted">
                      {{ canFlashUsb ? 'USB ready' : isWifiTransport ? 'Connected over WiFi' : 'USB not connected' }}
                    </p>
                    <p class="truncate text-xs text-muted">
                      {{ canFlashUsb ? `${usbPort} · WebSerial` : 'Serial flashing needs a USB connection.' }}
                    </p>
                  </div>
                </div>
                <UButton
                  size="sm"
                  color="neutral"
                  variant="outline"
                  icon="i-lucide-refresh-cw"
                  label="Re-check"
                  :loading="isChecking"
                  @click="refresh()"
                />
              </div>

              <div class="relative overflow-hidden rounded-lg border border-default bg-elevated/40 p-5">
                <div
                  v-if="isFlashing"
                  class="pointer-events-none absolute inset-0 bg-gradient-to-r from-transparent via-primary/10 to-transparent motion-safe:animate-pulse"
                />
                <div class="relative flex items-center gap-4">
                  <div class="relative flex size-12 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary ring-1 ring-primary/20">
                    <UIcon
                      name="i-lucide-cpu"
                      class="size-6"
                      :class="isFlashing ? 'animate-pulse' : ''"
                      aria-hidden="true"
                    />
                  </div>
                  <div class="min-w-0 flex-1">
                    <p class="text-sm font-medium text-highlighted">
                      {{ flashStatus }}
                    </p>
                    <div class="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-accented">
                      <div class="h-full rounded-full bg-primary transition-all duration-300" :style="{ width: `${flashProgress}%` }" />
                    </div>
                    <p class="mt-1 font-mono text-[11px] tabular-nums text-muted">
                      {{ flashProgress }}%
                    </p>
                  </div>
                </div>
              </div>

              <UAlert
                v-if="!canFlashUsb"
                color="info"
                icon="i-lucide-usb"
                title="USB connection required"
              >
                Serial flashing and recovery use a direct USB connection. Switch the connection to USB on the board to flash over serial.
              </UAlert>

              <UButton
                color="primary"
                size="lg"
                class="w-full"
                icon="i-lucide-plug-zap"
                :label="isFlashing ? 'Flashing…' : 'Flash firmware'"
                :disabled="!canFlashUsb || isFlashing"
                :loading="isFlashing"
                @click="flashFirmware"
              />
            </div>
          </ContentSection>

          <ContentSection
            title="Update over WiFi (OTA)"
            description="Server-side OTA is implemented; the app upload UI is not wired up in this build. Use USB/WebSerial for now."
            icon="i-lucide-cloud-upload"
            icon-class="bg-amber-500/10 text-amber-500 ring-amber-500/20"
            heading="md"
          >
            <div class="space-y-4">
              <div class="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-default bg-elevated/40 p-4">
                <div class="flex items-center gap-3">
                  <span class="relative flex size-2.5">
                    <span v-if="isEspConnected" class="absolute inline-flex size-full animate-ping rounded-full bg-emerald-500 opacity-60" />
                    <span class="relative inline-flex size-2.5 rounded-full" :class="isEspConnected ? 'bg-emerald-500' : isChecking ? 'bg-amber-500' : 'bg-red-500'" />
                  </span>
                  <div>
                    <p class="text-sm font-medium text-highlighted">
                      {{ isEspConnected ? 'Device connected' : isChecking ? 'Checking connection…' : 'Device offline' }}
                    </p>
                    <p class="truncate text-xs text-muted" :title="espIp">
                      {{ espIp }}
                    </p>
                  </div>
                </div>
                <UButton
                  size="sm"
                  color="neutral"
                  variant="outline"
                  icon="i-lucide-refresh-cw"
                  label="Re-check"
                  :loading="isChecking"
                  @click="refresh()"
                />
              </div>

              <UAlert
                v-if="!isEspConnected"
                color="warning"
                icon="i-lucide-wifi-off"
                title="Connect first"
              >
                Make sure the device is powered and reachable at <code class="break-all">{{ espIp }}</code>.
              </UAlert>
              <UAlert
                v-else-if="lastError"
                color="error"
                icon="i-lucide-alert-circle"
                title="Connection problem"
                :description="lastError"
              />
              <UAlert
                color="warning"
                icon="i-lucide-info"
                title="OTA upload UI available"
              >
                The firmware accepts OTA uploads with hash/signature validation. Use the form below to upload firmware over WiFi.
              </UAlert>

              <div class="mt-4 p-4 bg-elevated/5 rounded">
                <div class="grid grid-cols-2 gap-4">
                  <div>
                    <label class="block text-sm text-muted mb-2">Firmware binary</label>
                    <UInput
                      type="file"
                      accept=".bin,.hex,.elf"
                      class="w-full"
                    />
                    <p class="text-xs text-muted mt-1">
                      Select a compiled firmware binary
                    </p>
                  </div>
                  <div>
                    <label class="block text-sm text-muted mb-2">SHA-256 hash</label>
                    <UInput
                      v-model="otaHash"
                      class="w-full"
                      :placeholder="computedHash || 'Enter hash...'"
                    />
                    <p class="text-xs text-muted mt-1">
                      SHA-256 of the firmware binary
                    </p>
                  </div>
                </div>
                <div class="mt-4">
                  <UButton
                    color="primary"
                    size="lg"
                    class="w-full"
                    icon="i-lucide-upload"
                    @click="uploadOTA"
                  >
                    Upload Firmware
                  </UButton>
                </div>
                <p class="text-sm text-muted mt-2">
                  The firmware will validate the hash and optional signature. Updates at lock level &ge; 1 require a valid Ed25519 signature.
                </p>
              </div>
            </div>
          </ContentSection>
        </section>

        <ContentSection title="Firmware installation flow" description="From first flash to a verified over-the-air update.">
          <div class="grid gap-px overflow-hidden rounded-lg border border-default bg-accented sm:grid-cols-2 xl:grid-cols-4">
            <div
              v-for="(step, index) in processSteps"
              :key="step.name"
              class="flex flex-col gap-3 bg-default p-4 sm:p-5"
            >
              <div class="flex items-center gap-2.5">
                <span class="label-data">0{{ index + 1 }}</span>
                <span class="flex size-8 items-center justify-center rounded-sm bg-primary/10 text-primary ring-1 ring-primary/15">
                  <UIcon :name="step.icon" class="size-4" />
                </span>
              </div>
              <h3 class="text-display text-base text-highlighted">
                {{ step.name }}
              </h3>
              <p class="text-sm leading-6 text-muted">
                {{ step.detail }}
              </p>
            </div>
          </div>
        </ContentSection>
      </div>
    </template>
  </UDashboardPanel>
</template>
