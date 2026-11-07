export const MAX_ESP_TIMEOUT_MS = 900000
export const DEFAULT_ESP_TIMEOUT_MS = 4000
export const MAX_OTA_REQUEST_BYTES = 16 * 1024 * 1024
export const MAX_API_REQUEST_BYTES = 16 * 1024

const ALLOWED_METHODS: Record<string, readonly string[]> = {
  '/api/config': ['GET', 'POST'],
  '/api/status': ['GET'],
  '/api/memory': ['GET'],
  '/api/capabilities': ['GET'],
  '/api/reset': ['POST'],
  '/api/logs': ['GET'],
  '/api/command': ['POST'],
  '/api/app/auth/status': ['GET'],
  '/api/app/auth': ['POST'],
  '/api/app/auth/set': ['POST'],
  '/ota': ['POST']
}

export class RequestTooLargeError extends Error {}

export const isAllowedDeviceApiRequest = (path: string, method: string) =>
  ALLOWED_METHODS[path]?.includes(method) ?? false

export const hasAllowedDeviceApiPath = (path: string) => path in ALLOWED_METHODS

export const espTimeoutMs = (raw: string | undefined) => {
  const requestedTimeout = Number(raw ?? '')
  return Number.isFinite(requestedTimeout) && requestedTimeout > 0
    ? Math.min(requestedTimeout, MAX_ESP_TIMEOUT_MS)
    : DEFAULT_ESP_TIMEOUT_MS
}

export const boundedBodyStream = (
  source: ReadableStream<Uint8Array>,
  maxBytes: number,
  onTooLarge: () => void
) => {
  let total = 0
  return source.pipeThrough(new TransformStream<Uint8Array, Uint8Array>({
    transform(chunk, controller) {
      total += chunk.byteLength
      if (total > maxBytes) {
        onTooLarge()
        controller.error(new RequestTooLargeError(`Request exceeds ${maxBytes} bytes`))
        return
      }
      controller.enqueue(chunk)
    }
  }))
}
