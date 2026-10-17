import { isIP } from 'node:net'

const DEFAULT_ESP_IP = '192.168.4.1'
const DEFAULT_ESP_TIMEOUT_MS = 4000
// OTA uploads run through this proxy and legitimately need a long window
// (the firmware page requests 5 minutes via `x-esp-timeout`).
const MAX_ESP_TIMEOUT_MS = 300000
// Upper bound on the proxied response size, to avoid unbounded memory use.
const MAX_RESPONSE_BYTES = 1024 * 1024

/**
 * Only RFC1918 private IPv4 literals are accepted as device addresses.
 * This keeps the proxy from being abused for SSRF (cloud metadata,
 * loopback services, public hosts, etc.).
 */
const isPrivateIpv4 = (host: string) => {
  if (isIP(host) !== 4) return false
  const [a, b] = host.split('.').map(Number)
  if (a === 10) return true
  if (a === 172 && b >= 16 && b <= 31) return true
  if (a === 192 && b === 168) return true
  return false
}

/**
 * Resolve the upstream target from `x-esp-ip`, returning `host` or
 * `host:port`. Returns `null` for anything that is not a private IPv4
 * literal (no credentials, path, query, fragment or hostname allowed).
 */
const resolveTarget = (raw: string | undefined): string | null => {
  const candidate = (raw ?? '').trim() || DEFAULT_ESP_IP
  if (/[@/?#\s]/.test(candidate)) return null
  const parts = candidate.split(':')
  if (parts.length > 2) return null
  const [host, port] = parts
  if (!host || !isPrivateIpv4(host)) return null
  if (port !== undefined) {
    if (!/^\d{1,5}$/.test(port)) return null
    const portNumber = Number(port)
    if (portNumber < 1 || portNumber > 65535) return null
  }
  return port ? `${host}:${port}` : host
}

/** Read an upstream response body, aborting if it exceeds `maxBytes`. */
const readLimitedText = async (response: Response, maxBytes: number): Promise<string> => {
  if (!response.body) return await response.text()
  const reader = response.body.getReader()
  const chunks: Uint8Array[] = []
  let total = 0
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    if (!value) continue
    total += value.byteLength
    if (total > maxBytes) {
      await reader.cancel()
      throw new Error(`Upstream response exceeds ${maxBytes} bytes`)
    }
    chunks.push(value)
  }
  const merged = new Uint8Array(total)
  let offset = 0
  for (const chunk of chunks) {
    merged.set(chunk, offset)
    offset += chunk.byteLength
  }
  return new TextDecoder().decode(merged)
}

export default defineEventHandler(async (event) => {
  const target = resolveTarget(getHeader(event, 'x-esp-ip'))
  if (!target) {
    event.node.res.statusCode = 400
    return {
      error: 'Invalid device address',
      detail: 'The ESP address must be a private IPv4 address (e.g. 192.168.4.1).'
    }
  }

  const path = getRouterParam(event, 'path') ?? ''
  const method = getMethod(event)

  const requestedTimeout = Number(getHeader(event, 'x-esp-timeout') ?? '')
  const timeoutMs = Number.isFinite(requestedTimeout) && requestedTimeout > 0
    ? Math.min(requestedTimeout, MAX_ESP_TIMEOUT_MS)
    : DEFAULT_ESP_TIMEOUT_MS

  const query = getQuery(event)
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined) search.set(key, String(value))
  }
  const queryString = search.toString() ? `?${search.toString()}` : ''

  const headers: Record<string, string> = {
    'user-agent': 'OmniRID-app/1.0'
  }
  if (method !== 'GET' && method !== 'HEAD') {
    const contentType = getHeader(event, 'content-type')
    if (contentType) headers['content-type'] = contentType
    const expectedSha = getHeader(event, 'x-expected-sha256')
    if (expectedSha) headers['x-expected-sha256'] = expectedSha
    // Forward the Ed25519 signature required by locked devices.
    const signature = getHeader(event, 'x-signature')
    if (signature) headers['x-signature'] = signature
  } else {
    headers.accept = 'application/json, text/plain, */*'
  }

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const rawBody = method !== 'GET' && method !== 'HEAD'
      ? await readRawBody(event, false).catch(() => undefined)
      : undefined
    const body = rawBody === undefined ? undefined : new Uint8Array(rawBody)

    const upstream = await fetch(`http://${target}/${path}${queryString}`, {
      method,
      headers,
      body,
      signal: controller.signal,
      redirect: 'manual'
    })
    clearTimeout(timer)

    const text = await readLimitedText(upstream, MAX_RESPONSE_BYTES)
    const upstreamContentType = upstream.headers.get('content-type')
    if (upstreamContentType) {
      // Never let upstream HTML be rendered: downgrade it to plain text.
      setHeader(event, 'content-type', /html/i.test(upstreamContentType)
        ? 'text/plain; charset=utf-8'
        : upstreamContentType)
    }
    setHeader(event, 'x-content-type-options', 'nosniff')
    event.node.res.statusCode = upstream.status
    return text
  } catch (error) {
    clearTimeout(timer)
    // Keep details server-side; don't leak internal hosts or ports.
    console.error('[esp-proxy]', target, error instanceof Error ? error.message : error)
    event.node.res.statusCode = 502
    return { error: 'ESP unreachable' }
  }
})
