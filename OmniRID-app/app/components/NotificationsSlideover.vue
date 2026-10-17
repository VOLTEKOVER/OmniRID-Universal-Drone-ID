<script setup lang="ts">
import { formatTimeAgo } from '@vueuse/core'
import type { SystemNotificationSource, SystemNotificationType } from '~/composables/useNotifications'

const { isNotificationsSlideoverOpen } = useDashboard()
const { notifications, unreadCount, errorCount, warningCount, markAllRead, remove, clear } = useNotifications()

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

const sourceLabel = (source: SystemNotificationSource) => ({
  app: 'App',
  firmware: 'Firmware',
  connection: 'Connection'
}[source])

const sourceIcon = (source: SystemNotificationSource) => ({
  app: 'i-lucide-layout-panel-left',
  firmware: 'i-lucide-cpu',
  connection: 'i-lucide-wifi'
}[source])
</script>

<template>
  <USlideover
    v-model:open="isNotificationsSlideoverOpen"
    title="Notifications"
  >
    <template #body>
      <div class="mb-2 space-y-2 border-b border-default px-1 pb-2">
        <div class="flex items-center justify-between gap-2">
          <p class="text-xs text-muted">
            {{ unreadCount ? `${unreadCount} unread` : 'All caught up' }}
          </p>
          <div class="flex gap-1">
            <UButton
              color="neutral"
              variant="ghost"
              size="xs"
              icon="i-lucide-check-check"
              label="Mark all read"
              :disabled="!unreadCount"
              @click="markAllRead"
            />
            <UButton
              color="neutral"
              variant="ghost"
              size="xs"
              icon="i-lucide-trash"
              label="Clear"
              :disabled="!notifications.length"
              @click="clear"
            />
          </div>
        </div>

        <div v-if="notifications.length" class="flex flex-wrap items-center gap-1.5">
          <UBadge
            v-if="errorCount"
            color="error"
            variant="soft"
            size="sm"
            icon="i-lucide-circle-x"
          >
            {{ errorCount }} error{{ errorCount > 1 ? 's' : '' }}
          </UBadge>
          <UBadge
            v-if="warningCount"
            color="warning"
            variant="soft"
            size="sm"
            icon="i-lucide-triangle-alert"
          >
            {{ warningCount }} warning{{ warningCount > 1 ? 's' : '' }}
          </UBadge>
          <span class="text-xs text-dimmed">{{ notifications.length }} total</span>
        </div>
      </div>

      <UEmpty
        v-if="!notifications.length"
        icon="i-lucide-bell-off"
        title="No notifications"
        description="Warnings and errors from the app and the ESP32 console will appear here."
      />

      <div
        v-for="notification in notifications"
        :key="notification.id"
        class="flex items-start gap-3 border-b border-default px-1 py-4 last:border-b-0"
      >
        <UIcon :name="notificationIcon(notification.type)" :class="notificationColor(notification.type)" class="mt-0.5 size-5 shrink-0" />

        <div class="min-w-0 flex-1 text-sm">
          <p class="flex items-center justify-between gap-2">
            <span class="flex min-w-0 items-center gap-2 font-medium text-highlighted">
              <span class="truncate">{{ notification.title }}</span>
              <span v-if="notification.unread" class="size-1.5 shrink-0 rounded-full bg-primary" aria-label="Unread" />
              <UBadge
                v-if="notification.count > 1"
                color="neutral"
                variant="soft"
                size="sm"
              >
                ×{{ notification.count }}
              </UBadge>
            </span>

            <time
              :datetime="notification.date"
              class="shrink-0 text-muted text-xs"
              v-text="formatTimeAgo(new Date(notification.date))"
            />
          </p>

          <p class="text-dimmed">
            {{ notification.body }}
          </p>

          <p class="mt-1 flex items-center justify-between gap-2">
            <span class="flex items-center gap-1 text-[11px] text-muted">
              <UIcon :name="sourceIcon(notification.source)" class="size-3" />
              {{ sourceLabel(notification.source) }}
            </span>
            <UButton
              color="neutral"
              variant="ghost"
              size="xs"
              icon="i-lucide-x"
              aria-label="Dismiss notification"
              @click="remove(notification.id)"
            />
          </p>
        </div>
      </div>
    </template>
  </USlideover>
</template>
