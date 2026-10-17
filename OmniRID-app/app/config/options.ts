export const idTypeOptions = [
  { label: 'Serial number (ANSI/CTA-2063)', value: 'serial' },
  { label: 'CAA registration', value: 'caa' },
  { label: 'UTM UUID', value: 'utm' },
  { label: 'Session ID', value: 'session' }
]

export const uaTypeOptions = [
  { label: 'Helicopter / Multirotor', value: 'multirotor' },
  { label: 'Aeroplane', value: 'aeroplane' },
  { label: 'Fixed wing', value: 'fixed' },
  { label: 'Other', value: 'other' }
]

export const lockLevelOptions = [
  { label: '0 - Normal', value: '0' },
  { label: '1 - Signed commands', value: '1' },
  { label: '2 - Permanent eFuse', value: '2' }
]

export const sessionTimeoutOptions = [
  { label: '5 minutes', value: '5' },
  { label: '15 minutes', value: '15' },
  { label: '30 minutes', value: '30' },
  { label: '60 minutes', value: '60' },
  { label: 'Never', value: '0' }
]

export const uartPortOptions = [
  { label: 'UART 0', value: '0' },
  { label: 'UART 1', value: '1' },
  { label: 'UART 2', value: '2' }
]

export const uartBaudOptions = ['9600', '19200', '38400', '57600', '115200', '230400', '460800', '921600']
  .map(value => ({ label: value, value }))

export const canBitrateOptions = [
  { label: '125 kbps', value: '125000' },
  { label: '250 kbps', value: '250000' },
  { label: '500 kbps', value: '500000' },
  { label: '1 Mbps', value: '1000000' }
]
