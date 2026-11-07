<script setup lang="ts">
import { processSteps } from '~/config/content'
import { pageForRoute, pageStatusMeta } from '~/pages.config'

const { espIp, isEspConnected, isChecking, lastError, isWifiTransport, isSimulated, refresh } = useEspConnection()
const route = useRoute()

const heroStatus = computed(() => {
  const page = pageForRoute(route.path)
  return page ? pageStatusMeta(page.status) : undefined
})

const otaFile = ref<File | null>(null)
const otaFileInput = ref<HTMLInputElement | null>(null)
const otaHash = ref('')
const otaSignature = ref('')
const isUploadingOta = ref(false)
const otaMessage = ref<string | null>(null)
const toast = useToast()
const { notifyInfo } = useNotifications()

const selectOtaFile = async (event: Event) => {
  const file = (event.target as HTMLInputElement).files?.[0] ?? null
  otaFile.value = file
  otaHash.value = ''
  otaMessage.value = null
  if (!file) return

  if (!globalThis.crypto?.subtle) {
    otaMessage.value = 'SHA-256 is unavailable. Open the app in a secure context (HTTPS or localhost).'
    return
  }

  try {
    const digest = await crypto.subtle.digest('SHA-256', await file.arrayBuffer())
    otaHash.value = Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('')
  } catch {
    otaMessage.value = 'Could not compute the firmware SHA-256 hash.'
  }
}

const uploadOTA = async () => {
  if (!otaFile.value || !otaHash.value || !isWifiTransport.value || isSimulated.value || isUploadingOta.value) return

  isUploadingOta.value = true
  otaMessage.value = null
  try {
    const headers: Record<string, string> = {
      'content-type': 'application/octet-stream',
      'x-esp-ip': espIp.value,
      'x-esp-timeout': '900000',
      'x-expected-sha256': otaHash.value
    }
    if (otaSignature.value.trim()) headers['x-signature'] = otaSignature.value.trim()

    const response = await fetch('/api/esp/ota', {
      method: 'POST',
      headers,
      body: otaFile.value,
      signal: AbortSignal.timeout(900000)
    })
    const responseText = await response.text()
    if (!response.ok) {
      let message = responseText || `Device returned HTTP ${response.status}`
      try {
        const payload = JSON.parse(responseText) as { error?: string }
        message = payload.error || message
      } catch {
        // Keep the plain-text response.
      }
      throw new Error(message)
    }

    otaMessage.value = 'Upload verified. The device is rebooting into the new firmware.'
    toast.add({ title: 'OTA update accepted', description: otaMessage.value, icon: 'i-lucide-check', color: 'success' })
    notifyInfo('OTA update accepted', otaMessage.value)
  } catch (error) {
    otaMessage.value = error instanceof Error ? error.message : 'OTA upload failed.'
  } finally {
    isUploadingOta.value = false
  }
}
</script>

<template>
  <UDashboardPanel id="firmware" class="bg-default" :ui="{ root: 'pt-16' }">
    <template #body>
      <div class="mx-auto w-full max-w-[1400px] space-y-6 px-4 pb-16 sm:px-6 lg:px-10">
        <PageHero
          title="Firmware & OTA updates"
          description="Upload a firmware image over WiFi. The device validates its SHA-256 hash and, when required by its lock level, an Ed25519 signature."
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
            description="USB/WebSerial flashing is not implemented in this app."
            icon="i-lucide-usb"
            heading="md"
          >
            <UAlert color="warning" icon="i-lucide-usb" title="No USB flash action available">
              This page does not write firmware over USB. Use the supported OTA upload below, or use an external flashing tool for first install and recovery.
            </UAlert>
          </ContentSection>

          <ContentSection
            title="Update over WiFi (OTA)"
            description="Upload a .bin image through the self-hosted app proxy to the connected device."
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
                v-if="isSimulated"
                color="warning"
                icon="i-lucide-info"
                title="Simulation mode"
              >
                Simulated connections cannot install firmware. Switch to a real device connection to use OTA.
              </UAlert>

              <div class="space-y-4 rounded-lg border border-default bg-elevated/40 p-4">
                <label class="block space-y-2 text-sm text-muted">
                  <span>Firmware binary (.bin)</span>
                  <input
                    ref="otaFileInput"
                    type="file"
                    accept=".bin,application/octet-stream"
                    class="block w-full text-sm"
                    :disabled="isUploadingOta"
                    @change="selectOtaFile"
                  >
                </label>
                <div v-if="otaFile" class="space-y-1 text-xs text-muted">
                  <p>
                    {{ otaFile.name }} · {{ (otaFile.size / 1024 / 1024).toFixed(2) }} MiB
                  </p>
                  <p class="break-all font-mono">
                    SHA-256: {{ otaHash || 'Computing…' }}
                  </p>
                </div>
                <label class="block space-y-2 text-sm text-muted">
                  <span>Ed25519 signature (base64; required by the device at lock level ≥ 1)</span>
                  <textarea
                    v-model="otaSignature"
                    class="w-full rounded-md border border-default bg-default px-3 py-2 font-mono text-xs"
                    rows="3"
                    autocomplete="off"
                    spellcheck="false"
                    :disabled="isUploadingOta"
                    placeholder="Paste a signature over the SHA-256 digest, if required"
                  />
                </label>
                <UAlert
                  v-if="otaMessage"
                  :color="otaMessage.startsWith('Upload verified') ? 'success' : 'error'"
                  icon="i-lucide-info"
                  :description="otaMessage"
                />
                <UButton
                  color="primary"
                  size="lg"
                  class="w-full"
                  icon="i-lucide-upload"
                  :label="isUploadingOta ? 'Uploading and verifying…' : 'Upload firmware over WiFi'"
                  :disabled="!isEspConnected || !isWifiTransport || isSimulated || !otaFile || !otaHash || isUploadingOta"
                  :loading="isUploadingOta"
                  @click="uploadOTA"
                />
                <p class="text-xs text-muted">
                  The device verifies the complete binary hash and enforces signature requirements from its lock level. Failed or interrupted uploads do not select the new partition.
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
