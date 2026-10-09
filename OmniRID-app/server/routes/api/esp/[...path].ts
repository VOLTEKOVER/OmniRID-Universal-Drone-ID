const DEFAULT_ESP_IP = '192.168.4.1'
const DEFAULT_ESP_TIMEOUT_MS = 4000
const MAX_ESP_TIMEOUT_MS = 300000

export default defineEventHandler(async (event) => {
  const target = getHeader(event, 'x-esp-ip')?.trim() || DEFAULT_ESP_IP
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

    const text = await upstream.text()
    const upstreamContentType = upstream.headers.get('content-type')
    if (upstreamContentType) setHeader(event, 'content-type', upstreamContentType)
    event.node.res.statusCode = upstream.status
    return text
  } catch (error) {
    clearTimeout(timer)
    event.node.res.statusCode = 502
    return {
      error: 'ESP unreachable',
      detail: error instanceof Error ? error.message : 'Unable to reach the device'
    }
  }
})