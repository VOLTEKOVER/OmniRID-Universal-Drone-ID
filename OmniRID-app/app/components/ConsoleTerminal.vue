<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, watch } from 'vue'
import { useIntervalFn } from '@vueuse/core'

type LogLevel = 'debug' | 'info' | 'warning' | 'error' | 'command'

type LogLine = {
  id: number
  at: number
  level: LogLevel
  text: string
}

type FirmwareLogEntry = {
  t?: number
  l?: string
  m?: string
}

const { isEspConnected, proxyFetch } = useEspConnection()

const lines = ref<LogLine[]>([])
const command = ref('')
const signature = ref('')
const isSending = ref(false)
const autoScroll = ref(true)
const history = ref<string[]>([])
const historyCursor = ref(-1)
const scrollRef = ref<HTMLElement | null>(null)

let lineId = 0

const push = (level: LogLevel, text: string) => {
  lines.value.push({ id: ++lineId, at: Date.now(), level, text })
  if (lines.value.length > 500) lines.value.splice(0, lines.value.length - 500)
}

const levelCharMap: Record<string, LogLevel> = {
  D: 'debug', d: 'debug', '0': 'debug',
  I: 'info', i: 'info', '1': 'info', '2': 'info',
  W: 'warning', w: 'warning', '3': 'warning',
  E: 'error', e: 'error', '4': 'error', '5': 'error',
  '6': 'error'
}

const firmwareLevel = (level?: string): LogLevel => levelCharMap[level ?? ''] ?? 'info'

const levelTag: Record<LogLevel, string> = {
  debug: 'D',
  info: 'I',
  warning: 'W',
  error: 'E',
  command: '>'
}

const levelTagClass: Record<LogLevel, string> = {
  debug: 'text-neutral-700',
  info: 'text-neutral-500',
  warning: 'text-amber-600/80',
  error: 'text-red-500/80',
  command: 'text-sky-500/80'
}

const levelTextClass: Record<LogLevel, string> = {
  debug: 'text-neutral-600',
  info: 'text-neutral-200',
  warning: 'text-amber-400',
  error: 'text-red-400',
  command: 'text-sky-400'
}

const pollLogs = async () => {
  if (!isEspConnected.value) return
  try {
    const data = await proxyFetch<FirmwareLogEntry[] | null>('api/logs', { timeout: 3000 })
    if (!Array.isArray(data)) return
    const seen = new Set(lines.value.map(line => `${line.at}:${line.text}`))
    for (const row of data) {
      const text = String(row.m ?? '').trim()
      if (!text) continue
      const at = Number(row.t ?? 0)
      const key = `${at}:${text}`
      if (seen.has(key)) continue
      seen.add(key)
      push(firmwareLevel(row.l), text)
    }
  } catch {
    // Logs are best-effort; connection errors surface in the header.
  }
}

const { pause: pausePolling, resume: resumePolling } = useIntervalFn(pollLogs, 3000)

watch(isEspConnected, (connected) => {
  if (connected) {
    pollLogs()
    resumePolling()
  } else {
    pausePolling()
  }
})

const scrollToBottom = async () => {
  if (!autoScroll.value || !scrollRef.value) return
  await nextTick()
  scrollRef.value.scrollTop = scrollRef.value.scrollHeight
}

watch(() => lines.value.length, scrollToBottom)

const clearOutput = () => {
  lines.value = []
}

const copyOutput = async () => {
  const text = lines.value.map(line => line.text).join('\n')
  if (!text) return
  await navigator.clipboard.writeText(text)
}

const send = async () => {
  const cmd = command.value.trim()
  if (!cmd || isSending.value) return

  push('command', `> ${cmd}`)
  command.value = ''
  historyCursor.value = -1
  history.value = [cmd, ...history.value.filter(item => item !== cmd)].slice(0, 50)
  signature.value = signature.value.trim()

  isSending.value = true
  try {
    const headers: Record<string, string> = {}
    if (signature.value) headers['X-Signature'] = signature.value
    await proxyFetch<{ ok?: boolean, error?: string }>('api/command', {
      method: 'POST',
      body: cmd,
      headers,
      timeout: 5000
    })
    push('info', 'Command accepted.')
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Request failed'
    push('error', `Command rejected: ${message}. The firmware must expose POST /api/command.`)
  } finally {
    isSending.value = false
  }
}

const onKeydown = (event: KeyboardEvent) => {
  if (event.key === 'ArrowUp') {
    event.preventDefault()
    if (history.value.length === 0) return
    historyCursor.value = Math.min(historyCursor.value + 1, history.value.length - 1)
    command.value = history.value[historyCursor.value] ?? ''
  } else if (event.key === 'ArrowDown') {
    event.preventDefault()
    historyCursor.value = Math.max(historyCursor.value - 1, -1)
    command.value = historyCursor.value >= 0 ? history.value[historyCursor.value] ?? '' : ''
  }
}

