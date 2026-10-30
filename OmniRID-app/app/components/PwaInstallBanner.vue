<template>
  <div v-if="canInstall" class="fixed bottom-4 left-4 right-4 z-50 sm:left-auto sm:right-4 sm:max-w-sm">
    <UAlert
      color="primary"
      icon="i-lucide-download"
      title="Install OmniRID app"
      variant="soft"
      :close-button="{ icon: 'i-lucide-x', color: 'neutral', variant: 'link', padded: false }"
      @close="dismiss"
    >
      <template #description>
        <div class="flex items-center justify-between gap-3">
          <span class="text-sm">Install for faster access and offline use.</span>
          <UButton
            size="xs"
            color="primary"
            label="Install"
            @click="onInstall"
          />
        </div>
      </template>
    </UAlert>
  </div>
</template>

<script setup lang="ts">
import { usePwaInstall } from '~/composables/usePwaInstall'
import { useNotifications } from '~/composables/useNotifications'

const { canInstall, install } = usePwaInstall()
const { notifyInfo } = useNotifications()
const dismissed = useState<boolean>('omnirid-pwa-install-dismissed', () => false)
if (import.meta.client) {
  dismissed.value = localStorage.getItem('omnirid-pwa-install-dismissed') === '1'
}

const dismiss = () => {
  dismissed.value = true
  if (import.meta.client) localStorage.setItem('omnirid-pwa-install-dismissed', '1')
}

const onInstall = async () => {
  const ok = await install()
  if (ok) {
    notifyInfo('App installed', 'OmniRID is now available as an installed app.')
    dismiss()
  }
}
</script>
