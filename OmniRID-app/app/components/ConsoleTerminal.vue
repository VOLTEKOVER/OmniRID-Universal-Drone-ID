<script setup lang="ts">
import { nextTick, onMounted, watch } from 'vue'
import type { FirmwareLogLevel as LogLevel } from '~/composables/useFirmwareLogs'

const { isEspConnected, proxyFetch } = useEspConnection()
const { lines, push, clear: clearLines } = useFirmwareLogs()
const { notifyError } = useNotifications()
const toast = useToast()

const command = ref('')
const signature = ref('')
const isSending = ref(false)
const autoScroll = ref(true)
const showTimestamps = ref(true)
const levelFilter = ref<'all' | LogLevel>('all')
const history = ref<string[]>([])
const historyCursor = ref(-1)
const scrollRef = ref<HTMLElement | null>(null)

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

const visibleLines = computed(() =>
  levelFilter.value === 'all' ? lines.value : lines.value.filter(line => line.level === levelFilter.value)
)

const filterOptions = computed(() => {
  const byLevel = (level: LogLevel) => lines.value.filter(line => line.level === level).length
  return [
    { value: 'all' as const, label: 'All', count: lines.value.length },
    { value: 'debug' as const, label: 'Debug', count: byLevel('debug') },
    { value: 'info' as const, label: 'Info', count: byLevel('info') },
    { value: 'warning' as const, label: 'Warn', count: byLevel('warning') },
    { value: 'error' as const, label: 'Error', count: byLevel('error') }
  ]
})

const formatTime = (at: number) => new Date(at).toLocaleTimeString([], { hour12: false })

const quickCommands = [
  { cmd: 'status', destructive: false },
  { cmd: 'restart', destructive: true },
  { cmd: 'reset', destructive: true }
]

const scrollToBottom = async () => {
  if (!autoScroll.value || !scrollRef.value) return
  await nextTick()
  scrollRef.value.scrollTop = scrollRef.value.scrollHeight
}

watch(() => visibleLines.value.length, scrollToBottom)

