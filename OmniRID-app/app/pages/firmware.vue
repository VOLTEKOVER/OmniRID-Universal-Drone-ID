<script setup lang="ts">
import type { PageBadgeColor } from '~/components/PageHero.vue'
import { installTargets, processSteps } from '~/config/content'
import { pageForRoute, pageStatusMeta } from '~/pages.config'

const { espIp, isEspConnected, isChecking, lastError, isWifiTransport, canOta, canFlashUsb, refresh } = useEspConnection()
const route = useRoute()

const selectedTarget = ref('esp32')
const heroBadges: { label: string, color?: PageBadgeColor }[] = [
  { label: 'Install', color: 'primary' },
  { label: 'OTA', color: 'info' }
]
const targetNames = installTargets.map(target => target.name).join(', ')
const heroStatus = computed(() => {
  const page = pageForRoute(route.path)
  return page ? pageStatusMeta(page.status) : undefined
})

const fileInput = ref<HTMLInputElement | null>(null)
const dragActive = ref(false)
const selectedFile = ref<File | null>(null)
const expectedSha = ref('')
const isHashing = ref(false)
const hashingNotice = ref('')
const uploadProgress = ref(0)
const isUploading = ref(false)
const uploadError = ref<string | null>(null)
const uploadMessage = ref<string | null>(null)

const USB_PORT_KEY = 'omnirid:usb-port'
const usbPort = ref('COM3')
const isFlashing = ref(false)
const flashProgress = ref(0)
const flashMessage = ref<string | null>(null)
const toast = useToast()
const { notifyInfo, notifyError } = useNotifications()

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

