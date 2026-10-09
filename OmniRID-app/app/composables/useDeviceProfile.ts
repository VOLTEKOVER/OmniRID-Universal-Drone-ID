export type DeviceProtocol = 'auto' | 'mavlink' | 'msp' | 'nmea' | 'none'
export type DeviceRegion = 'auto' | 'eur' | 'faa' | 'jpn' | 'can' | 'aus' | 'nzl' | 'chn'
export type DeviceTarget = 'esp32' | 'esp32s3' | 'esp32c6'

export const targetOptions = [
  { label: 'ESP32', value: 'esp32' },
  { label: 'ESP32-S3', value: 'esp32s3' },
  { label: 'ESP32-C6', value: 'esp32c6' }
]

export const protocolOptions = [
  { label: 'Auto-detect', value: 'auto' },
  { label: 'MAVLink', value: 'mavlink' },
  { label: 'MSP', value: 'msp' },
  { label: 'NMEA', value: 'nmea' },
  { label: 'None / demo mode', value: 'none' }
]

export const regionOptions = [
  { label: 'Auto-detect', value: 'auto' },
  { label: 'Europe (EASA/EEA)', value: 'eur' },
  { label: 'USA (FAA Part 89)', value: 'faa' },
  { label: 'Japan (MLIT)', value: 'jpn' },
  { label: 'Canada', value: 'can' },
  { label: 'Australia', value: 'aus' },
  { label: 'New Zealand', value: 'nzl' },
  { label: 'China (GB 42590)', value: 'chn' }
]

export const useDeviceProfile = () => {
  const protocol = useState<DeviceProtocol>('device-protocol', () => 'auto')
  const region = useState<DeviceRegion>('device-region', () => 'auto')
  const target = useState<DeviceTarget>('device-target', () => 'esp32')

  const protocolLabel = computed(() => protocolOptions.find(option => option.value === protocol.value)?.label ?? 'Auto-detect')
  const regionLabel = computed(() => regionOptions.find(option => option.value === region.value)?.label ?? 'Auto-detect')
  const hasFlightController = computed(() => protocol.value !== 'none')
  const supportsMavlink = computed(() => protocol.value === 'auto' || protocol.value === 'mavlink')
  const supportsMsp = computed(() => protocol.value === 'auto' || protocol.value === 'msp')
  const supportsNmea = computed(() => protocol.value === 'auto' || protocol.value === 'nmea')
  const supportsSecondBasicId = computed(() => region.value !== 'chn')
  const requiresOperatorId = computed(() => ['auto', 'eur', 'faa', 'can', 'aus'].includes(region.value))
  const supportsBle5 = computed(() => target.value === 'esp32s3')
  const supportsMavlinkUsb = computed(() => target.value !== 'esp32')

  return {
    protocol,
    region,
    target,
    protocolLabel,
    regionLabel,
    hasFlightController,
    supportsMavlink,
    supportsMsp,
    supportsNmea,
    supportsSecondBasicId,
    requiresOperatorId,
    supportsBle5,
    supportsMavlinkUsb
  }
}
