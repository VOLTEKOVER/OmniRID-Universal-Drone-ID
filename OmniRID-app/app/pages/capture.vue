<script setup lang="ts">
import { useCapture } from '~/composables/useCapture'
import { useTelemetryStore } from '~/stores/telemetry'

const telemetry = useTelemetryStore()
const { bleAvailable, serialAvailable, toggleBle, toggleSerial, importPcap } = useCapture()

const busy = ref(false)
const fileRef = ref<File | null>(null)
const importedCount = ref(0)

const onPcapChange = async (event: Event) => {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  fileRef.value = file
  busy.value = true
  importedCount.value = await importPcap(file)
  busy.value = false
  input.value = ''
}

const toggleSerialUi = async () => {
  busy.value = true
  await toggleSerial()
  busy.value = false
}
</script>

<template>
  <div class="flex flex-col gap-4">
    <div>
      <h1 class="text-xl font-bold">Cattura</h1>
      <p class="text-sm text-muted">Sorgenti di acquisizione OpenDroneID (ASTM F3411-22a)</p>
    </div>

    <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
      <!-- PCAP -->
      <UCard>
        <template #header>
          <div class="flex items-center gap-2">
            <UIcon name="i-tabler-file-upload" class="w-4 h-4 text-primary-500" />
            <span class="text-sm font-semibold">PCAP (WiFi offline)</span>
          </div>
        </template>
        <p class="text-sm text-muted mb-3">
          Analisi offline di file PCAP catturati in monitor mode. Usalo dove manca Web Bluetooth/Serial.
        </p>
        <UButton
          color="primary"
          variant="soft"
          icon="i-tabler-upload"
          :loading="busy"
          tag="label"
          block
        >
          <input type="file" accept=".pcap" class="hidden" @change="onPcapChange" />
          Scegli file .pcap
        </UButton>
        <p v-if="fileRef" class="text-xs text-muted mt-2 font-mono">{{ fileRef.name }} — {{ importedCount }} pacchetti</p>
      </UCard>

      <!-- BLE -->
      <UCard>
        <template #header>
          <div class="flex items-center gap-2">
            <UIcon name="i-tabler-brand-bluetooth" class="w-4 h-4 text-primary-500" />
            <span class="text-sm font-semibold">Bluetooth LE</span>
          </div>
        </template>
        <p class="text-sm text-muted mb-3">
          Scansione BLE live (Web Bluetooth, solo Chrome 117+/Edge). Riceve manufacturer data OpenDroneID.
        </p>
        <UAlert v-if="!bleAvailable()" color="amber" variant="subtle" icon="i-tabler-alert-triangle" title="Web Bluetooth non disponibile" description="Usa Chrome o Edge recenti su HTTPS." class="mb-3" />
        <UButton
          :color="telemetry.bleActive ? 'red' : 'primary'"
          :icon="telemetry.bleActive ? 'i-tabler-player-stop' : 'i-tabler-brand-bluetooth'"
          :label="telemetry.bleActive ? 'Stop scan' : 'Avvia scan BLE'"
          block
          @click="toggleBle()"
        />
      </UCard>

      <!-- Serial -->
      <UCard>
        <template #header>
          <div class="flex items-center gap-2">
            <UIcon name="i-tabler-cable" class="w-4 h-4 text-primary-500" />
            <span class="text-sm font-semibold">Seriale (COM)</span>
          </div>
        </template>
        <p class="text-sm text-muted mb-3">
          Lettura da ricevitore seriale JSON (es. ESP32 bridge tramite UART). Web Serial usa la porta scelta in Impostazioni.
        </p>
        <UAlert v-if="!serialAvailable()" color="amber" variant="subtle" icon="i-tabler-alert-triangle" title="Web Serial non disponibile" description="Usa Chrome 89+ su HTTPS." class="mb-3" />
        <UButton
          :color="telemetry.serialActive ? 'red' : 'primary'"
          :icon="telemetry.serialActive ? 'i-tabler-player-stop' : 'i-tabler-cable'"
          :label="telemetry.serialActive ? 'Disconnetti' : 'Connetti seriale'"
          :loading="busy"
          block
          @click="toggleSerialUi"
        />
      </UCard>
    </div>
  </div>
</template>