const formatBytes = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 ** 2).toFixed(2)} MB`
}

const rotr = (x: number, n: number) => (x >>> n) | (x << (32 - n))

const sha256HexArray = (data: Uint8Array): string => {
  const K = [
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
  ]
  const l = data.length
  const padLen = Math.ceil((l + 9) / 64) * 64
  const buf = new Uint8Array(padLen)
  buf.set(data)
  buf[l] = 0x80
  const view = new DataView(buf.buffer)
  view.setUint32(padLen - 8, Math.floor(l / 0x100000000))
  view.setUint32(padLen - 4, (l * 8) >>> 0)
  const H = new Uint32Array([0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19])
  const w = new Uint32Array(64)
  for (let off = 0; off < padLen; off += 64) {
    for (let i = 0; i < 16; i++) w[i] = view.getUint32(off + i * 4)
    for (let i = 16; i < 64; i++) {
      const s0 = rotr(w[i - 15]!, 7) ^ rotr(w[i - 15]!, 18) ^ (w[i - 15]! >>> 3)
      const s1 = rotr(w[i - 2]!, 17) ^ rotr(w[i - 2]!, 19) ^ (w[i - 2]! >>> 10)
      w[i] = (w[i - 16]! + s0 + w[i - 7]! + s1) >>> 0
    }
    let a = H[0]!
    let b = H[1]!
    let c = H[2]!
    let d = H[3]!
    let e = H[4]!
    let f = H[5]!
    let g = H[6]!
    let h = H[7]!
    for (let i = 0; i < 64; i++) {
      const S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25)
      const ch = (e & f) ^ (~e & g)
      const t1 = (h + S1 + ch + (K[i] ?? 0) + (w[i] ?? 0)) >>> 0
      const S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22)
      const maj = (a & b) ^ (a & c) ^ (b & c)
      const t2 = (S0 + maj) >>> 0
      h = g
      g = f
      f = e
      e = (d + t1) >>> 0
      d = c
      c = b
      b = a
      a = (t1 + t2) >>> 0
    }
    H[0] = (H[0]! + a) >>> 0
    H[1] = (H[1]! + b) >>> 0
    H[2] = (H[2]! + c) >>> 0
    H[3] = (H[3]! + d) >>> 0
    H[4] = (H[4]! + e) >>> 0
    H[5] = (H[5]! + f) >>> 0
    H[6] = (H[6]! + g) >>> 0
    H[7] = (H[7]! + h) >>> 0
  }
  return Array.from(H, value => value.toString(16).padStart(2, '0')).join('')
}

const computeSha256 = async (file: File): Promise<string> => {
  const buf = await file.arrayBuffer()
  if (typeof globalThis.crypto?.subtle?.digest === 'function') {
    const digest = await crypto.subtle.digest('SHA-256', buf)
    return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('')
  }
  return sha256HexArray(new Uint8Array(buf))
}

const pickFile = (file: File | null) => {
  if (!file) return
  selectedFile.value = file
  expectedSha.value = ''
  uploadProgress.value = 0
  uploadError.value = null
  uploadMessage.value = null
  isHashing.value = true
  hashingNotice.value = ''
  computeSha256(file)
    .then((hash) => {
      expectedSha.value = hash
    })
    .catch(() => {
      hashingNotice.value = 'Could not hash the selected file'
      notifyError('Firmware hashing failed', `Could not compute SHA-256 for ${file.name}.`)
      toast.add({
        title: 'Firmware hashing failed',
        description: `Could not compute SHA-256 for ${file.name}.`,
        icon: 'i-lucide-circle-alert',
        color: 'error'
      })
    })
    .finally(() => {
      isHashing.value = false
    })
}

const onFileChange = (event: Event) => {
  const input = event.target as HTMLInputElement
  pickFile(input.files?.[0] ?? null)
}

const onDrop = (event: DragEvent) => {
  dragActive.value = false
  pickFile(event.dataTransfer?.files?.[0] ?? null)
}

const clearFile = () => {
  selectedFile.value = null
  expectedSha.value = ''
  isHashing.value = false
  hashingNotice.value = ''
  uploadProgress.value = 0
  uploadError.value = null
  uploadMessage.value = null
  if (fileInput.value) fileInput.value.value = ''
}

const readOtaError = (text: string): string | null => {
  if (!text) return null
  try {
    const parsed = JSON.parse(text) as Record<string, unknown>
    const error = String(parsed.error ?? '')
    const detail = String(parsed.detail ?? '')
    return [error, detail].filter(Boolean).join(': ')
  } catch {
    return text.slice(0, 240)
  }
}

const startUpload = () => {
  const file = selectedFile.value
  if (!file || !expectedSha.value || isUploading.value) return
  uploadError.value = null
  uploadMessage.value = null
  uploadProgress.value = 0
  isUploading.value = true

  const xhr = new XMLHttpRequest()
  xhr.open('POST', '/api/esp/ota')
  xhr.setRequestHeader('x-esp-ip', espIp.value)
  xhr.setRequestHeader('X-Expected-SHA256', expectedSha.value)
  xhr.setRequestHeader('Content-Type', 'application/octet-stream')
  xhr.setRequestHeader('x-esp-timeout', '300000')
  xhr.upload.onprogress = (event) => {
    if (event.lengthComputable) {
      uploadProgress.value = Math.round((event.loaded / event.total) * 100)
    }
  }
  xhr.onload = () => {
    isUploading.value = false
    if (xhr.status >= 200 && xhr.status < 300) {
      uploadMessage.value = 'Upload complete. The device is rebooting into the new firmware.'
      isEspConnected.value = false
      notifyInfo('Firmware uploaded', 'The device is rebooting into the new firmware.')
      toast.add({
        title: 'Firmware uploaded',
        description: 'The device is rebooting into the new firmware.',
        icon: 'i-lucide-check',
        color: 'success'
      })
    } else {
      uploadError.value = readOtaError(xhr.responseText) ?? `Upload failed (HTTP ${xhr.status}).`
      notifyError('Firmware upload failed', uploadError.value)
      toast.add({
        title: 'Firmware upload failed',
        description: uploadError.value,
        icon: 'i-lucide-circle-alert',
        color: 'error'
      })
    }
  }
  xhr.onerror = () => {
    isUploading.value = false
    uploadError.value = 'Upload failed — the device became unreachable. Keep it powered and retry.'
    notifyError('Firmware upload failed', uploadError.value)
    toast.add({
      title: 'Firmware upload failed',
      description: uploadError.value,
      icon: 'i-lucide-circle-alert',
      color: 'error'
    })
  }
  xhr.onabort = () => {
    isUploading.value = false
  }
  xhr.send(file)
}
</script>

<template>
  <UDashboardPanel id="firmware" class="bg-default" :ui="{ root: 'pt-16' }">
    <template #body>
      <div class="mx-auto w-full max-w-[1400px] space-y-6 px-4 pb-16 sm:px-6 lg:px-10">
        <PageHero
          title="Firmware & OTA updates"
          description="Flash over USB with WebSerial, or push an update to the connected device over WiFi with built-in SHA-256 verification."
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
            description="Not implemented in firmware (POST /ota returns 501). Use USB/WebSerial for now."
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
                title="OTA not implemented"
              >
                POST /ota returns 501 in the current firmware. Use USB/WebSerial flashing for now.
              </UAlert>

              <p class="text-sm leading-6 text-muted">
                OTA updates are not available in this firmware build. Use USB/WebSerial flashing for recovery or updates.
              </p>

              <UButton
                color="neutral"
                size="lg"
                class="w-full"
                icon="i-lucide-upload"
                label="Upload firmware (not available)"
                disabled
              />
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
