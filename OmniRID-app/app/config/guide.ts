export type GuideFlow
  = | { kind: 'guard', entry: string, noData: string, checks: { label: string, ok: string }[], fallback: string, caption: string }
    | { kind: 'linear', nodes: { label: string, sub?: string }[], failure?: { to: string, note: string }, caption: string }
    | { kind: 'pack', messages: { id: string, label: string, lines: string }[], transports: { name: string, lines: string, note?: string }[], caption: string }

export type GuideBlock
  = | { type: 'h', text: string }
    | { type: 'p', html: string }
    | { type: 'callout', tone: 'info' | 'warning', title: string, html: string }
    | { type: 'ul', items: string[] }
    | { type: 'ol', items: string[] }
    | { type: 'code', code: string }
    | { type: 'table', caption?: string, cols: string[], rows: string[][] }
    | { type: 'tables', caption?: string, groups: { title: string, rows: string[][] }[] }
    | { type: 'flow', flow: GuideFlow }

export interface GuideSection {
  id: string
  number: number
  title: string
  icon: string
  intro?: string
  blocks: GuideBlock[]
}

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#39;|&apos;/g, '\'')
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ')
    .trim()
}

export function sectionSearchText(section: GuideSection): string {
  const parts: string[] = []
  if (section.intro) parts.push(stripHtml(section.intro))
  for (const block of section.blocks) {
    switch (block.type) {
      case 'h':
        parts.push(block.text)
        break
      case 'p':
        parts.push(stripHtml(block.html))
        break
      case 'callout':
        parts.push(block.title, stripHtml(block.html))
        break
      case 'ul':
      case 'ol':
        parts.push(...block.items.map(stripHtml))
        break
      case 'code':
        parts.push(block.code)
        break
      case 'table':
        if (block.caption) parts.push(block.caption)
        parts.push(block.cols.join(' '), ...block.rows.flat().map(stripHtml))
        break
      case 'tables':
        if (block.caption) parts.push(block.caption)
        for (const group of block.groups) parts.push(group.title, ...group.rows.flat().map(stripHtml))
        break
      case 'flow':
        switch (block.flow.kind) {
          case 'guard':
            parts.push(block.flow.entry, block.flow.noData, ...block.flow.checks.flatMap(c => [c.label, c.ok]), block.flow.fallback, block.flow.caption)
            break
          case 'linear':
            parts.push(...block.flow.nodes.flatMap(n => [n.label, n.sub ?? '']))
            if (block.flow.failure) parts.push(block.flow.failure.to, block.flow.failure.note)
            parts.push(block.flow.caption)
            break
          case 'pack':
            parts.push(...block.flow.messages.flatMap(m => [m.id, m.label, m.lines]))
            parts.push(...block.flow.transports.flatMap(t => [t.name, t.lines ?? '']))
            parts.push(block.flow.caption)
            break
        }
        break
    }
  }
  return parts.map(stripHtml).filter(Boolean).join(' ')
}

