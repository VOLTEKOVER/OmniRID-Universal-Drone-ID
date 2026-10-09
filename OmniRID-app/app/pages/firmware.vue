<script setup lang="ts">
import type { PageBadgeColor } from '~/components/PageHero.vue'
import { firmwareQuickSteps, installTargets, processSteps } from '~/config/content'
import { appInstallerUrl } from '~/config/app'
import { pageForRoute, pageStatusMeta } from '~/pages.config'

const { settings } = useAppSettings()
const { espIp, isEspConnected, isChecking, lastError, refresh } = useEspConnection()
const route = useRoute()

const selectedTarget = ref('esp32')
const heroBadges: { label: string, color?: PageBadgeColor }[] = [
  { label: 'Install', color: 'primary' },
  { label: 'OTA', color: 'info' }
]
const quickStartItems = firmwareQuickSteps.map((title, index) => ({ value: index + 1, title }))
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
    .then(hash => {
      expectedSha.value = hash
    })
    .catch(() => {
      hashingNotice.value = 'Could not hash the selected file'
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
    } else {
      uploadError.value = readOtaError(xhr.responseText) ?? `Upload failed (HTTP ${xhr.status}).`
    }
  }
  xhr.onerror = () => {
    isUploading.value = false
    uploadError.value = 'Upload failed — the device became unreachable. Keep it powered and retry.'
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
      <div class="mx-auto w-full max-w-7xl space-y-8 pb-8">
        <PageHero
          title="Firmware & OTA updates"
          description="Flash OmniRID firmware over USB with WebSerial, or push an update to the connected device directly over WiFi with built-in SHA-256 verification."
          :badges="heroBadges"
          :status="heroStatus"
        >
          <template #right>
            <UButton to="/" color="neutral" variant="outline" size="lg" icon="i-lucide-arrow-left" label="Back to home" />
          </template>
        </PageHero>

        <section class="grid gap-6 lg:grid-cols-2">
          <div class="rounded-2xl border border-default bg-default p-5 sm:p-6">
            <div class="mb-4 flex items-center gap-3">
              <div class="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary ring-1 ring-primary/20">
                <UIcon name="i-lucide-usb" class="size-5" />
              </div>
              <div>
                <h2 class="text-xl font-bold text-highlighted">Install via USB</h2>
                <p class="text-sm text-muted">First flash or recovery using WebSerial, straight from the browser.</p>
              </div>
            </div>

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
              </div>

              <div class="rounded-xl border border-primary/20 bg-primary/5 p-4">
                <p class="text-[10px] uppercase tracking-[0.22em] text-muted">Selected target</p>
                <p class="mt-2 text-lg font-semibold text-highlighted">
                  {{ installTargets.find(target => target.value === selectedTarget)?.name }}
                </p>
              </div>

              <div class="rounded-xl border border-default bg-elevated/40 p-4">
                <p class="text-sm font-medium text-highlighted">Quick start</p>
                <UTimeline :items="quickStartItems">
                  <template #indicator="{ item }">
                    <span class="mt-0.5 inline-flex size-5 items-center justify-center rounded-full bg-primary/10 text-[10px] font-semibold text-primary">{{ item.value }}</span>
                  </template>
                </UTimeline>
              </div>

              <UAlert color="info" icon="i-lucide-globe" title="HTTPS required for WebSerial">
                Serial access only works from a secure context (HTTPS or localhost). The GitHub Pages installer is HTTPS-ready and includes ESP32, ESP32-S3 and ESP32-C6 targets.
              </UAlert>

              <UButton
                v-if="!settings.disableInternet"
                color="primary"
                size="lg"
                class="w-full"
                icon="i-lucide-download"
                label="Install with browser"
                :to="appInstallerUrl"
                target="_blank"
              />
              <UButton
                v-else
                color="neutral"
                size="lg"
                class="w-full"
                icon="i-lucide-wifi-off"
                label="Internet access is disabled"
                disabled
              />
            </div>
          </div>

          <div class="rounded-2xl border border-default bg-default p-5 sm:p-6">
            <div class="mb-4 flex items-center gap-3">
              <div class="flex size-10 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-500 ring-1 ring-emerald-500/20">
                <UIcon name="i-lucide-cloud-upload" class="size-5" />
              </div>
              <div>
                <h2 class="text-xl font-bold text-highlighted">Update over WiFi (OTA)</h2>
                <p class="text-sm text-muted">Push a new <code>.bin</code> to the connected device — no USB needed.</p>
              </div>
            </div>

            <div class="space-y-4">
              <div class="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-default bg-elevated/40 p-4">
                <div class="flex items-center gap-3">
                  <span class="relative flex size-2.5">
                    <span v-if="isEspConnected" class="absolute inline-flex size-full animate-ping rounded-full bg-emerald-500 opacity-60" />
                    <span class="relative inline-flex size-2.5 rounded-full" :class="isEspConnected ? 'bg-emerald-500' : isChecking ? 'bg-amber-500' : 'bg-red-500'" />
                  </span>
                  <div>
                    <p class="text-sm font-medium text-highlighted">{{ isEspConnected ? 'Device connected' : isChecking ? 'Checking connection…' : 'Device offline' }}</p>
                    <p class="truncate text-xs text-muted" :title="espIp">{{ espIp }}</p>
                  </div>
                </div>
                <UButton size="sm" color="neutral" variant="outline" icon="i-lucide-refresh-cw" label="Re-check" :loading="isChecking" @click="refresh()" />
              </div>

              <UAlert v-if="!isEspConnected" color="warning" icon="i-lucide-wifi-off" title="Connect first">
                The update is sent straight to the device. Make sure it is powered, reachable at <code class="break-all">{{ espIp }}</code>, and your computer is connected to its WiFi network.
              </UAlert>
              <UAlert v-else-if="lastError" color="error" icon="i-lucide-alert-circle" title="Connection problem" :description="lastError" />

              <p v-if="!isEspConnected" class="text-sm leading-6 text-muted">
                Once connected, pick a <code>.bin</code> firmware built for your target ({{ targetNames }}). This page hashes the file (SHA-256) and uploads it to the device <code>/ota</code> endpoint.
              </p>

              <template v-else>
                <div
                  role="button"
                  tabindex="0"
                  class="flex cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-default bg-elevated/40 px-4 py-8 text-center transition hover:border-primary/40 hover:bg-primary/5 focus-visible:outline-primary/40"
                  :class="dragActive && 'border-primary/60 bg-primary/5'"
                  @click="fileInput?.click()"
                  @keydown.enter="fileInput?.click()"
                  @dragover.prevent="dragActive = true"
                  @dragleave.prevent="dragActive = false"
                  @drop.prevent="onDrop"
                >
                  <div class="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary ring-1 ring-primary/20">
                    <UIcon name="i-lucide-file-up" class="size-5" />
                  </div>
                  <div>
                    <p class="text-sm font-medium text-highlighted">Drop a firmware <code>.bin</code> file or click to browse</p>
                    <p class="mt-1 text-xs text-muted">Must be built for {{ targetNames }}. Anything else is rejected by the device.</p>
                  </div>
                  <input ref="fileInput" type="file" accept=".bin,application/octet-stream" class="hidden" @change="onFileChange" />
                </div>

                <div v-if="selectedFile" class="rounded-xl border border-default bg-elevated/40 p-4">
                  <div class="flex items-start justify-between gap-3">
                    <div class="min-w-0">
                      <p class="truncate text-sm font-semibold text-highlighted" :title="selectedFile.name">{{ selectedFile.name }}</p>
                      <p class="mt-1 text-xs text-muted">{{ formatBytes(selectedFile.size) }}</p>
                      <p class="mt-2 text-[11px] text-muted">
                        <span v-if="isHashing">Computing SHA-256…</span>
                        <span v-else-if="expectedSha" class="font-mono" :title="`Full SHA-256: ${expectedSha}`">SHA-256 {{ expectedSha.slice(0, 12) }}…</span>
                        <span v-else-if="hashingNotice" class="text-red-500">{{ hashingNotice }}</span>
                        <span v-else class="text-red-500">SHA-256 unavailable</span>
                      </p>
                    </div>
                    <UButton size="sm" color="neutral" variant="outline" icon="i-lucide-x" aria-label="Remove file" :disabled="isUploading" @click="clearFile" />
                  </div>
                  <UProgress v-if="isUploading || uploadMessage" :value="uploadProgress" size="sm" color="primary" class="mt-3" />
                  <p v-if="isUploading" class="mt-2 text-xs text-muted">Uploading — keep the device powered… {{ uploadProgress }}%</p>
                </div>

                <UAlert v-if="uploadError" color="error" icon="i-lucide-alert-circle" title="Upload failed" :description="uploadError" />
                <UAlert v-else-if="uploadMessage" color="success" icon="i-lucide-circle-check" title="Update applied" :description="uploadMessage" />

                <UAlert color="warning" icon="i-lucide-shield-alert" title="Locked devices (lock level 1+)">
                  The server also requires a valid Ed25519 signature (<code>X-Signature</code>) when the device is locked. This page cannot sign uploads for locked devices — flash those via USB instead.
                </UAlert>

                <UButton
                  color="primary"
                  size="lg"
                  class="w-full"
                  icon="i-lucide-upload"
                  :label="isUploading ? 'Uploading…' : 'Upload firmware'"
                  :disabled="!expectedSha || isUploading"
                  @click="startUpload"
                />

                <p class="text-xs leading-5 text-muted">
                  A 1 MB image takes roughly 30 seconds. The device verifies the SHA-256 hash (and the signature when locked), writes to the <code>ota_0</code> partition and reboots automatically. A failed update rolls back to the factory firmware; you can always recover via USB.
                </p>
              </template>
            </div>
          </div>
        </section>

        <ContentSection caption="Process" title="Firmware installation flow" description="Everything tied to flashing, setup and validation lives here.">
          <div class="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <UCard v-for="step in processSteps" :key="step.name" class="h-full" :ui="{ body: 'p-4' }">
              <div class="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary ring-1 ring-primary/15">
                <UIcon :name="step.icon" class="size-4" />
              </div>
              <h3 class="mt-4 text-base font-semibold text-highlighted">{{ step.name }}</h3>
              <p class="mt-2 text-sm leading-6 text-muted">{{ step.detail }}</p>
            </UCard>
          </div>
        </ContentSection>
      </div>
    </template>
  </UDashboardPanel>
</template>