const clearOutput = () => {
  clearLines()
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
    push('error', `Command rejected: ${message}.`)
    notifyError('Command rejected', `${cmd}: ${message}`)
    toast.add({
      title: 'Command rejected',
      description: `${cmd}: ${message}`,
      icon: 'i-lucide-circle-alert',
      color: 'error'
    })
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

const inputRef = ref<{ inputRef?: HTMLInputElement } | null>(null)

const focusInput = () => {
  inputRef.value?.inputRef?.focus()
}

const useQuickCommand = (cmd: string) => {
  command.value = cmd
  focusInput()
}

onMounted(() => {
  nextTick(() => focusInput())
})

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
    <div class="overflow-hidden rounded-lg border border-neutral-700/70 bg-neutral-950 shadow-sm">
      <div class="border-b border-neutral-800 bg-neutral-900">
        <div class="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
          <p class="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-neutral-400">
            <span class="relative flex size-2">
              <span
                v-if="isEspConnected"
                class="absolute inline-flex size-full animate-ping rounded-full bg-emerald-500 opacity-60"
              />
              <span class="relative inline-flex size-2 rounded-full" :class="isEspConnected ? 'bg-emerald-500' : 'bg-neutral-600'" />
            </span>
            <span class="hidden sm:inline">{{ isEspConnected ? 'Live log' : 'Offline' }}</span>
          </p>
          <div class="flex items-center gap-1">
            <UButton
              color="neutral"
              variant="ghost"
              size="xs"
              icon="i-lucide-clock"
              class="hover:!bg-neutral-800"
              :ui="ghostUi"
              :aria-label="showTimestamps ? 'Hide timestamps' : 'Show timestamps'"
              @click="showTimestamps = !showTimestamps"
            >
              <span class="hidden lg:inline">{{ showTimestamps ? 'Timestamps on' : 'Timestamps off' }}</span>
            </UButton>
            <UButton
              color="neutral"
              variant="ghost"
              size="xs"
              icon="i-lucide-chevrons-down"
              class="hover:!bg-neutral-800"
              :ui="ghostUi"
              :aria-label="autoScroll ? 'Auto-scroll on' : 'Auto-scroll off'"
              @click="autoScroll = !autoScroll"
            >
              <span class="hidden lg:inline">{{ autoScroll ? 'Auto-scroll on' : 'Auto-scroll off' }}</span>
            </UButton>
            <UButton
              color="neutral"
              variant="ghost"
              size="xs"
              icon="i-lucide-copy"
              :disabled="!lines.length"
              class="hover:!bg-neutral-800"
              :ui="ghostUi"
              aria-label="Copy output"
              @click="copyOutput"
            >
              <span class="hidden md:inline">Copy</span>
            </UButton>
            <UButton
              color="neutral"
              variant="ghost"
              size="xs"
              icon="i-lucide-trash"
              :disabled="!lines.length"
              class="hover:!bg-neutral-800"
              :ui="ghostUi"
              aria-label="Clear output"
              @click="clearOutput"
            >
              <span class="hidden md:inline">Clear</span>
            </UButton>
          </div>
        </div>

        <div class="flex flex-wrap items-center gap-1 border-t border-neutral-800 px-3 py-1.5">
          <button
            v-for="option in filterOptions"
            :key="option.value"
            type="button"
            class="flex items-center gap-1.5 rounded-sm px-2 py-0.5 font-mono text-[11px] transition-colors"
            :class="levelFilter === option.value ? 'bg-neutral-700 text-neutral-100' : 'text-neutral-400 hover:bg-neutral-800'"
            @click="levelFilter = option.value"
          >
            {{ option.label }}
            <span class="text-neutral-500">{{ option.count }}</span>
          </button>
          <span class="ml-auto font-mono text-[11px] text-neutral-500">{{ visibleLines.length }}/{{ lines.length }} lines</span>
        </div>
      </div>

      <div ref="scrollRef" class="h-80 overflow-y-auto p-4 font-mono text-[13px] leading-6">
        <p v-if="!visibleLines.length" class="text-neutral-600">
          {{ lines.length
            ? 'No lines match this filter.'
            : isEspConnected
              ? 'Waiting for logs…'
              : 'ESP not connected — logs appear once the device is reachable.' }}
        </p>
        <p
          v-for="line in visibleLines"
          :key="line.id"
          class="flex gap-2 whitespace-pre-wrap break-words"
        >
          <span class="w-4 shrink-0 select-none text-center text-xs" :class="levelTagClass[line.level]">{{ levelTag[line.level] }}</span>
          <span v-if="showTimestamps" class="shrink-0 select-none text-[11px] text-neutral-500">{{ formatTime(line.at) }}</span>
          <span class="min-w-0" :class="levelTextClass[line.level]">{{ line.text }}</span>
        </p>
      </div>
    </div>

    <div class="space-y-2 overflow-hidden rounded-lg border border-neutral-700/70 bg-neutral-950 p-3 shadow-sm">
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
        <UButton
          type="button"
          color="primary"
          icon="i-lucide-send"
          label="Send"
          :loading="isSending"
          :disabled="!command.trim()"
          @click="send"
        />
      </div>
      <div class="flex flex-wrap items-center gap-1.5">
        <span class="text-[11px] uppercase tracking-wider text-neutral-500">Quick</span>
        <button
          v-for="quick in quickCommands"
          :key="quick.cmd"
          type="button"
          class="rounded-sm border border-neutral-700 px-2 py-0.5 font-mono text-[11px] transition-colors hover:bg-neutral-800"
          :class="quick.destructive ? 'text-amber-400' : 'text-neutral-300'"
          @click="useQuickCommand(quick.cmd)"
        >
          {{ quick.cmd }}
        </button>
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
        <p class="text-xs text-neutral-500">
          Use ↑ / ↓ to recall commands.
        </p>
      </div>
    </div>

    <p class="text-xs text-muted">
      Logs: <code class="rounded bg-elevated px-1">GET /api/logs</code> ·
      Commands: <code class="rounded bg-elevated px-1">POST /api/command</code> (restart and reset require an <code class="rounded bg-elevated px-1">X-Signature</code> when locked).
    </p>
  </div>
</template>