export const guideSections: GuideSection[] = [
  {
    id: 'protocols',
    number: 1,
    title: 'Protocol Reference',
    icon: 'i-lucide-radio-tower',
    blocks: [
      {
        type: 'h',
        text: 'Protocol Auto-Detection'
      },
      {
        type: 'p',
        html: 'The OmniRID identifies the UART protocol by looking for specific headers. In auto mode (the default, <code>protocol = 255</code>) detection runs continuously and is re-evaluated on every loop iteration, reading up to 50 ms of UART data per pass. The headers are checked in this order:'
      },
      {
        type: 'flow',
        flow: {
          kind: 'guard',
          entry: 'Boot / Reset → Read UART up to 50 ms',
          noData: 'no data → Main loop',
          checks: [
            { label: '$M&lt; ? MSP v1 header', ok: 'MSP' },
            { label: '$G or $N prefix? NMEA 0183', ok: 'NMEA' },
            { label: '0xFE or 0xFD? MAVLink v1/v2', ok: 'MAVLink' }
          ],
          fallback: 'Fallback: Unknown (no protocol detected)',
          caption: 'Protocol auto-detection order in auto mode: MSP, then NMEA, then MAVLink. If none match, the protocol remains Unknown until the next loop iteration.',
        }
      },
      {
        type: 'p',
        html: 'In auto mode the detection result is applied immediately and re-evaluated every loop, so it is not stored between cycles. When a fixed protocol is configured (<code>protocol</code> = 1, 2 or 3), the matching parser is used directly without detection.'
      },
      {
        type: 'h',
        text: 'MAVLink (ArduPilot)'
      },
      {
        type: 'p',
        html: 'The firmware parses the following MAVLink v1/v2 messages (dialect: <code>ardupilotmega</code>):'
      },
      {
        type: 'table',
        cols: ['Message', 'ID', 'Data Used', 'Frequency'],
        rows: [
          ['<code>GLOBAL_POSITION_INT</code>', '33', 'Latitude, longitude, altitude (MSL + relative), heading, relative alt', '~5 Hz'],
          ['<code>GPS_RAW_INT</code>', '24', 'Latitude, longitude, altitude (MSL), ground speed, satellites, fix type', '~5 Hz'],
          ['<code>VFR_HUD</code>', '74', 'Ground speed, heading, altitude (baro), climb rate', '~5 Hz'],
          ['<code>ATTITUDE</code>', '30', 'Roll, pitch, yaw (heading)', '~10 Hz'],
          ['<code>AHRS2</code>', '178', 'Secondary heading (ArduPilot), used as fallback', '~5 Hz'],
          ['<code>HEARTBEAT</code>', '0', 'System ID, vehicle type (for auto-detection)', '1 Hz'],
          ['<code>OPEN_DRONE_ID_LOCATION</code>', '12915', 'Pre-encoded ODID location (lat/lon/alt/alt_baro/vel/heading)', '~1 Hz'],
          ['<code>OPEN_DRONE_ID_BASIC_ID</code>', '12900', 'UAS ID, ID type, UA type (overrides config identity)', '~1 Hz'],
          ['<code>OPEN_DRONE_ID_OPERATOR_ID</code>', '12905', 'Operator ID from ground station', '~1 Hz'],
          ['<code>OPEN_DRONE_ID_SELF_ID</code>', '12902', 'Self-ID text description from ground station', '~1 Hz'],
          ['<code>OPEN_DRONE_ID_AUTHENTICATION</code>', '12903', 'Authentication pages from ground station', '~1 Hz'],
          ['<code>OPEN_DRONE_ID_SYSTEM</code>', '12904', 'Operator location (GPS fallback when FC has no fix)', '~1 Hz'],
          ['<code>OPEN_DRONE_ID_MESSAGE_PACK</code>', '12919', 'Packed ODID messages (multiple ODID messages in one MAVLink packet)', '~1 Hz']
        ]
      },
      {
        type: 'p',
        html: 'The MAVLink parser handles both v1 (0xFE start byte) and v2 (0xFD start byte) protocols. The system ID from the first HEARTBEAT message is used if <code>mavlink_sysid = 0</code> (auto-detect). ODID messages override the config identity for compatibility with ArduPilot\u2019s native Remote ID support.'
      },
      {
        type: 'p',
        html: 'By default the firmware only <b>listens</b> on the UART. If the <b>MAVLink arm status</b> or <b>MAVLink operator location loopback</b> option (or <b>MAVLink over USB</b>) is enabled, a bidirectional link is started that sends a MAVLink HEARTBEAT (<code>MAV_TYPE_ODID</code>) every 1 s and republishes the ODID SYSTEM message every 6 s.'
      },
      {
        type: 'h',
        text: 'MAVLink Configuration Tips'
      },
      {
        type: 'ul',
        items: [
          'Set the baud rate to match your ArduPilot serial port (57600 is common).',
          'If using MAVLink v2, ensure the port is configured for MAVLink1 or MAVLink2.',
          'The firmware only <b>listens</b> — it does not send any MAVLink messages, so it will not interfere with your existing telemetry link.'
        ]
      },
      {
        type: 'h',
        text: 'MSP (Betaflight / INAV)'
      },
      {
        type: 'p',
        html: 'The firmware parses the following MSP v1 messages:'
      },
      {
        type: 'table',
        cols: ['Message', 'ID', 'Data Used', 'Notes'],
        rows: [
          ['<code>MSP_RAW_GPS</code>', '106', 'Latitude, longitude, altitude, speed, ground course, satellites, fix type', 'Primary GPS data source'],
          ['<code>MSP_ATTITUDE</code>', '108', 'Roll, pitch, yaw (heading in degrees)', 'Heading for ODID message'],
          ['<code>MSP_STATUS</code>', '101', 'Armed state (bit 0 of flags)', 'Used by the "force arm" option']
        ]
      },
      {
        type: 'p',
        html: 'The MSP parser expects the standard MSP v1 framing: <code>$M&lt;</code> header, size byte, command byte, data payload, checksum. It does not require sending any request to the FC — it passively listens to the FC\u2019s MSP response stream (typically from the FC\u2019s telemetry output).'
      },
      {
        type: 'h',
        text: 'MSP Configuration Tips'
      },
      {
        type: 'ul',
        items: [
          'Enable MSP on the desired UART in the Betaflight Configurator Ports tab.',
          'Set baud rate to match (57600 is common for MSP).',
          'INAV sends MSP_RAW_GPS automatically at ~5 Hz when armed.',
          'Betaflight may require setting <code>serialrx_provider = MSP</code> for continuous GPS output.'
        ]
      },
      {
        type: 'h',
        text: 'NMEA 0183'
      },
      {
        type: 'p',
        html: 'The firmware parses the following NMEA 0183 sentences:'
      },
      {
        type: 'table',
        cols: ['Sentence', 'Type', 'Data Used'],
        rows: [
          ['<code>$GPGGA</code>', 'Global Positioning System Fix Data', 'Latitude, longitude, altitude (MSL), fix quality (0/1/2), satellites, HDOP'],
          ['<code>$GPRMC</code>', 'Recommended Minimum Specific GNSS Data', 'Speed over ground (knots → m/s), ground course, date, status (A=valid)'],
          ['<code>$GPVTG</code>', 'Course Over Ground and Ground Speed', 'Ground speed (km/h → m/s), course over ground (true)']
        ]
      },
      {
        type: 'p',
        html: 'The NMEA parser handles both <code>$GP</code> (GPS) and <code>$GN</code> (GNSS) prefixes. It does not validate the checksum field (the part after the <code>*</code>): sentences are parsed line by line and malformed or unrecognized sentences are silently discarded.'
      },
      {
        type: 'h',
        text: 'NMEA Configuration Tips'
      },
      {
        type: 'ul',
        items: [
          'GPS modules typically output NMEA at 9600 or 115200 baud. Set the baud rate accordingly.',
          'The NMEA mode requires the <b>1 kΩ series resistor</b> on the TX tap line (see Hardware section).',
          'NMEA mode works with any GPS module: BN-880, BN-220, M8N, M10, NEO-6M, NEO-8M, and many others.',
          'The ESP32 can share the GPS TX line with the FC — the resistor prevents the ESP32\u2019s input capacitance from degrading the signal to the FC.'
        ]
      }
    ]
  },
  {
    id: 'installation',
    number: 2,
    title: 'Installation Methods',
    icon: 'i-lucide-download',
    blocks: [
      {
        type: 'h',
        text: 'Method 1: WebSerial (Browser) — Recommended'
      },
      {
        type: 'p',
        html: 'The easiest method. Requires Chrome or Edge on Windows, macOS, or Linux. No Python or toolchain needed.'
      },
      {
        type: 'ol',
        items: [
          'Connect the ESP32 to your computer via USB.',
          'Install the CP2102 or CH340 driver if prompted (Windows usually auto-installs).',
          'Click the <b>install</b> button on the Quick Start page — use the "Go to Quick Start" button in the left column of this guide.',
          'A browser dialog will appear showing available serial ports. Select your ESP32 (usually labeled <code>CP2102 USB to UART Bridge</code> or <code>CH340</code>).',
          'Click <b>Connect</b>. The firmware will download and flash automatically.',
          'Wait for the progress bar to complete and the "Done" message.',
          'Disconnect USB and power the ESP32 from your flight controller\u2019s BEC or a USB power bank.'
        ]
      },
      {
        type: 'callout',
        tone: 'warning',
        title: 'Note',
        html: 'WebSerial requires a secure context (HTTPS or <code>localhost</code>). Self-host the app over HTTPS or run it locally.'
      },
      {
        type: 'h',
        text: 'Method 2: Cargo (Manual Build)'
      },
      {
        type: 'p',
        html: 'For developers or users who want to customize the firmware.'
      },
      {
        type: 'h',
        text: 'Prerequisites'
      },
      {
        type: 'ul',
        items: [
          'Rust stable toolchain (<code>rustup</code>)',
          '(Optional) <code>espup</code> for ESP32 cross-compilation'
        ]
      },
      {
        type: 'h',
        text: 'Build Steps'
      },
      {
        type: 'code',
        code: `git clone https://github.com/VOLTEKOVER/OmniRID-Universal-Drone-ID.git
cd OmniRID-Universal-Drone-ID/OmniRID-firmware

# Host build (for testing)
cargo build --workspace

# Run tests (305 tests)
cargo test --workspace

# Cross-build for ESP32-C6 (requires nightly + rust-src)
cd hardware/bsp-esp32
RUSTC_BOOTSTRAP=1 cargo +nightly build -Z build-std=std,panic_abort \\
  --no-default-features --features esp32c6,hardware --target riscv32imac-esp-espidf

# Flash via espflash (USB/serial)
espflash flash --chip esp32c6 target/riscv32imac-esp-espidf/debug/bsp-esp32`
      },
      {
        type: 'p',
        html: 'CI runs host tests and the ESP32 cross-build matrix on every push (see <code>.github/workflows/esp32-build.yml</code>). Xtensa esp32/esp32s3 links are currently failing; ESP32-C6 is green.'
      },
      {
        type: 'p',
        html: 'If a release provides a <b>merged factory image</b> (<code>*.factory.bin</code>), it can be written with a single esptool call (chip and offset are listed on the release page):'
      },
      {
        type: 'code',
        code: `pip install esptool

# Example: ESP32-C6, merged image at offset 0x0
esptool.py --chip esp32c6 -p /dev/ttyACM0 -b 921600 \\
  write_flash 0x0 omnirid-esp32c6.factory.bin`
      },
      {
        type: 'p',
        html: 'The raw binary from the cross-build is <code>target/&lt;target-triple&gt;/debug/bsp-esp32</code>; it must be flashed together with the ESP-IDF bootloader and partition table (easier via Method 1 or Method 2 above).'
      },
      {
        type: 'h',
        text: 'First Boot & Verification'
      },
      {
        type: 'p',
        html: 'After flashing successfully, the firmware boots in one of two modes:'
      },
      {
        type: 'ul',
        items: [
          '<b>FC mode (default):</b> Connect to a flight controller via UART for real GPS data.',
          '<b>Demo mode (optional):</b> Enabled via the <b>Options</b> bit 3 (or the <code>demo</code> CLI command). Simulates a drone flying a circular patrol over Rome (Colosseum, ~300 m radius) at ~6 m/s, altitude 50±20 m. No flight controller needed. You can configure it and view live telemetry immediately (OTA is not available yet — flash via USB).'
        ]
      },
      {
        type: 'p',
        html: 'To toggle demo mode, use the config UI, the <code>demo</code> CLI command, or set <code>options</code> bit 3 (<code>RID_OPT_DEMO_MODE</code>).'
      },
      {
        type: 'ol',
        items: [
          '<b>Power the ESP32</b> via USB or connect to your flight controller\u2019s BEC.',
          '<b>Wait 10-15 seconds</b> for the ESP32 to boot. The RGB LED (if configured) shows status: amber = no fix, green = fix OK, white flash on each transmission.',
          '<b>Scan for WiFi</b> on your phone or laptop. You should see a network named <b>ESP-RID</b> (or your custom SSID).',
          '<b>Connect to ESP-RID</b> (no password by default).',
          '<b>Open the OmniRID app</b> (this PWA) and connect it to the device: the firmware is headless and exposes only a JSON API at <code>http://192.168.4.1</code>, which the app drives.',
          '<b>Check the Status section</b> — in demo mode, you\u2019ll see simulated GPS patrol data. With an FC connected, it shows the detected protocol and live GPS data.',
          '<b>Verify Remote ID broadcast</b> — use a smartphone app like <i>Drone Scanner</i> (iOS/Android) or <i>OpenDroneID Viewer</i> (Android) to confirm that Remote ID messages are being received.'
        ]
      },
      {
        type: 'h',
        text: 'LED Behavior'
      },
      {
        type: 'p',
        html: 'The status LED is an RGB LED driven via PWM on up to three configurable GPIOs (default: not configured / off). It shows one of 7 states plus a white flash on every transmission:'
      },
      {
        type: 'table',
        cols: ['State', 'Color / Pattern', 'Meaning'],
        rows: [
          ['BOOT', 'Blue pulse', 'ESP32 initializing'],
          ['NO_GPS', 'Amber blink ~1 Hz', 'No GPS fix, waiting for data'],
          ['GPS_OK', 'Green solid', 'GPS fix acquired, broadcasting Remote ID'],
          ['DEMO', 'Purple pulse', 'Demo mode active'],
          ['LOCKED', 'Red double-blink', 'Lock level ≥ 1 active'],
          ['OTA', 'Rainbow cycle', 'OTA update in progress'],
          ['ERROR', 'Red blink ~4 Hz', 'Firmware/configuration error'],
          ['TX flash', 'White ~80 ms', 'Transmission in progress (overrides all states)']
        ]
      },
      {
        type: 'h',
        text: 'First-Time Configuration Checklist'
      },
      {
        type: 'ol',
        items: [
          'Set your <b>UAS ID</b> (serial number or CAA registration) in the Identity section.',
          'Set your <b>Operator ID</b> if required by your local regulations.',
          'Verify the <b>baud rate</b> matches your flight controller\u2019s serial port speed.',
          'Enable the transmission modes you need (WiFi Beacon, BLE 4.0, BLE 5.0).',
          'Click <b>Save All</b> to persist settings.',
          'Reboot the ESP32 to ensure settings are applied correctly.'
        ]
      },
      {
        type: 'h',
        text: 'Troubleshooting Flash Issues'
      },
      {
        type: 'table',
        cols: ['Problem', 'Solution'],
        rows: [
          ['Serial port not found', 'Install CP2102/CH340 driver, check device manager'],
          ['Brownout error during flash', 'Use a high-quality USB cable, connect to USB 2.0 port, reduce flash baud rate'],
          ['Timeout waiting for header', 'Hold GPIO0 while connecting, or press reset button with GPIO0 grounded'],
          ['A fatal error occurred: Failed to connect', 'Check USB connection, install drivers, try different USB port']
        ]
      }
    ]
  },
  {
    id: 'config',
    number: 3,
    title: 'Configuration Reference',
    icon: 'i-lucide-sliders-horizontal',
    blocks: [
      {
        type: 'p',
        html: 'Connecting to the device is described in <a href="#guide-webui">Web Interface Guide → Accessing the App</a>. All settings are also available via the headless REST API (see below) — the firmware serves no page of its own.'
      },
      {
        type: 'h',
        text: 'Parameter Reference (43 Parameters)'
      },
      {
        type: 'table',
        cols: ['#', 'Parameter', 'JSON Key', 'Type', 'Range', 'Default', 'Description'],
        rows: [
          ['1', 'UAS ID', '<code>uas_id</code>', 'string', '1-20 chars', `"ESP32-RID-001"`, 'Serial number (ANSI/CTA-2063: 4-char manufacturer code + length digit + serial) or CAA registration, max 20 ASCII characters. On first boot, placeholders are replaced with a MAC-derived ID. Example: <code>RID-12345678</code>'],
          ['2', 'ID Type', '<code>id_type</code>', 'uint8', '1-4', '1', '1=Serial, 2=CAA, 3=UTM UUID, 4=Session ID'],
          ['3', 'UA Type', '<code>ua_type</code>', 'uint8', '0-15', '1', '0=None, 1=Aeroplane, 2=Multirotor, 3=Gyroplane, 4=Hybrid, ... 15=Other'],
          ['4', 'Operator ID', '<code>operator_id</code>', 'string', '1-20 chars', `"OP-UNKNOWN"`, 'Operator registration number. On first boot, placeholders are replaced with a MAC-derived ID (e.g., <code>OP-MARIO-12345</code>)'],
          ['5', 'UAS ID 2', '<code>uas_id_2</code>', 'string', '0-20 chars', '""', 'Secondary Basic ID (optional)'],
          ['6', 'ID Type 2', '<code>id_type_2</code>', 'uint8', '0-4', '0', '0=None, 1=Serial, 2=CAA, 3=UTM, 4=Session'],
          ['7', 'UA Type 2', '<code>ua_type_2</code>', 'uint8', '0-15', '0', 'Secondary aircraft type'],
          ['8', 'Tx Modes', '<code>tx_modes</code>', 'bitmask', '0-15', '1', 'Bitmask: 1=WiFi BCN, 2=WiFi NAN, 4=BLE4, 8=BLE5'],
          ['9', 'WiFi Channel', '<code>wifi_channel</code>', 'uint8', '1-13', '6', '2.4 GHz channel for WiFi Beacon broadcasts'],
          ['10', 'WiFi Power', '<code>wifi_power_dbm</code>', 'float', '2-20 dBm', '20', 'WiFi transmit power (dBm)'],
          ['11', 'WiFi Beacon Rate', '<code>wifi_bcn_rate_hz</code>', 'float', '0-5 Hz', '1.0', 'WiFi Beacon packets per second. 1 Hz = one packet per second'],
          ['12', 'WiFi NAN Rate', '<code>wifi_nan_rate_hz</code>', 'float', '0-5 Hz', '0', 'WiFi NAN packets per second. 0 = disabled'],
          ['13', 'BLE 4.0 Rate', '<code>ble4_rate_hz</code>', 'float', '0-5 Hz', '1.0', 'BLE 4.0 advertising rate'],
          ['14', 'BLE 4.0 Power', '<code>ble4_power_dbm</code>', 'float', '-27-18 dBm', '18', 'BLE 4.0 transmit power'],
          ['15', 'BLE 5.0 Rate', '<code>ble5_rate_hz</code>', 'float', '0-5 Hz', '1.0', 'BLE 5.0 Coded PHY advertising rate'],
          ['16', 'BLE 5.0 Power', '<code>ble5_power_dbm</code>', 'float', '-27-18 dBm', '18', 'BLE 5.0 transmit power'],
          ['17', 'WiFi SSID', '<code>wifi_ssid</code>', 'string', '1-32 chars', `"ESP-RID"`, 'Access point SSID for configuration'],
          ['18', 'WiFi Password', '<code>wifi_password</code>', 'string', '0-32 chars', '""', 'AP password. Empty = open network'],
          ['19', 'Web Server', '<code>webserver_en</code>', 'bool', '0/1', '1', 'Enable the web configuration server'],
          ['20', 'Baud Rate', '<code>baud_rate</code>', 'uint32', '9600-921600', '57600', 'UART baud rate (must match FC)'],
          ['21', 'MAVLink SysID', '<code>mavlink_sysid</code>', 'uint8', '0-254', '0', 'MAVLink system ID filter. 0 = auto-detect'],
          ['22', 'Broadcast without GPS', '<code>bcast_powerup</code>', 'bool', '0/1', '1', 'When enabled, forces a Remote ID transmission on power‑up even if no GPS fix is present (the scheduler now runs transmissions unconditionally each tick).'],
          ['23', 'Lock Level', '<code>lock_level</code>', 'int8', '0-2', '0', '0=Normal, 1=Signed cmds, 2=eFuse permanent'],
          ['24', 'Options', '<code>options</code>', 'bitmask', '0-511', '0', 'Bit 0=Force ARM, 1=No save BasicID, 2=Print MAVLink RID, 3=Demo mode, 4=Kalman filter, 5=Ed25519 auth, 6=MAVLink arm status, 7=MAVLink op loc loop, 8=Identity ready gate'],
          ['25', 'Public Keys', '<code>public_key_1-5</code>', 'string', '0-256 chars', '""', 'Up to 5 public keys (PEM or base64) for command authentication'],
          ['26', 'Protocol', '<code>protocol</code>', 'uint8', '0-255', '255', '0=Unknown, 1=MAVLink, 2=MSP, 3=NMEA, 4=None, 255=Auto-detect'],
          ['27', 'UART Port', '<code>uart_port</code>', 'uint8', '0-2', '1', 'UART peripheral number (0=UART0, 1=UART1, 2=UART2)'],
          ['28', 'UART TX Pin', '<code>tx_pin</code>', 'int8', '-1 / GPIO', '17', 'UART TX GPIO pin'],
          ['29', 'UART RX Pin', '<code>rx_pin</code>', 'int8', '-1 / GPIO', '18', 'UART RX GPIO pin for GPS/FC data'],
          ['30', 'Operator Latitude', '<code>operator_lat</code>', 'double', '-90-90', '0.0', 'Operator position latitude (fallback)'],
          ['31', 'Operator Longitude', '<code>operator_lon</code>', 'double', '-180-180', '0.0', 'Operator position longitude (fallback)'],
          ['32', 'Operator Altitude', '<code>operator_alt</code>', 'float', 'any', '0.0', 'Operator position altitude in meters (fallback)'],
          ['33', 'Self-ID Text', '<code>self_id_text</code>', 'string', '0-23 chars', '""', 'Free-form text (max 23 ASCII chars). Broadcast to receivers with the Self-ID message'],
          ['34', 'LED Red GPIO', '<code>led_r_gpio</code>', 'int8', '-1 / GPIO', '-1', 'RGB LED red channel GPIO (-1 = disabled)'],
          ['35', 'LED Green GPIO', '<code>led_g_gpio</code>', 'int8', '-1 / GPIO', '-1', 'RGB LED green channel GPIO (-1 = disabled)'],
          ['36', 'LED Blue GPIO', '<code>led_b_gpio</code>', 'int8', '-1 / GPIO', '-1', 'RGB LED blue channel GPIO (-1 = disabled)'],
          ['37', 'DroneCAN RX GPIO', '<code>dronecan_rx_gpio</code>', 'int8', '-1 / GPIO', '-1', 'DroneCAN CAN bus RX GPIO (-1 = disabled)'],
          ['38', 'DroneCAN TX GPIO', '<code>dronecan_tx_gpio</code>', 'int8', '-1 / GPIO', '-1', 'DroneCAN CAN bus TX GPIO (-1 = disabled)'],
          ['39', 'DroneCAN Bitrate', '<code>dronecan_bitrate</code>', 'uint32', 'any', '1000000', 'DroneCAN CAN bus bitrate in bps'],
          ['40', 'MAVLink USB', '<code>mavlink_usb_enable</code>', 'bool', '0/1', '0', 'Enable MAVLink over USB CDC serial (S3/C6 only)'],
          ['41', 'OTA Trigger GPIO', '<code>ota_trigger_gpio</code>', 'int8', '-1 / GPIO', '-1', 'Boot-time GPIO to enter OTA update mode (-1 = disabled)'],
          ['42', 'Auth Private Key', '<code>auth_private_key</code>', 'string', '0-512 chars', '""', 'Ed25519 private key in PEM format for signing auth pages'],
          ['43', 'Startup Delay', '<code>start_delay_ms</code>', 'uint32', '0-30000 ms', '10000', 'Delay before transmission starts after boot']
        ]
      },
      {
        type: 'h',
        text: 'REST API'
      },
      {
        type: 'p',
        html: 'The web server exposes a JSON REST API at <code>http://192.168.4.1</code>:'
      },
      {
        type: 'table',
        cols: ['Endpoint', 'Method', 'Description'],
        rows: [
          ['<code>/api/config</code>', 'GET', 'Get current configuration as JSON'],
          ['<code>/api/config</code>', 'POST', 'Set configuration. Send JSON body with parameters to update'],
          ['<code>/api/status</code>', 'GET', 'Get live telemetry status as JSON (protocol, GPS, counters)'],
          ['<code>/api/reset</code>', 'POST', 'Factory reset all settings to defaults, then reboot'],
          ['<code>/api/logs</code>', 'GET', 'Get recent firmware log lines (used by the Console tab)'],
          ['<code>/api/command</code>', 'POST', 'Send an interactive console command to the firmware'],
          ['<code>/ota</code>', 'POST', 'Upload firmware binary for OTA update']
        ]
      },
      {
        type: 'h',
        text: 'Example: Get Config'
      },
      {
        type: 'code',
        code: `curl http://192.168.4.1/api/config`
      },
      {
        type: 'h',
        text: 'Example: Set Config'
      },
      {
        type: 'code',
        code: `curl -X POST http://192.168.4.1/api/config \\
  -H "Content-Type: application/json" \\
  -d '{"uas_id":"RID-12345678","ua_type":2,"baud_rate":115200}'`
      },
      {
        type: 'h',
        text: 'NVS Persistence'
      },
      {
        type: 'p',
        html: 'A subset of configuration parameters is stored in the ESP32\u2019s Non-Volatile Storage (NVS) flash memory under the namespace <code>esp_rid</code> and persists across power cycles, reboots, and OTA updates. The full key layout is in <a href="#guide-techref">Technical Reference → NVS Key Layout</a>. Parameters that are not persisted (protocol, UART port and TX/RX pins, DroneCAN, MAVLink USB, OTA trigger GPIO, auth private key, startup delay) are runtime-only and reset to defaults on reboot. A factory reset erases the <code>esp_rid</code> namespace and restores defaults.'
      }
    ]
  },
  {
    id: 'building',
    number: 4,
    title: 'Building from Source',
    icon: 'i-lucide-code-2',
    blocks: [
      {
        type: 'h',
        text: 'Prerequisites'
      },
      {
        type: 'ul',
        items: [
          '<b>Rust stable</b> — Install from <a href="https://rustup.rs/" target="_blank">rustup.rs</a>',
          '<b>Git</b> — For cloning the repository',
          '<b>(Optional) espup</b> — For ESP32 cross-compilation (<code>cargo install espup</code>)'
        ]
      },
      {
        type: 'h',
        text: 'Installing Rust'
      },
      {
        type: 'h',
        text: 'All Platforms'
      },
      {
        type: 'code',
        code: `# Install Rust toolchain
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh

# (Optional) For ESP32 cross-compilation
cargo install espup
espup install`
      },
      {
        type: 'h',
        text: 'Clone and Build'
      },
      {
        type: 'code',
        code: `git clone https://github.com/VOLTEKOVER/OmniRID-Universal-Drone-ID.git
cd OmniRID-Universal-Drone-ID/OmniRID-firmware

# Host build
cargo build --workspace

# Run all tests (305 tests)
cargo test --workspace

# Lint
cargo clippy --workspace --all-targets -- -D warnings

# ESP32-C6 cross-build (RISC-V, nightly + rust-src)
cd hardware/bsp-esp32
RUSTC_BOOTSTRAP=1 cargo +nightly build -Z build-std=std,panic_abort \\
  --no-default-features --features esp32c6,hardware --target riscv32imac-esp-espidf

# Flash the resulting binary with espflash / idf.py (USB/serial; OTA is not wired)`
      },
      {
        type: 'h',
        text: 'Project Structure'
      },
      {
        type: 'code',
        code: `OmniRID-Universal-Drone-ID/
├── OmniRID-firmware/                    # Rust workspace
│   ├── Cargo.toml                       # members: firmware/*, inputs/*, outputs/*, external-libs/*
│   ├── firmware/
│   │   ├── app/                         # Application logic (lib + bin, controller)
│   │   ├── rid-core/                    # Kalman, security, TX pipeline, scheduler
│   │   ├── rid-app/                     # NVS, OTA, web config, CLI, LED, JSON
│   │   ├── rid-interface/               # Shared types and traits
│   │   └── bsp-sim/                     # Simulated board support (host tests)
│   ├── inputs/
│   │   ├── proto-mavlink/               # MAVLink v2 + MESSAGE_PACK + ODID messages
│   │   ├── proto-msp/                   # MSP v1 (RAW_GPS, ATTITUDE, STATUS)
│   │   ├── proto-nmea/                  # NMEA 0183 (GGA, RMC, VTG)
│   │   ├── proto-dronecan/              # DroneCAN / UAVCAN v0 (TWAI)
│   │   └── proto-usb-mavlink/           # USB CDC MAVLink TX
│   ├── outputs/
│   │   └── out-astm/                    # ASTM F3411-22a encoder + WiFi + BLE4
│   ├── external-libs/
│   │   └── opendroneid-sys/             # Vendored Intel OpenDroneID (FFI)
│   └── hardware/
│       └── bsp-esp32/                   # ESP32 glue (standalone workspace)
├── OmniRID-app/                         # Ground station (Nuxt 4 SPA)
│   ├── nuxt.config.ts
│   ├── app/
│   │   ├── pages.config.ts              # Navigation manifest (4 groups)
│   │   ├── layouts/ components/ composables/
│   │   └── pages/                       # dashboard, firmware, guide, tx/*, rx/* (one file per sidebar page)
│   ├── server/routes/api/esp/           # Dev/self-hosted proxy to the device
│   └── public/                          # Static assets
├── docs/                                # Images only (static docs site removed)
├── todolist/                            # firmware-todo.md, app-todo.md, shared-todo.md
└── .github/workflows/                   # esp32-build, protocol-updates, release, security-audit`
      }
    ]
  },
  {
    id: 'webui',
    number: 5,
    title: 'Web Interface Guide',
    icon: 'i-lucide-layout-dashboard',
    blocks: [
      {
        type: 'callout',
        tone: 'info',
        title: 'Note',
        html: 'This app is the only configuration interface: the firmware is headless and serves only a JSON REST API. The configurator, dashboard, console, and OTA upload interfaces can be explored without hardware (virtual device mode); with a real ESP32 the app talks to the API at <code>192.168.4.1</code>.'
      },
      {
        type: 'h',
        text: 'Accessing the App'
      },
      {
        type: 'ol',
        items: [
          'Power the OmniRID (USB or battery).',
          'On your phone, tablet, or PC, scan for WiFi networks.',
          'Connect to <b>ESP-RID</b> (no password by default).',
          'Open the OmniRID app (this PWA). It reaches the device API at <code>192.168.4.1</code> — the firmware hosts no page of its own.'
        ]
      },
      {
        type: 'callout',
        tone: 'warning',
        title: 'Note',
        html: 'The ESP32 creates its own WiFi network. You will lose internet connectivity while connected to it. This is normal.'
      },
      {
        type: 'h',
        text: 'Step-by-Step Setup Walkthrough'
      },
      {
        type: 'p',
        html: 'Follow this sequence to configure your OmniRID for the first time. You can start in demo mode (no hardware needed) and switch to FC mode later:'
      },
      {
        type: 'table',
        cols: ['Step', 'Action', 'Details'],
        rows: [
          ['1', 'Set UAS ID', 'Navigate to <b>Identity</b> tab. Enter your drone\u2019s serial number or CAA registration in the UAS ID field (max 20 characters). Example: <code>RID-A1B2C3D4</code>.'],
          ['2', 'Set ID Type', 'Choose <b>Serial Number (1)</b> for ANSI/CTA-2063 serial numbers, or <b>CAA Registration (2)</b> for national authority IDs.'],
          ['3', 'Set UA Type', 'Select your aircraft type. <b>Multirotor (2)</b> is correct for most quadcopters and hexacopters.'],
          ['4', 'Set Operator ID', 'Enter your operator registration number if required. Format varies by country (e.g., <code>OP-MARIO-12345</code>).'],
          ['5', 'Enable Transmitters', 'In the <b>Transmission</b> section, check at least <b>WiFi Beacon</b> and <b>BLE 4.0</b>. These are the most compatible modes. BLE 5.0 LR requires ESP32-S3.'],
          ['6', 'Set Baud Rate', 'In <b>WiFi AP & Serial</b>, set the baud rate to match your flight controller\u2019s serial port. Common: 57600 or 115200.'],
          ['7', 'Set WiFi Password (optional)', 'Set a password for the ESP-RID network to prevent unauthorized access. Use WPA2 encryption.'],
          ['8', 'Verify GPS Status', 'Check the <b>Status</b> section. Wait for the protocol to be detected (MAVLink, MSP, or NMEA) and GPS fix to appear.'],
          ['9', 'Validate with Receiver', 'Open a Remote ID receiver app on your phone. You should see your drone\u2019s ID, position, and speed broadcast.'],
          ['10', 'Save Configuration', 'Click <b>Save All</b> to persist settings to NVS flash. The device will apply settings immediately.']
        ]
      },
      {
        type: 'callout',
        tone: 'info',
        title: 'Tip',
        html: 'After saving, power-cycle the ESP32 and reconnect. Verify that your settings are still present — this confirms NVS persistence is working correctly.'
      },
      {
        type: 'h',
        text: 'Interface Sections'
      },
      {
        type: 'h',
        text: 'Identity'
      },
      {
        type: 'p',
        html: 'Configure your drone\u2019s UAS ID, operator information, and aircraft type. The Basic ID is mandatory for ASTM compliance. The second Basic ID is optional and can be used for dual-purpose aircraft or additional identifiers.'
      },
      {
        type: 'ul',
        items: [
          '<b>UAS ID:</b> Your drone\u2019s serial number (ANSI/CTA-2063 format) or CAA registration number. Max 20 characters.',
          '<b>ID Type:</b> Select the type of identifier. Serial Number (1) is recommended for most users.',
          '<b>UA Type:</b> Match your aircraft type. Multirotor (2) is the default for most drones.',
          '<b>Operator ID:</b> Your national aviation authority registration number.'
        ]
      },
      {
        type: 'h',
        text: 'Transmission'
      },
      {
        type: 'p',
        html: 'Control which radio technologies are used for broadcasting and their parameters.'
      },
      {
        type: 'ul',
        items: [
          '<b>WiFi Beacon:</b> IEEE 802.11 beacon frames containing ODID packets. Most compatible with receivers.',
          '<b>WiFi NAN:</b> Neighborhood Area Networking. Less common, but supported by some Android devices.',
          '<b>BLE 4.0:</b> Legacy Bluetooth Low Energy advertising. Compatible with most phones and ODID receivers.',
          '<b>BLE 5.0 LR:</b> BLE 5.0 Coded PHY long range mode. Requires ESP32-S3. Increased range at lower data rate.'
        ]
      },
      {
        type: 'p',
        html: 'Rates are in Hz (packets per second). The ASTM standard recommends at least 1 Hz. Higher rates increase compatibility but consume more power.'
      },
      {
        type: 'h',
        text: 'WiFi AP & Serial'
      },
      {
        type: 'p',
        html: 'Configure the management WiFi network and UART connection to your flight controller.'
      },
      {
        type: 'ul',
        items: [
          '<b>SSID:</b> The name of the ESP32\u2019s WiFi network. Default: <code>ESP-RID</code>.',
          '<b>Password:</b> Optional password (max 63 chars). Empty = open network.',
          '<b>Baud Rate:</b> Must match your flight controller\u2019s serial port speed. Common: 57600, 115200.',
          '<b>MAVLink SysID:</b> Set to 0 for auto-detect, or enter a specific system ID to filter messages.'
        ]
      },
      {
        type: 'h',
        text: 'System'
      },
      {
        type: 'p',
        html: 'Security settings, authentication, and advanced options.'
      },
      {
        type: 'ul',
        items: [
          '<b>Lock Level:</b> 0 = normal operation. 1 = signed commands only. 2 = permanent eFuse (irreversible!).',
          '<b>Public Keys:</b> Up to 5 public keys (PEM or base64) for authenticating signed configuration commands.',
          '<b>Auth Private Key:</b> Ed25519 private key for authentication page signing (ASTM F3411-22a).',
          '<b>Options:</b> Force ARM status, disable NVS saving of BasicID, enable MAVLink RID printing, demo mode, Kalman filter, Ed25519 auth, MAVLink arm status, MAVLink operator location loopback, identity ready gate.'
        ]
      },
      {
        type: 'h',
        text: 'Hardware'
      },
      {
        type: 'p',
        html: 'GPIO pin assignments and peripheral configuration.'
      },
      {
        type: 'ul',
        items: [
          '<b>Status LED (R/G/B):</b> Three independent GPIO pins for RGB status LED. 7 states via PWM: BOOT, NO_GPS, GPS_OK, DEMO, LOCKED, OTA, ERROR.',
          '<b>DroneCAN:</b> CAN bus receiver. Configurable RX/TX GPIO pins and bitrate (default 1 Mbps). Decodes <code>uavcan.equipment.gnss.Fix2</code>.',
          '<b>UART Pins:</b> Select UART peripheral port (UART0/1/2) and assign any GPIO for TX and RX.',
          '<b>MAVLink USB:</b> Enable MAVLink over USB CDC serial transport (ESP32-S3/C6 only).',
          '<b>OTA Trigger GPIO:</b> GPIO that triggers OTA update mode at boot (firmware upload on next restart).',
          '<b>Startup Delay:</b> Delay in milliseconds before transmission begins after boot (default 10 000 ms).'
        ]
      },
      {
        type: 'h',
        text: 'Operator Position'
      },
      {
        type: 'p',
        html: 'Fallback operator latitude, longitude, and altitude used for the ODID System message when no operator location is available (e.g., no MAVLink operator-location loopback).'
      },
      {
        type: 'h',
        text: 'Status'
      },
      {
        type: 'p',
        html: 'Real-time telemetry dashboard showing:'
      },
      {
        type: 'ul',
        items: [
          'Detected protocol (MAVLink, MSP, NMEA, or None)',
          'GPS fix status (valid/invalid)',
          'Latitude, longitude, altitude, speed, heading',
          'Satellite count and fix type',
          'Transmission counters (total, WiFi, BLE)'
        ]
      },
      {
        type: 'p',
        html: 'The status page refreshes automatically every 2 seconds.'
      },
      {
        type: 'h',
        text: 'Firmware Update (OTA)'
      },
      {
        type: 'p',
        html: 'Upload a new firmware <code>.bin</code> file to update the ESP32 over-the-air. The device reboots automatically after a successful update. Keep the device powered during the update process.'
      },
      {
        type: 'h',
        text: 'Factory Reset'
      },
      {
        type: 'p',
        html: 'Click the "Factory Reset" button in the System section to restore all settings to defaults. The device will reboot immediately.'
      }
    ]
  },
  {
    id: 'ota',
    number: 6,
    title: 'OTA Updates',
    icon: 'i-lucide-cloud-upload',
    blocks: [
      {
        type: 'callout',
        tone: 'warning',
        title: 'Not implemented yet',
        html: 'OTA is <b>not available</b> in the current build: <code>POST /ota</code> answers <code>501 {"error":"OTA not implemented; flash via serial/USB"}</code>. The validation logic (SHA-256 + Ed25519, lock-level gate, idle timeout) exists and is tested in <code>rid-app::ota</code>, but it is not wired to the HTTP handler. Flash over USB/serial for now. The flow described below is the intended design, kept for when the endpoint is implemented.'
      },
      {
        type: 'h',
        text: 'Over-the-Air Firmware Update'
      },
      {
        type: 'p',
        html: 'When implemented, OmniRID will support updating firmware wirelessly through the web interface, without a USB cable after the initial flash. The upload will include cryptographic verification to reject corrupt or malicious firmware. <b>Today this endpoint returns 501 — use USB/serial flashing.</b>'
      },
      {
        type: 'h',
        text: 'Prerequisites'
      },
      {
        type: 'ul',
        items: [
          'A <code>.bin</code> firmware file built for your ESP32 target (ESP32, ESP32-S3, or ESP32-C6).',
          'The ESP32 must be powered and connected to its WiFi network (you connected to ESP-RID).',
          'Your phone/PC must be connected to the ESP32\u2019s WiFi network.'
        ]
      },
      {
        type: 'h',
        text: 'Intended Step-by-Step (not available yet)'
      },
      {
        type: 'ol',
        items: [
          'Build the firmware (see <a href="#guide-building">section 4 → Building from Source</a>) or download a pre-built <code>.bin</code> from the project\u2019s releases.',
          'Open the OmniRID app and go to the <b>Firmware</b> page.',
          'Scroll to the <b>Firmware Update</b> section.',
          'Click <b>Select .bin file</b> and choose your firmware binary.',
          'The browser computes a <b>SHA-256 hash</b> of the file (via Web Crypto API) and sends it as the <code>X-Expected-SHA256</code> header.',
          'Click <b>Upload Firmware</b>.',
          'Wait for the upload to complete (~30 seconds for a 1 MB firmware). The progress text will update.',
          'The server verifies the SHA-256 hash matches the received binary. If lock level ≥ 1, an Ed25519 signature (<code>X-Signature</code> header) is also required.',
          'On success, the device reboots automatically into the new firmware.'
        ]
      },
      {
        type: 'h',
        text: 'Verification Flow (intended)'
      },
      {
        type: 'p',
        html: 'The OTA update uses a two-layer verification process implemented in <code>rid-core::security</code>:'
      },
      {
        type: 'ol',
        items: [
          '<b>SHA-256 integrity check:</b> The browser computes SHA-256 of the firmware binary before upload. The server independently computes SHA-256 of the received data and compares it to the <code>X-Expected-SHA256</code> header. Mismatches are rejected immediately.',
          '<b>Ed25519 signature (lock level ≥ 1):</b> When lock level is 1 or 2, an <code>X-Signature</code> header containing an Ed25519 signature over the SHA-256 hash must be provided. The signature is verified against the configured public keys.'
        ]
      },
      {
        type: 'h',
        text: 'How It Works'
      },
      {
        type: 'p',
        html: 'The OTA mechanism uses ESP-IDF\u2019s built-in OTA API with a factory + single OTA partition scheme:'
      },
      {
        type: 'flow',
        flow: {
          kind: 'linear',
          nodes: [
            { label: 'Browser', sub: 'HTTP POST /ota firmware.bin + X-Expected-SHA256' },
            { label: 'SHA-256 verify', sub: 'Received data vs X-Expected-SHA256 header' },
            { label: 'Ed25519 verify (L1+)', sub: 'X-Signature checked against public keys' },
            { label: 'Write to ota_0', sub: 'Flash memory — Factory + OTA scheme' },
            { label: 'Set boot partition', sub: 'Select OTA app' },
            { label: 'esp_restart()', sub: 'Boot into new firmware' }
          ],
          failure: { to: 'factory', note: 'Rollback: boot from factory image' },
          caption: 'OTA update flow: browser computes SHA-256 → sent as X-Expected-SHA256 header → server verifies hash + optional Ed25519 signature → writes to the ota_0 partition → reboots. Failed updates roll back to the factory image.'
        }
      },
      {
        type: 'ol',
        items: [
          'The web server receives the firmware binary in an HTTP POST to <code>/ota</code>.',
          'It verifies the SHA-256 hash of the received data against the <code>X-Expected-SHA256</code> header using the <code>rid-core::security</code> crate.',
          'If lock level ≥ 1, it also verifies the Ed25519 signature against configured public keys.',
          'On success, it writes the binary to the <code>ota_0</code> OTA partition.',
          'It sets the OTA partition as the boot partition and calls <code>esp_restart()</code>.',
          'The ESP32 boots from the new firmware. If the update fails, the bootloader falls back to the factory image.'
        ]
      },
      {
        type: 'h',
        text: 'Safety'
      },
      {
        type: 'ul',
        items: [
          'The default partition table has one factory partition and one OTA partition (<code>ota_0</code>). If an OTA update fails, the device falls back to the factory firmware.',
          'SHA-256 verification prevents corrupt or incomplete firmware from being applied.',
          'Ed25519 signature verification (lock level ≥ 1) prevents unauthorized firmware changes.',
          'Always use a firmware built for your specific ESP32 target. Flashing an ESP32-S3 binary to an ESP32 will fail.',
          'Keep the device powered during the update. Do not disconnect or reset.',
          'If the update fails, you can always recover via USB serial flashing.'
        ]
      },
      {
        type: 'h',
        text: 'Troubleshooting OTA'
      },
      {
        type: 'table',
        cols: ['Problem', 'Solution'],
        rows: [
          ['"OTA begin failed"', 'The OTA partition may be corrupted. Reflash via USB and try again.'],
          ['"SHA-256 mismatch"', 'The computed hash does not match the uploaded binary. Re-select the file and try again. Ensure the file was not corrupted during download.'],
          ['"Signature verification failed"', 'Lock level ≥ 1 is active. Ensure you provide a valid Ed25519 signature in the <code>X-Signature</code> header, or lower the lock level to 0.'],
          ['Upload stalls', 'Move closer to the ESP32 for better WiFi signal, or use USB flashing.'],
          ['Device does not reboot', 'Power-cycle the device manually.'],
          ['Firmware does not work after OTA', 'The binary may be for the wrong target. Flash the correct binary via USB.']
        ]
      }
    ]
  },
  {
    id: 'security',
    number: 7,
    title: 'Security',
    icon: 'i-lucide-shield-check',
    blocks: [
      {
        type: 'callout',
        tone: 'info',
        title: 'Status',
        html: 'All three lock levels are implemented. Level 2 burns "RID!" magic to EFUSE_BLK3 and is one-time irreversible. Level 1 requires an authenticated app session (password) to authorize configuration writes; Ed25519 <code>X-Signature</code> remains available as an advanced fallback. Shared verification logic is in <code>rid-core::security</code>. Rate limiting protects against brute-force attacks (10 fails per 60s sliding window).'
      },
      {
        type: 'h',
        text: 'Lock Levels'
      },
      {
        type: 'p',
        html: 'The firmware implements three lock levels to prevent unauthorized configuration changes:'
      },
      {
        type: 'table',
        cols: ['Level', 'Name', 'Effect'],
        rows: [
          ['0', 'Normal', 'All configuration changes are allowed via the app and REST API. No authentication required.'],
          ['1', 'Locked', 'Configuration changes require an authenticated app session (password). Sign in to the app/device to authorize writes; Ed25519 signatures are optional/advanced. OTA updates may require <code>X-Signature</code> depending on policy.'],
          ['2', 'eFuse Permanent', 'Same as Level 1, but the lock level is burned into eFuse and cannot be changed. This is an <b>irreversible</b> operation. Only use when the device is in its final deployment configuration.']
        ]
      },
      {
        type: 'h',
        text: 'Security Hardening (ESPsquawk Fixes)'
      },
      {
        type: 'p',
        html: 'The following security improvements were ported from the ESPsquawk fork and are now part of the firmware:'
      },
      {
        type: 'table',
        cols: ['Fix', 'Module', 'Description'],
        rows: [
          ['Safe JSON parsing', '<code>rid-app::web_config</code>', 'All web API JSON inputs parsed with <code>serde_json</code> — prevents injection attacks'],
          ['Rate limiting', '<code>rid-app::web_config</code>', 'Sliding window: 10 failed signature attempts per 60 seconds, then lockout'],
          ['Safe string handling', '<code>rid-app::web_config</code>', 'All string fields use Rust\u2019s safe ownership model — no buffer overflows possible'],
          ['PSA Crypto init', '<code>app::main</code>', '<code>psa_crypto_init()</code> called at boot for ESP-IDF v5+ crypto API'],
          ['Shared module', '<code>rid-core::security</code>', '<code>verify_sha256()</code>, <code>verify_signed_body()</code>, <code>bytes_to_hex()</code>, <code>hex_to_bytes()</code>'],
          ['Ed25519 bit check', '<code>rid-core::auth</code>', 'Validates signature length is exactly 256 bits (32 bytes)'],
          ['OTA SHA-256', '<code>rid-app::ota</code>', 'SHA-256 hash mandatory; Ed25519 signature may be required by policy when locked']
        ]
      },
      {
        type: 'h',
        text: 'Public Key Authentication'
      },
      {
        type: 'p',
        html: 'Up to 5 public keys can be configured (in PEM or raw base64 format). These keys are used for Ed25519-signed configuration commands as an advanced fallback when lock level 1 or 2 is active.'
      },
      {
        type: 'p',
        html: 'To generate a key pair:'
      },
      {
        type: 'code',
        code: `# Generate Ed25519 private key
openssl genpkey -algorithm ed25519 -out private.pem

# Extract public key
openssl pkey -in private.pem -pubout -out public.pem

# The public key content (base64) goes into the public_key fields
cat public.pem`
      },
      {
        type: 'h',
        text: 'Signed Commands'
      },
      {
        type: 'p',
        html: 'When lock level ≥ 1, the app uses an authenticated session (<code>X-App-Token</code>). For advanced use (CLI/manual), a POST to <code>/api/config</code> can include an Ed25519 signature header:'
      },
      {
        type: 'code',
        code: `curl -X POST http://192.168.4.1/api/config \\
  -H "Content-Type: application/json" \\
  -H "X-App-Token: <session-token>" \\
  -d '{"uas_id":"RID-12345678"}'`
      },
      {
        type: 'p',
        html: 'The signature is an Ed25519 signature over the SHA-256 hash of the JSON body. Failed signature attempts are rate-limited (10 per 60s sliding window).'
      },
      {
        type: 'h',
        text: 'WiFi Security'
      },
      {
        type: 'p',
        html: 'The configuration access point can be password-protected. Set a WiFi password from the app\u2019s Access Point page to prevent unauthorized access to the device API. The password is stored in NVS and can be up to 20 characters.'
      },
      {
        type: 'callout',
        tone: 'warning',
        title: 'Note',
        html: 'The AP uses WPA2-PSK encryption when a password is set. Without a password, the network is open and anyone within range can access the configuration page.'
      }
    ]
  },
  {
    id: 'antenna',
    number: 8,
    title: 'Antenna Guide',
    icon: 'i-lucide-radio',
    blocks: [
      {
        type: 'h',
        text: 'Choosing the Right Antenna'
      },
      {
        type: 'p',
        html: 'Antenna selection is critical for Remote ID performance. The ESP32 operates in the 2.4 GHz ISM band and the antenna must be well-matched to achieve reliable broadcast range.'
      },
      {
        type: 'h',
        text: 'PCB Antenna (On-Board)'
      },
      {
        type: 'ul',
        items: [
          '<b>Pros:</b> Low cost, no additional hardware, compact.',
          '<b>Cons:</b> Vulnerable to shielding by carbon fiber frames, sensitive to placement within the drone.',
          '<b>Range:</b> ~50-100 m in open air with clear line of sight.',
          '<b>Best for:</b> Glass fiber, plastic, or 3D-printed frames. Open-frame builds.'
        ]
      },
      {
        type: 'h',
        text: 'External Antenna (U.FL / IPEX)'
      },
      {
        type: 'ul',
        items: [
          '<b>Pros:</b> Can be placed away from shielding frame, better range, replaceable.',
          '<b>Cons:</b> Requires board with U.FL connector, additional cost, mounting required.',
          '<b>Range:</b> ~200-500 m with a 2 dBi dipole antenna.',
          '<b>Best for:</b> Carbon fiber frames, long-range applications, professional use.'
        ]
      },
      {
        type: 'h',
        text: 'Carbon Fiber Frames'
      },
      {
        type: 'callout',
        tone: 'warning',
        title: 'Critical',
        html: 'Carbon fiber is conductive and acts as a <b>Faraday cage</b> for 2.4 GHz signals. An internal PCB antenna placed inside a carbon fiber frame will have severely degraded range (&lt;10 m). An external antenna is <b>mandatory</b> for carbon fiber frames.'
      },
      {
        type: 'p',
        html: 'Mount the external antenna so that it protrudes from the frame, ideally on a landing skid or a dedicated 3D-printed mount. Keep the antenna away from carbon fiber plates by at least 10 mm.'
      },
      {
        type: 'h',
        text: 'Antenna Placement Tips'
      },
      {
        type: 'ul',
        items: [
          'Keep the antenna away from metal objects, batteries, and power cables.',
          'Orient the antenna vertically for omnidirectional coverage (most drone receivers are also vertical).',
          'Do not route the antenna coax cable parallel to power wires — cross them at 90° if necessary.',
          'Do not coil or bundle excess antenna cable — it acts as a counterpoise and affects tuning.',
          'Use a cable with a U.FL to SMA pigtail if your antenna uses SMA connectors.'
        ]
      },
      {
        type: 'h',
        text: 'Range Optimization'
      },
      {
        type: 'table',
        cols: ['Factor', 'Impact', 'Recommendation'],
        rows: [
          ['Antenna type', 'High', 'External 2 dBi dipole'],
          ['Frame material', 'High', 'External antenna for carbon fiber'],
          ['WiFi TX power', 'Medium', 'Set to 20 dBm (max)'],
          ['WiFi channel', 'Low', 'Use least congested channel (scan with phone)'],
          ['Receiver sensitivity', 'Medium', 'Use a dedicated ODID receiver for best results']
        ]
      }
    ]
  },
  {
    id: 'variants',
    number: 9,
    title: 'ESP32 Variants',
    icon: 'i-lucide-cpu',
    blocks: [
      {
        type: 'h',
        text: 'Comparison Table'
      },
      {
        type: 'table',
        cols: ['Feature', 'ESP32', 'ESP32-S3', 'ESP32-C6'],
        rows: [
          ['CPU', '2x LX6 240M', '2x LX7 240M', '1x RV 160M'],
          ['BLE', '4.0/4.2', '5.0 Coded PHY', '4.2'],
          ['WiFi', 'b/g/n', 'b/g/n', 'WiFi 6 (802.11ax)'],
          ['Flash', '4-16M', '8-16M', '4-8M'],
          ['RAM', '520K', '512K+2M PSRAM', '512K'],
          ['BLE 5.0 LR', '✗', '✓', '✗'],
          ['USB CDC', '✗', '✓', '✓'],
          ['Flash config', '4 MB', '4 MB', '4 MB'],
          ['Power', '~150 mA', '~130 mA', '~110 mA'],
          ['<b>Rcmd</b>', 'Compat', 'ML/PSRAM', '<b>Innovation</b>']
        ]
      },
      {
        type: 'p',
        html: '<b>ESP32-C6</b> WiFi 6 OFDMA + 802.15.4 + Digital Signature HW — primary innovation target. <b>ESP32-S3</b> best for ML/PSRAM workloads.'
      },
      {
        type: 'h',
        text: 'Feature Support Matrix'
      },
      {
        type: 'table',
        cols: ['Feature', 'ESP32', 'S3', 'C6'],
        rows: [
          ['WiFi Beacon (802.11)', '✓', '✓', '✓'],
          ['WiFi NAN', '✓', '✓', '✓'],
          ['BLE 4.0 (Legacy)', '✓', '✓', '✓'],
          ['BLE 5.0 LR Coded PHY', '✗', '✓', '✗'],
          ['WiFi 6 (802.11ax)', '✗', '✗', '✓'],
          ['802.15.4 / Thread', '✗', '✗', '✓'],
          ['Digital Signature HW', '✗', '✗', '✓'],
          ['WebSerial Installer', '✓', '✓', '✓'],
          ['OTA Updates', '✓', '✓', '✓'],
          ['Web Config UI', '✓', '✓', '✓'],
          ['Demo Mode', '✓', '✓', '✓'],
          ['MAVLink Input', '✓', '✓', '✓'],
          ['MSP Input', '✓', '✓', '✓'],
          ['NMEA 0183 Input', '✓', '✓', '✓'],
          ['Lock Level 1 (Signed)', '✓', '✓', '✓'],
          ['Lock Level 2 (eFuse)', '✓', '✓', '✓'],
          ['Status LED (GPIO)', '✓', '✓', '✓'],
          ['DroneCAN (CAN Bus)', '✓', '✓', '✓'],
          ['MAVLink USB Transport', '✗', '✓', '✓'],
          ['Kalman Position Filter', '✓', '✓', '✓'],
          ['Ed25519 Auth Pages', '✓', '✓', '✓']
        ]
      },
      {
        type: 'h',
        text: 'Which One to Choose?'
      },
      {
        type: 'ul',
        items: [
          '<b>ESP32-C6 (Innovation Target):</b> WiFi 6 OFDMA, 802.15.4, Digital Signature HW. Lowest power, most modern. Primary target for long-range, secure, multi-link RID.',
          '<b>ESP32-S3:</b> Best for ML on-device, PSRAM expansion, BLE 5.0 LR. Good for production builds needing extra compute.',
          '<b>ESP32 (Original):</b> Compatible baseline. Lacks BLE 5.0 Coded PHY and modern features. Good for testing.'
        ]
      },
      {
        type: 'h',
        text: 'Recommended Kits'
      },
      {
        type: 'table',
        cols: ['Kit', 'Board', 'Chip', 'WiFi', 'BLE', 'Price', 'Best for'],
        rows: [
          [`<img src="/images/esp32_devkitc.jpg" alt="ESP32 DevKit" class="h-16 w-auto rounded-lg" loading="lazy">`, 'ESP32-DevKitC V4', 'ESP32', 'b/g/n', 'BLE 4.2', '~5€', 'Basic prototyping, testing'],
          [`<img src="/images/esp32s3_devkitm1.png" alt="ESP32-S3 DevKit" class="h-16 w-auto rounded-lg" loading="lazy">`, 'ESP32-S3-DevKitM-1', 'ESP32-S3', 'b/g/n', 'BLE 5.0 LR', '~12€', 'ML on-device, PSRAM'],
          [`<img src="/images/xiao_esp32c6.jpg" alt="XIAO ESP32-C6" class="h-16 w-auto rounded-lg" loading="lazy">`, 'Seeed XIAO ESP32-C6', 'ESP32-C6', 'WiFi 6', 'BLE 5.3', '~5€ + 10€ GPS', 'Final product, smallest footprint']
        ]
      },
      {
        type: 'p',
        html: '<b>Recommended:</b> XIAO ESP32-C6 + L76K GNSS — zero soldering, 21×18 mm, USB-C, LiPo, U.FL. See the hardware comparison table above and the <a href="https://github.com/VOLTEKOVER/OmniRID-Universal-Drone-ID/blob/omnirid-webapp-pwa/todolist/firmware-todo.md" target="_blank">firmware backlog / roadmap</a> for details.'
      },
      {
        type: 'h',
        text: 'Pin Compatibility'
      },
      {
        type: 'table',
        cols: ['Function', 'ESP32', 'ESP32-S3', 'ESP32-C6'],
        rows: [
          ['UART TX (default)', 'GPIO17', 'GPIO17', 'GPIO17'],
          ['UART RX (default)', 'GPIO18', 'GPIO18', 'GPIO18'],
          ['Alt UART RX', '4, 26', '4, 5', '0, 1'],
          ['Boot button', 'GPIO0', 'GPIO0', 'GPIO9']
        ]
      },
      {
        type: 'p',
        html: 'UART pins, the RGB status LED, DroneCAN, and OTA trigger pins are all configurable from the app\u2019s Hardware page via <code>POST /api/config</code> (any GPIO, default -1).'
      }
    ]
  },
  {
    id: 'troubleshooting',
    number: 10,
    title: 'Troubleshooting',
    icon: 'i-lucide-wrench',
    blocks: [
      {
        type: 'h',
        text: 'No GPS Fix Shown in Status'
      },
      {
        type: 'table',
        cols: ['Symptom', 'Check'],
        rows: [
          ['Protocol shows "Unknown"', 'UART wiring incorrect, baud rate mismatch, or FC not sending data. Verify with a logic analyzer or serial terminal.'],
          ['Protocol detected but GPS invalid', 'The FC does not have a GPS fix. Check FC GPS status LED. Wait for more satellites.'],
          ['Intermittent GPS data', 'Loose wiring, electrical noise, or baud rate mismatch. Check solder joints and cable shielding.'],
          ['NMEA mode: no data', 'Check the 1 kΩ resistor on the GPS TX tap. Verify GPS module is outputting NMEA (some modules need configuration).']
        ]
      },
      {
        type: 'h',
        text: 'Cannot Find ESP-RID WiFi'
      },
      {
        type: 'ul',
        items: [
          'Wait 10-15 seconds after powering the ESP32 for it to boot and start the AP.',
          'Check that the ESP32 is powered correctly (LED should be on if connected via status LED).',
          'If you changed the SSID previously, scan all nearby networks.',
          'Factory reset: connect via serial and erase NVS, or re-flash the firmware.',
          'If the AP starts but you can\u2019t connect, try forgetting the network and reconnecting.'
        ]
      },
      {
        type: 'h',
        text: 'No Remote ID Signal Detected'
      },
      {
        type: 'ul',
        items: [
          '<b>GPS fix is required</b> for transmissions in the current build — the "Broadcast without GPS" option currently has no practical effect. Check the Status page.',
          'Verify that transmission modes are enabled in the app\u2019s Transmission page (WiFi Beacon, BLE).',
          'If using a phone as a receiver, use a dedicated ODID app (e.g., Drone Scanner, OpenDroneID Viewer).',
          'WiFi Beacon requires the phone to be in range and scanning. Some phones do not passively scan WiFi beacons.',
          'BLE 4.0 is more universally detectable than BLE 5.0 LR. Enable BLE 4.0 if BLE 5.0 is not detected.',
          'Carbon fiber frame with internal antenna will have very short range. Use an external antenna.'
        ]
      },
      {
        type: 'h',
        text: 'WiFi AP Disconnects'
      },
      {
        type: 'ul',
        items: [
          'The ESP32 can handle ~4-5 simultaneous WiFi clients. Too many clients may cause disconnections.',
          'Move closer to the ESP32 (within 5 m for reliable connection).',
          'Avoid interference from other 2.4 GHz devices (WiFi routers, Bluetooth, microwaves).',
          'Try a different WiFi channel (1 or 11 are usually less congested).'
        ]
      },
      {
        type: 'h',
        text: 'Build Errors'
      },
      {
        type: 'table',
        cols: ['Error', 'Solution'],
        rows: [
          ['<code>cargo: command not found</code>', 'Install Rust: <code>curl --proto \'=https\' --tlsv1.2 -sSf https://sh.rustup.rs | sh</code>'],
          ['<code>error[E0463]: can\'t find crate for ...</code>', 'Run <code>cargo build --workspace</code> from the <code>OmniRID/</code> directory.'],
          ['<code>error: unused import / dead code</code>', 'Run <code>cargo clippy --workspace -- -D warnings</code> to see all warnings as errors.'],
          ['<code>no_std build fails on host</code>', 'Use <code>cargo +esp build</code> with the ESP toolchain for <code>no_std</code> targets. Host builds use <code>bsp-sim</code>.'],
          ['<code>ESP-IDF not found (bsp-esp32)</code>', 'The <code>bsp-esp32</code> crate is a standalone workspace requiring <code>espup</code>. Run host tests in the main workspace instead.']
        ]
      },
      {
        type: 'h',
        text: 'Protocol Detection Fails'
      },
      {
        type: 'p',
        html: 'See the per-protocol configuration tips in <a href="#guide-protocols">Protocol Reference</a> (MAVLink, MSP, NMEA). In summary:'
      },
      {
        type: 'ul',
        items: [
          '<b>MAVLink:</b> Ensure the FC is configured for MAVLink on the serial port and the baud rate matches. Try MAVLink v1 if v2 fails.',
          '<b>MSP:</b> Enable MSP on the FC\u2019s serial port in the configurator. Betaflight may need <code>serialrx_provider = MSP</code>.',
          '<b>NMEA:</b> GPS modules typically output at 9600 or 115200 baud. Try both. Use a serial terminal to verify the GPS is sending NMEA sentences.'
        ]
      },
      {
        type: 'h',
        text: 'Boot Loop / Continuous Restart'
      },
      {
        type: 'ul',
        items: [
          'Check power supply (brownout detection can cause reboots). Use a quality USB cable or BEC.',
          'Re-flash the firmware via USB (serial flashing always works even with bad config).',
          'Erase NVS before flashing: <code>esptool.py --chip esp32c6 --port COM3 erase_flash</code> then re-flash.'
        ]
      },
      {
        type: 'h',
        text: 'OTA Update Fails'
      },
      {
        type: 'p',
        html: 'See <a href="#guide-ota">OTA Updates → Troubleshooting OTA</a>. Common causes: wrong firmware target, a corrupted <code>.bin</code>, or an active lock level ≥ 1 (Ed25519 signature required).'
      }
    ]
  },
  {
    id: 'techref',
    number: 11,
    title: 'Technical Reference',
    icon: 'i-lucide-file-code-2',
    blocks: [
      {
        type: 'h',
        text: 'NVS Key Layout'
      },
      {
        type: 'p',
        html: 'Configuration is stored in the NVS namespace <code>esp_rid</code> as <b>36 flat keys</b> (no nested structs). Every key is persisted across reboots and OTA updates unless the namespace is erased (factory reset):'
      },
      {
        type: 'tables',
        groups: [
          {
            title: 'Strings',
            rows: [
              ['<code>uas_id</code>', 'string', 'UAS ID (max 20 chars)'],
              ['<code>op_id</code>', 'string', 'Operator ID'],
              ['<code>self_id</code>', 'string', 'Self-ID text (max 23 chars)'],
              ['<code>uas_id2</code>', 'string', 'Secondary UAS ID'],
              ['<code>wifi_ssid</code>', 'string', 'WiFi AP SSID'],
              ['<code>wifi_pass</code>', 'string', 'WiFi AP password'],
              ['<code>pubkey1</code>...<code>pubkey5</code>', 'string', 'Ed25519 public keys (auth)']
            ]
          },
          {
            title: 'uint8',
            rows: [
              ['<code>ua_type</code>', 'uint8', 'UA type'],
              ['<code>id_type</code>', 'uint8', 'ID type'],
              ['<code>ua_type2</code>', 'uint8', 'Secondary UA type'],
              ['<code>id_type2</code>', 'uint8', 'Secondary ID type'],
              ['<code>wifi_ch</code>', 'uint8', 'WiFi channel'],
              ['<code>websrv_en</code>', 'uint8', 'Web server enabled (0/1)'],
              ['<code>mav_sysid</code>', 'uint8', 'MAVLink system ID'],
              ['<code>bcast_pwr</code>', 'uint8', 'Broadcast on power-up (0/1)'],
              ['<code>tx_modes</code>', 'uint8', 'Transmission mode bitmask']
            ]
          },
          {
            title: 'uint32',
            rows: [
              ['<code>options</code>', 'uint32', 'Options bitmask'],
              ['<code>baud</code>', 'uint32', 'UART baud rate']
            ]
          },
          {
            title: 'int8',
            rows: [
              ['<code>lock_lvl</code>', 'int8', 'Lock level (0-2)'],
              ['<code>led_r</code>', 'int8', 'RGB LED R GPIO (-1 = disabled)'],
              ['<code>led_g</code>', 'int8', 'RGB LED G GPIO (-1 = disabled)'],
              ['<code>led_b</code>', 'int8', 'RGB LED B GPIO (-1 = disabled)']
            ]
          },
          {
            title: 'float (stored as blob)',
            rows: [
              ['<code>wifi_pwr</code>', 'float', 'WiFi TX power (dBm)'],
              ['<code>wifi_bcn</code>', 'float', 'WiFi Beacon rate (Hz)'],
              ['<code>wifi_nan</code>', 'float', 'WiFi NaN rate (Hz)'],
              ['<code>bt4_rate</code>', 'float', 'BLE 4.0 rate (Hz)'],
              ['<code>bt4_pwr</code>', 'float', 'BLE 4.0 TX power (dBm)'],
              ['<code>bt5_rate</code>', 'float', 'BLE 5.0 rate (Hz)'],
              ['<code>bt5_pwr</code>', 'float', 'BLE 5.0 TX power (dBm)'],
              ['<code>op_lat</code>', 'float', 'Operator latitude'],
              ['<code>op_lon</code>', 'float', 'Operator longitude'],
              ['<code>op_alt</code>', 'float', 'Operator altitude (m)']
            ]
          }
        ]
      },
      {
        type: 'p',
        html: 'Runtime-only settings that are <b>not</b> persisted: protocol, UART port and TX/RX pins, DroneCAN RX/TX/bitrate, MAVLink USB, OTA trigger GPIO, auth private key, startup delay.'
      },
      {
        type: 'h',
        text: 'Status JSON Schema'
      },
      {
        type: 'code',
        code: `{
  "fw_version":       string, // firmware version
  "protocol":         int,    // 0=Unknown, 1=MAVLink, 2=MSP, 3=NMEA, 4=None
  "gps_valid":        bool,   // true if GPS has valid fix
  "lat":              float,  // decimal degrees
  "lon":              float,  // decimal degrees
  "alt":              float,  // meters MSL
  "speed":            float,  // m/s
  "heading":          int,    // degrees (0-360)
  "satellites":       int,    // number of satellites
  "fix_type":         int,    // 0=None, 2=2D, 3=3D
  "tx_total":         int,    // total transmissions since boot
  "tx_wifi_bcn":      int,    // WiFi Beacon packets sent
  "tx_wifi_nan":      int,    // WiFi NaN packets sent
  "tx_ble4":          int,    // BLE 4.0 packets sent
  "tx_ble5":          int,    // BLE 5.0 packets sent
  "takeoff_captured": bool,   // takeoff position captured
  "takeoff_lat":      float,  // takeoff latitude
  "takeoff_lon":      float,  // takeoff longitude
  "takeoff_alt":      float,  // takeoff altitude (m)
  "uptime_ms":        int     // ms since the last GPS update
}`
      },
      {
        type: 'p',
        html: 'The complete configuration payload (all parameters, including runtime-only ones) is described in <a href="#guide-config">Configuration Reference → Parameters</a>.'
      },
      {
        type: 'h',
        text: 'ODID Message Structure'
      },
      {
        type: 'p',
        html: 'Each transmission (WiFi Beacon or BLE advertisement) contains an ASTM F3411-22a message pack with up to 3 ODID messages. Each ODID message is 25 bytes and starts with a 1-byte message type header (Basic ID = 0x0, Location/Vector = 0x1, System = 0x2, Operator ID = 0x5, Self-ID = 0x6, etc.) followed by a 1-byte protocol version and a 23-byte payload. The messages are packed into a single payload:'
      },
      {
        type: 'flow',
        flow: {
          kind: 'pack',
          messages: [
            { id: '0x0', label: 'Basic ID', lines: 'UAS ID (serial/CAA) · ID type, UA type · 25 bytes' },
            { id: '0x1', label: 'Location / Vector', lines: 'Lat, Lon, Alt, Speed · Heading, Timestamp · 25 bytes' },
            { id: '0x2', label: 'System', lines: 'Operator location · Area count / radius · 25 bytes' }
          ],
          transports: [
            { name: 'WiFi Beacon', lines: '802.11 beacon frame · IE 221 (OUI FA 0B BC) · Most compatible' },
            { name: 'Bluetooth Low Energy', lines: 'BLE 4.0: Legacy advertising · BLE 5.0: Coded PHY (S=8) · Long range >300 m' }
          ],
          caption: 'ODID message pack structure: up to 3 ASTM messages per transmission, broadcast over WiFi Beacon or BLE.'
        }
      },
      {
        type: 'p',
        html: 'The messages are packed into a single payload according to the ASTM F3411-22a specification and transmitted as:'
      },
      {
        type: 'ul',
        items: [
          '<b>WiFi Beacon:</b> 802.11 beacon frame with OUI-based IE (Element ID 221, OUI: 0xFA 0x0B 0xBC)',
          '<b>BLE 4.0:</b> Advertising packet with standard ODID AD structure',
          '<b>BLE 5.0:</b> Extended advertising with ODID AD structure, Coded PHY (S=8) for long range'
        ]
      }
    ]
  },
  {
    id: 'regulatory',
    number: 12,
    title: 'Regulatory Information',
    icon: 'i-lucide-scale',
    blocks: [
      {
        type: 'h',
        text: 'Standards Compliance (targeted)'
      },
      {
        type: 'p',
        html: 'OmniRID targets the following standards (message encoding complete, compliance testing with certified receivers pending):'
      },
      {
        type: 'ul',
        items: [
          '<b>ASTM F3411-22a</b> — Standard Specification for Remote ID and Tracking. This is the US FAA-accepted standard that also forms the basis for many international regulations.',
          '<b>ASD-STAN prEN 4709-002</b> — European standard for direct Remote ID, adopted by EASA and EU member states.'
        ]
      },
      {
        type: 'h',
        text: 'FAA (United States)'
      },
      {
        type: 'p',
        html: 'FAA Part 89 requires all drones weighing more than 0.55 lb (250 g) and flown outdoors to broadcast Remote ID. The regulation came into effect on September 16, 2023. OmniRID helps drone operators comply with this requirement by:'
      },
      {
        type: 'ul',
        items: [
          'Broadcasting ASTM F3411-22a Standard Remote ID messages via WiFi Beacon and BLE',
          'Transmitting at 1 Hz (meeting the minimum requirement)',
          'Including all required data: drone ID, location, altitude, speed, operator ID'
        ]
      },
      {
        type: 'p',
        html: '<b>Note:</b> Regulatory compliance with certified receivers has <b>not been verified</b>. Do not use in actual flight operations until testing confirms compliance.'
      },
      {
        type: 'h',
        text: 'EASA (European Union)'
      },
      {
        type: 'p',
        html: 'EU Implementing Regulation 2021/664 (U-Space) and 2019/947 require Remote ID for most drone operations in the Open and Specific categories. Direct Remote ID (prEN 4709-002) has been mandatory since January 1, 2024. The same framework applies in the EEA states (Norway, Iceland, Liechtenstein) and non-EU EASA states (Switzerland). OmniRID supports compliance by broadcasting Direct Remote ID (prEN 4709-002) over WiFi and BLE.'
      },
      {
        type: 'h',
        text: 'Country-by-Country Overview'
      },
      {
        type: 'table',
        cols: ['Country / Region', 'Regulation', 'Effective Date', 'Notes'],
        rows: [
          ['🇺🇸 United States', 'FAA Part 89', 'Sep 16, 2023', 'Mandatory for all drones >250 g. ASTM F3411-22a required.'],
          ['🇪🇺 European Union', 'EU 2019/947 & 2021/664', 'Jan 1, 2024', 'Direct RID per prEN 4709-002. Required for Open & Specific categories.'],
          ['🇨🇭 Switzerland', 'EASA-aligned (FOCA)', 'Jan 1, 2024', 'Non-EU EASA state; applies the EASA Direct RID framework (prEN 4709-002).'],
          ['🇳🇴 Norway', 'EASA-aligned (CAA Norway)', 'Jan 1, 2024', 'EEA member; applies the EASA Direct RID framework.'],
          ['🇮🇸 Iceland', 'EASA-aligned (Icelandic CAA)', 'Jan 1, 2024', 'EEA member; applies the EASA Direct RID framework.'],
          ['🇱🇮 Liechtenstein', 'EASA-aligned (EEA)', 'Jan 1, 2024', 'EEA member; applies the EASA Direct RID framework.'],
          ['🇬🇧 United Kingdom', 'CAP 722 (CAA)', 'Nov 2023', 'Aligns with EU RID framework post-Brexit. Operator registration required.'],
          ['🇯🇵 Japan', 'MLIT / Civil Aeronautics Act', 'Jun 2022', 'Remote ID required for drones >100 g in specified areas.'],
          ['🇸🇬 Singapore', 'CAAS B-RID', 'Dec 1, 2025', 'Broadcast Remote ID mandatory for UAs >250 g flown outdoors. Operator permit exempted, FlyItSafe app; penalties up to S$10,000. Technical standard under verification for compatibility.'],
          ['🇨🇦 Canada', 'CAR Part IX (Transport Canada)', 'Not yet in force', 'Proposal only: NPA 2026-005 published Jun 8, 2026, comments until Sep 9, 2026; final rules expected ~2028, pilot compliance ~2030. ASTM F3411 named as a means of compliance.'],
          ['🇦🇺 Australia', 'CASR Part 101 (CASA)', 'Not yet mandated', 'No Remote ID mandate in force. 2023 discussion paper; policy impact analysis ongoing; rollout scoped for 2027.'],
          ['🇰🇷 South Korea', 'KASA RID', '2024 (phased)', 'Remote ID required for all drones >250 g; mandatory for commercial operations.'],
          ['🇧🇷 Brazil', 'RBAC 100 (ANAC)', 'Jun 16, 2026', 'RBAC 100 replaces RBAC-E 94 with a risk-based model. Remote ID not yet mandated.'],
          ['🇨🇳 China', 'GB 46750-2025 / UOM', 'May 1, 2026', 'Run-identification (network via UOM + broadcast) required for new drones, non-disablable; retrofit by Nov 1, 2026. Network-based, not open ASTM broadcast — compatibility under investigation.'],
          ['🇳🇿 New Zealand', 'Part 101 / CATI 101-1', 'Not yet mandated', 'No Remote ID mandate in force (mid-2026). CAA NZ monitoring international developments; no registration system.']
        ]
      },
      {
        type: 'h',
        text: 'FCC / CE Compliance'
      },
      {
        type: 'p',
        html: 'OmniRID operates in the 2.4 GHz ISM band. The ESP32\u2019s WiFi and BLE transmitters are certified under FCC Part 15 and CE RED when used with Espressif\u2019s reference modules. Using external antennas may affect compliance. Ensure your antenna setup complies with local radio regulations.'
      },
      {
        type: 'h',
        text: 'Operator Registration'
      },
      {
        type: 'p',
        html: 'Most countries require drone operators to register with the national aviation authority and display their operator ID on the drone. OmniRID allows you to set your operator ID in the configuration, which is included in the System Message (Type 2) of the ODID transmission. Check your local authority\u2019s requirements:'
      },
      {
        type: 'ul',
        items: [
          '<b>USA:</b> <a href="https://faadronezone.faa.gov" target="_blank">FAA DroneZone</a>',
          '<b>EU:</b> Register in your country\u2019s UAS system',
          '<b>UK:</b> <a href="https://register-drones.caa.co.uk" target="_blank">CAA Drone Registration</a>',
          '<b>Japan:</b> <a href="https://www.mlit.go.jp/koku" target="_blank">MLIT Drone Registration</a>',
          '<b>Canada:</b> <a href="https://tc.canada.ca/en/aviation" target="_blank">Transport Canada Drone Portal</a>',
          '<b>Australia:</b> <a href="https://www.casa.gov.au" target="_blank">CASA Drone Registration</a>'
        ]
      },
      {
        type: 'callout',
        tone: 'warning',
        title: 'Disclaimer',
        html: 'This firmware is a tool to assist with Remote ID compliance. It is your responsibility to verify that your specific configuration meets local regulations. The authors are not liable for any regulatory violations or penalties.'
      },
      {
        type: 'h',
        text: 'Recommended Practices'
      },
      {
        type: 'ul',
        items: [
          'Set your correct UAS ID (serial number or CAA registration).',
          'Set your correct Operator ID.',
          'Keep the firmware updated for regulatory changes.',
          'Test that your Remote ID signal is receivable by standard ODID receiver apps before operational use.',
          'Register your drone with your national aviation authority if required.',
          'Use a dedicated Remote ID receiver app to verify your broadcast before each flight session.',
          'Keep records of your UAS ID and operator registration for inspection if requested.'
        ]
      },
      {
        type: 'h',
        text: 'Tested Configurations'
      },
      {
        type: 'p',
        html: 'Demo mode (GPS patrol simulation) verified: config UI, telemetry dashboard and lock-level UI are functional. OTA is not implemented (flash via USB). Flight-controller hardware testing with MAVLink/MSP/NMEA is in progress.'
      },
      {
        type: 'p',
        html: 'If you have tested this firmware with your hardware, please <a href="https://github.com/VOLTEKOVER/OmniRID-Universal-Drone-ID/issues" target="_blank">open an issue</a> or submit a PR to share your results.'
      },
      {
        type: 'h',
        text: 'Protocol Maturity'
      },
      {
        type: 'table',
        cols: ['Protocol', 'Status', 'Notes'],
        rows: [
          ['WiFi Beacon', `Stable`, 'IEEE 802.11 beacon frames with OUI-based IE (FA:0B:BC). Enabled by default. Verified in demo mode.'],
          ['WiFi NAN', `Implemented`, 'Neighborhood Area Networking frames. UI checkbox + counters functional. Awaiting receiver testing.'],
          ['BLE 4.0', `Stable`, 'Legacy BLE advertising (SCAN_IND). All ESP32 variants. Disabled by default — enable it in Tx Modes.'],
          ['BLE 5.0 LR (Coded PHY)', `Implemented`, 'Requires S3 (C6 pending, see issue #45). Disabled by default. Awaiting hardware testing with Android/iOS.'],
          ['MAVLink (input)', `Implemented`, 'v1/v2 parsers + ODID messages (ardupilotmega dialect). AHRS2 heading. Awaiting FC hardware.'],
          ['MSP (input)', `Implemented`, 'MSP v1 (RAW_GPS, ATTITUDE). Awaiting Betaflight/iNAV hardware testing.'],
          ['NMEA 0183 (input)', `Implemented`, 'GGA + RMC + VTG parsers. Works with tap method. Awaiting GPS module testing.']
        ]
      }
    ]
  },
  {
    id: 'contributing',
    number: 13,
    title: 'Contributing',
    icon: 'i-lucide-git-pull-request',
    blocks: [
      {
        type: 'h',
        text: 'How to Contribute'
      },
      {
        type: 'p',
        html: 'Contributions are welcome! Here are ways you can help:'
      },
      {
        type: 'ul',
        items: [
          '<b>Report bugs:</b> Open an issue on <a href="https://github.com/VOLTEKOVER/OmniRID-Universal-Drone-ID/issues" target="_blank">GitHub Issues</a>',
          '<b>Feature requests:</b> Open an issue or discussion with your proposal.',
          '<b>Code contributions:</b> Fork the repository, create a branch, and submit a Pull Request.',
          '<b>Documentation:</b> Improve the wiki, this guide, or add translations.',
          '<b>Testing:</b> Test the firmware on different flight controllers and report results.'
        ]
      },
      {
        type: 'h',
        text: 'Code Style'
      },
      {
        type: 'ul',
        items: [
          'Rust code: <code>cargo fmt</code> (edition 2024), <code>cargo clippy -D warnings</code>.',
          '<code>no_std</code> for firmware crates; <code>std</code> only in <code>bsp-esp32</code>.',
          'Keep <code>unsafe</code> out of core crates (only in hardware glue).',
          'UI code: Nuxt 4 / Vue 3 in <code>OmniRID-app/</code>; the firmware is headless (no embedded HTML) — all UI lives in the app.'
        ]
      },
      {
        type: 'h',
        text: 'Development Workflow'
      },
      {
        type: 'code',
        code: `git clone https://github.com/VOLTEKOVER/OmniRID-Universal-Drone-ID.git
cd OmniRID-Universal-Drone-ID
git checkout -b my-feature-branch
cd OmniRID
# Make changes
cargo test --workspace
cargo clippy --workspace -- -D warnings
# Commit and push
git push -u origin my-feature-branch`
      },
      {
        type: 'h',
        text: 'Adding a New Protocol'
      },
      {
        type: 'p',
        html: 'To add support for a new protocol:'
      },
      {
        type: 'ol',
        items: [
          'Create a new crate in <code>inputs/proto-myproto/</code> with a <code>Cargo.toml</code> and <code>src/lib.rs</code>.',
          'Implement the standard parser trait from <code>rid-interface</code>: <code>fn parse(&amp;mut self, byte: u8) -&gt; Option&lt;InputSample&gt;</code> and <code>fn source_name(&amp;self) -&gt; &amp;str</code>.',
          'Register the new protocol in the auto-detection sequence in <code>rid-interface/src/input.rs</code>.',
          'Test with your hardware and submit a PR.'
        ]
      },
      {
        type: 'h',
        text: 'Disclaimer & Acknowledgments'
      },
      {
        type: 'p',
        html: 'This is a <b>personal open-source project</b> made public for educational and research purposes. It is <b>not affiliated with, endorsed by, or derived from ArduPilot</b>. The project takes <b>inspiration</b> from the functionality of ArduPilot\u2019s ArduRemoteID system and implements a compatible Remote ID transmitter using independent code written from scratch for the ESP32 platform in Rust.'
      },
      {
        type: 'p',
        html: 'The author respects all intellectual property rights. No ArduPilot source code has been copied or incorporated. The implementation follows the open ASTM F3411-22a standard and uses the <b>opendroneid-sys</b> FFI bindings (BSD-3-Clause) for ODID message packing.'
      },
      {
        type: 'p',
        html: 'Technologies and protocols referenced:'
      },
      {
        type: 'ul',
        items: [
          '<b>ArduRemoteID</b> — functional inspiration from ArduPilot\u2019s Remote ID implementation',
          '<b>OpenDroneID sys</b> — Intel\u2019s ODID FFI bindings (BSD-3-Clause)',
          '<b>MAVLink</b> — lightweight communication protocol (MIT)',
          '<b>MSP</b> — MultiWii Serial Protocol',
          '<b>Rust + ESP-IDF</b> — Firmware in Rust, hardware glue via esp-idf-sys (Apache 2.0)'
        ]
      },
      {
        type: 'h',
        text: 'License'
      },
      {
        type: 'p',
        html: 'This project is released under the <b>Apache License 2.0</b>. See the <code>LICENSE</code> file in the repository for details.'
      }
    ]
  }
]
