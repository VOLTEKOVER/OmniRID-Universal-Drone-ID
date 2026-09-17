import { useTelemetryStore } from '~/stores/telemetry'
import { BLECapture, SerialCapture, importPcapFile } from '~/utils/capture'
import type { CaptureData } from '~/utils/tracker'

let bleCapture: BLECapture | null = null
let serialCapture: SerialCapture | null = null

function wireCaptures(cb: (data: CaptureData) => void) {
  if (!bleCapture) {
    bleCapture = new BLECapture()
    bleCapture.onPacket = cb
  }
  if (!serialCapture) {
    serialCapture = new SerialCapture()
    serialCapture.onPacket = cb
  }
}

export function useCapture() {
  const telemetry = useTelemetryStore()
  const onData = (data: CaptureData) => telemetry.addCapture(data)

  wireCaptures(onData)

  const bleAvailable = () => !!bleCapture?.available
  const serialAvailable = () => !!serialCapture?.available

  const toggleBle = async (): Promise<boolean> => {
    if (!bleCapture) return false
    if (bleCapture.running) {
      bleCapture.stop()
      telemetry.setBleActive(false)
      return false
    }
    const ok = await bleCapture.start()
    telemetry.setBleActive(ok)
    if (!ok) telemetry.setError('Web Bluetooth non disponibile o scan fallito')
    return ok
  }

  const toggleSerial = async (baud = 115200): Promise<boolean> => {
    if (!serialCapture) return false
    if (serialCapture.running) {
      serialCapture.stop()
      telemetry.setSerialActive(false)
      return false
    }
    const ok = await serialCapture.start(baud)
    telemetry.setSerialActive(ok)
    if (!ok) telemetry.setError('Web Serial non disponibile o connessione fallita')
    return ok
  }

  const importPcap = async (file: File): Promise<number> => {
    try {
      const results = await importPcapFile(file)
      for (const r of results) telemetry.addCapture(r)
      telemetry.setPcapFilename(file.name)
      return results.length
    } catch (e) {
      telemetry.setError(`Import PCAP fallito: ${(e as Error).message}`)
      return 0
    }
  }

  return {
    telemetry,
    bleAvailable,
    serialAvailable,
    toggleBle,
    toggleSerial,
    importPcap,
  }
}