const inputRef = ref<HTMLInputElement | null>(null)

onMounted(() => {
  if (isEspConnected.value) resumePolling()
  nextTick(() => inputRef.value?.focus())
})

onBeforeUnmount(pausePolling)

const termInputUi = {
  root: '!bg-neutral-900',
  base: '!border-neutral-800 !bg-neutral-900 !text-neutral-100 !placeholder:text-neutral-500',
  leadingIcon: '!text-neutral-500'
}

const ghostUi = {
  label: '!text-neutral-400',
  leadingIcon: '!text-neutral-400'
}
</script>

<template>
  <div class="space-y-3">
    <div class="overflow-hidden rounded-2xl border border-neutral-700/70 bg-neutral-950 shadow-sm">
      <div class="flex items-center justify-between gap-2 border-b border-neutral-800 bg-neutral-900 px-2 py-2 sm:px-3">
        <p class="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-neutral-400">
          <span class="relative flex size-2">
            <span class="absolute inline-flex size-full animate-ping rounded-full bg-emerald-500 opacity-60" />
            <span class="relative inline-flex size-2 rounded-full bg-emerald-500" />
          </span>
          <span class="hidden sm:inline">Live log</span>
        </p>
        <div class="flex gap-1">
          <UButton color="neutral" variant="ghost" size="xs" icon="i-lucide-chevrons-down" class="hover:!bg-neutral-800" :ui="ghostUi" :aria-label="autoScroll ? 'Auto-scroll on' : 'Auto-scroll off'" @click="autoScroll = !autoScroll">
            <span class="hidden lg:inline">{{ autoScroll ? 'Auto-scroll on' : 'Auto-scroll off' }}</span>
          </UButton>
          <UButton color="neutral" variant="ghost" size="xs" icon="i-lucide-copy" :disabled="!lines.length" class="hover:!bg-neutral-800" :ui="ghostUi" aria-label="Copy output" @click="copyOutput">
            <span class="hidden md:inline">Copy</span>
          </UButton>
          <UButton color="neutral" variant="ghost" size="xs" icon="i-lucide-trash" :disabled="!lines.length" class="hover:!bg-neutral-800" :ui="ghostUi" aria-label="Clear output" @click="clearOutput">
            <span class="hidden md:inline">Clear</span>
          </UButton>
        </div>
      </div>

      <div ref="scrollRef" class="h-80 overflow-y-auto p-4 font-mono text-[13px] leading-6">
        <p v-if="!lines.length" class="text-neutral-600">
          Waiting for logs…
        </p>
        <p
          v-for="line in lines"
          :key="line.id"
          class="flex gap-2 whitespace-pre-wrap break-words"
        >
          <span class="w-4 shrink-0 select-none text-center text-xs" :class="levelTagClass[line.level]">{{ levelTag[line.level] }}</span>
          <span class="min-w-0" :class="levelTextClass[line.level]">{{ line.text }}</span>
        </p>
      </div>
    </div>

    <div class="space-y-2 overflow-hidden rounded-2xl border border-neutral-700/70 bg-neutral-950 p-3 shadow-sm">
      <div class="flex gap-2">
        <span class="flex items-center pl-1 font-mono text-sm font-semibold text-sky-400">$</span>
        <UInput
          ref="inputRef"
          v-model="command"
          class="flex-1"
          placeholder="status, restart, reset…"
          aria-label="CLI command"
          :disabled="isSending"
          :ui="termInputUi"
          @keydown.enter.prevent="send"
          @keydown="onKeydown"
        />
        <UButton type="button" color="primary" icon="i-lucide-send" label="Send" :loading="isSending" :disabled="!command.trim()" @click="send" />
      </div>
      <div class="flex flex-wrap items-center gap-2">
        <UInput
          v-model="signature"
          class="w-full sm:w-80"
          placeholder="X-Signature (required when device is locked)"
          icon="i-lucide-key-round"
          aria-label="Command signature"
          :ui="termInputUi"
        />
        <p class="text-xs text-neutral-500">Use ↑ / ↓ to recall commands.</p>
      </div>
    </div>

    <p class="text-xs text-muted">
      Logs: <code class="rounded bg-elevated px-1">GET /api/logs</code> ·
      Commands: <code class="rounded bg-elevated px-1">POST /api/command</code> (restart and reset require an <code>X-Signature</code> when locked).
    </p>
  </div>
</template>