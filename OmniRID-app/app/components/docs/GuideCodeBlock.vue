<script setup lang="ts">
const props = defineProps<{
  code: string
  label?: string
}>()

const copied = ref(false)
async function copyCode() {
  try {
    await navigator.clipboard.writeText(props.code)
    copied.value = true
    setTimeout(() => { copied.value = false }, 1600)
  } catch {
    const ta = document.createElement('textarea')
    ta.value = props.code
    ta.style.position = 'fixed'
    ta.style.opacity = '0'
    document.body.appendChild(ta)
    ta.select()
    try { document.execCommand('copy') } catch { /* noop */ }
    document.body.removeChild(ta)
    copied.value = true
    setTimeout(() => { copied.value = false }, 1600)
  }
}
</script>

<template>
  <div class="overflow-hidden rounded-2xl border border-default bg-muted">
    <div class="flex items-center justify-between gap-3 border-b border-default bg-elevated/60 px-3 py-2">
      <span class="flex min-w-0 items-center gap-2">
        <span class="flex shrink-0 gap-1.5">
          <span class="size-2.5 rounded-full bg-red-400/70" />
          <span class="size-2.5 rounded-full bg-yellow-400/70" />
          <span class="size-2.5 rounded-full bg-green-400/70" />
        </span>
        <UBadge color="neutral" variant="subtle" size="xs" class="truncate">
          <UIcon name="i-lucide-file-code-2" class="size-3" />
          {{ label ?? 'Code' }}
        </UBadge>
      </span>
      <UButton
        size="xs"
        color="neutral"
        variant="ghost"
        :icon="copied ? 'i-lucide-check' : 'i-lucide-copy'"
        :label="copied ? 'Copied' : 'Copy'"
        class="shrink-0"
        @click="copyCode"
      />
    </div>
    <pre class="overflow-x-auto p-4 text-xs leading-6 text-highlighted"><code class="font-mono">{{ code }}</code></pre>
  </div>
</template>