<script setup lang="ts">
import { formatTimeAgo } from '@vueuse/core'
import type { SystemNotification, SystemNotificationType } from '~/composables/useNotifications'

const { isNotificationsSlideoverOpen } = useDashboard()
const { notifications, unreadCount, markAllRead, clear } = useNotifications()

const notificationIcon = (type: SystemNotificationType) => ({
  error: 'i-lucide-circle-x',
  warning: 'i-lucide-triangle-alert',
  info: 'i-lucide-circle-check'
}[type])

const notificationColor = (type: SystemNotificationType) => ({
  error: 'text-error',
  warning: 'text-warning',
  info: 'text-success'
}[type])
</script>

<template>
  <USlideover
    v-model:open="isNotificationsSlideoverOpen"
    title="Notification history"
  >
    <template #body>
      <div class="mb-2 flex items-center justify-between gap-2 border-b border-default px-1 pb-2">
        <p class="text-xs text-muted">
          {{ unreadCount ? `${unreadCount} unread` : 'All caught up' }}
        </p>
        <div class="flex gap-1">
          <UButton color="neutral" variant="ghost" size="xs" icon="i-lucide-check-check" label="Mark all read" :disabled="!unreadCount" @click="markAllRead" />
          <UButton color="neutral" variant="ghost" size="xs" icon="i-lucide-trash" label="Clear" :disabled="!notifications.length" @click="clear" />
        </div>
      </div>

      <UEmpty
        v-if="!notifications.length"
        icon="i-lucide-bell-off"
        title="No notifications"
        description="Errors, warnings and updates from the ESP connection will appear here."
      />

      <div
        v-for="notification in notifications"
        :key="notification.id"
        class="flex items-start gap-3 border-b border-default px-1 py-4 last:border-b-0"
      >
        <UIcon :name="notificationIcon(notification.type)" :class="notificationColor(notification.type)" class="mt-0.5 size-5 shrink-0" />

        <div class="min-w-0 flex-1 text-sm">
          <p class="flex items-center justify-between">
            <span class="flex items-center gap-2 font-medium text-highlighted">
              {{ notification.title }}
              <span v-if="notification.unread" class="size-1.5 rounded-full bg-error" aria-label="Unread" />
            </span>

            <time
              :datetime="notification.date"
              class="text-muted text-xs"
              v-text="formatTimeAgo(new Date(notification.date))"
            />
          </p>

          <p class="text-dimmed">
            {{ notification.body }}
          </p>
        </div>
      </div>
    </template>
  </USlideover>
</template>