interface Navigator {
  serial?: Serial
}

interface Serial {
  getPorts(): Promise<SerialPort[]>
  requestPort(options?: SerialPortRequestOptions): Promise<SerialPort>
}

interface SerialPortRequestOptions {
  filters?: unknown[]
}

interface SerialPort {
  open(options: { baudRate: number; bufferSize?: number }): Promise<void>
  close(): Promise<void>
  readable: ReadableStream<Uint8Array> | null
  writable: WritableStream<Uint8Array> | null
}