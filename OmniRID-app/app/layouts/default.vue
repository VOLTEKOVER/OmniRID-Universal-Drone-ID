<script setup lang="ts">
import type { NavigationMenuItem } from '@nuxt/ui'
import type { CommandPaletteGroup, CommandPaletteItem } from '@nuxt/ui/runtime/components/CommandPalette.vue'
import { appInstallerUrl, appRepoUrl, espDefaultIp } from '~/config/app'
import { firmwareQuickSteps, installTargets } from '~/config/content'
import { sectionSearchText, guideSections } from '~/config/guide'
import { pageDescriptions, pageForRoute, pageGroups, pageStatusMeta } from '~/pages.config'
import type { PageStatus } from '~/pages.config'

const route = useRoute()
const router = useRouter()
const colorMode = useColorMode()
const { isNotificationsSlideoverOpen, isSettingsOpen } = useDashboard()
const nuxtApp = useNuxtApp()
const openSearch = () => nuxtApp.hooks.callHook('dashboard:search:toggle')
const { settings } = useAppSettings()
const { espIp, isEspConnected, isChecking, lastError, deviceInfo, isSimulated, connect, refresh } = useEspConnection()
const { unreadCount } = useNotifications()
const open = ref(false)
const isChecklistOpen = ref(false)
const isEspIpOpen = ref(false)
const isUsbOpen = ref(false)
const draftEspIp = ref(espIp.value)
const usbSteps = firmwareQuickSteps.slice(0, 4)
const toast = useToast()
const alwaysAvailableRoutes = computed(() => {
  const routes = new Set<string>(['/'])
  for (const group of pageGroups) {
    for (const page of group.items) {
      if (page.alwaysAvailable) {
        routes.add(page.to)
      }
    }
  }
  return routes
})

const isAlwaysAvailable = (routePath: string) => alwaysAvailableRoutes.value.has(routePath)

const fwVersion = computed(() => (typeof deviceInfo.value?.fw_version === 'string' && deviceInfo.value.fw_version) ? deviceInfo.value.fw_version : '')
const capsInputs = computed<string[]>(() => Array.isArray(deviceInfo.value?.inputs) ? (deviceInfo.value.inputs as unknown[]).filter((value): value is string => typeof value === 'string').slice(0, 6) : [])

const openUsbGuide = () => {
  isUsbOpen.value = false
  router.push('/docs/guide#installation')
}

const saveEspIp = async () => {
  const normalizedIp = draftEspIp.value.trim()
  const octets = normalizedIp.split('.').map(Number)
  if (octets.length !== 4 || octets.some(octet => !Number.isInteger(octet) || octet < 0 || octet > 255)) {
    toast.add({
      title: 'Invalid ESP address',
      description: 'Enter a valid IPv4 address, for example 192.168.4.1.',
      icon: 'i-lucide-circle-alert',
      color: 'error'
    })
    return
  }

  isEspIpOpen.value = false
  await connect(normalizedIp)
  if (isEspConnected.value) {
    toast.add({
      title: 'ESP connection updated',
      description: `Connected to ${normalizedIp}.`,
      icon: 'i-lucide-wifi',
      color: 'success'
    })
  } else {
    toast.add({
      title: 'ESP not reachable',
      description: `Could not reach ${normalizedIp}. Check the device address and WiFi.`,
      icon: 'i-lucide-wifi-off',
      color: 'error'
    })
  }
}

const retryConnection = async () => {
  if (isChecking.value) return
  await refresh()
  if (isEspConnected.value) {
    toast.add({
      title: 'Connection OK',
      description: `Connected to ${espIp.value}.`,
      icon: 'i-lucide-wifi',
      color: 'success'
    })
  } else {
    toast.add({
      title: 'ESP not reachable',
      description: `Could not reach ${espIp.value}. Check the device address and WiFi.`,
      icon: 'i-lucide-wifi-off',
      color: 'error'
    })
  }
}

const checklistItems = ref([
  { label: 'Security', detail: 'Review OTA verification and lock settings.', route: '/compliance-security/security', complete: false },
  { label: 'Firmware', detail: 'Flash the latest firmware build for your board.', route: '/firmware', complete: false },
  { label: 'Telemetry', detail: 'Confirm the ESP is reporting live on the dashboard.', route: '/dashboard', complete: false },
  { label: 'Guide', detail: 'Read the full technical documentation.', route: '/docs/guide', complete: false }
])

const completedChecklistItems = computed(() => checklistItems.value.filter(item => item.complete).length)
const checklistProgress = computed(() => Math.round((completedChecklistItems.value / checklistItems.value.length) * 100))

const openChecklistStep = (item: { route: string }) => {
  isChecklistOpen.value = false
  router.push(item.route)
}

const primaryLinks = computed<NavigationMenuItem[]>(() => [{
  label: 'Home', icon: 'i-lucide-house', to: '/',
  onSelect: () => { open.value = false }
}])

const statusBadge = (status: PageStatus) => pageStatusMeta(status)

const lastTabKey = 'omnirid:last-tab'

watch(() => route.path, (path) => {
  if (import.meta.client && settings.value.reopenLastTab && path !== '/') {
    localStorage.setItem(lastTabKey, path)
  }
})

watch(() => isEspConnected.value, (connected) => {
  if (!connected || !settings.value.reopenLastTab || !import.meta.client) return
  const last = localStorage.getItem(lastTabKey)
  if (last && last !== route.path && pageForRoute(last)) {
    router.push(last).catch(() => {})
  }
})

const sidebarGroups = computed(() => pageGroups
  .map(group => ({ ...group, items: group.items.filter(page => page.status !== 'wip' || settings.value.expertMode) }))
  .filter(group => group.items.length > 0))

const pageLink = (page: { label: string, icon: string, to: string, status: PageStatus }, onNavigate: () => void): NavigationMenuItem => {
  const available = isEspConnected.value || isAlwaysAvailable(page.to)
  return {
    label: available ? page.label : `${page.label} (offline)`,
    icon: page.icon,
    to: page.to,
    disabled: !available,
    badge: { label: statusBadge(page.status).label, color: statusBadge(page.status).color, variant: 'subtle', size: 'sm' },
    onSelect: onNavigate
  }
}

const disclaimerText = 'IMPORTANT DISCLAIMER: This firmware is provided "as-is", without any warranty or guarantee of any kind, either express or implied. The creators, contributors, and maintainers of this project shall not be held responsible or liable for any damages, fines, penalties, legal consequences, accidents, equipment damage, personal injury, or any other liability arising from the use, misuse, or inability to use this firmware or device. It is your sole responsibility to ensure full compliance with all applicable local, national, and international laws and regulations regarding drone Remote ID (including but not limited to FAA, EASA, and other aviation authorities). By using this firmware, you acknowledge that you understand and accept these terms. If you do not agree, do not use this software.'

const dividerItem: NavigationMenuItem = {
  type: 'label',
  label: '— LINEA —',
  class: 'px-1.5 py-1',
  ui: { label: 'flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-[0.18em] text-muted/60' }
}

const navItems = computed<NavigationMenuItem[]>(() => {
  const items: (NavigationMenuItem | undefined)[] = [
    {
      label: 'Home', icon: 'i-lucide-house', to: '/',
      onSelect: () => { open.value = false }
    }
  ]
  for (const group of sidebarGroups.value) {
    const isActive = group.items.some(page => route.path === page.to)
    if (group.items.length === 1) {
      const page = group.items[0]
      if (page) items.push(pageLink(page, () => { open.value = false }))
    } else {
      items.push({
        label: group.title,
        icon: group.icon,
        defaultOpen: isActive,
        children: group.items.map(page => pageLink(page, () => { open.value = false }))
      })
    }
    if (group.id === 'docs') items.push(dividerItem)
  }
  return items.filter(Boolean) as NavigationMenuItem[]
})

const groups = computed(() => {
  const quickAccess = { id: 'links', label: 'Quick access', items: primaryLinks.value }
  const sections = pageGroups.flatMap(group => {
    let items: CommandPaletteItem[]
    if (group.id === 'docs') {
      items = guideSections.map(section => ({
        label: `${section.number}. ${section.title}`,
        icon: section.icon,
        to: '/docs/guide',
        value: section.id,
        description: sectionSearchText(section),
        onSelect: () => {
          open.value = false
          router.push(`/docs/guide#${section.id}`)
        }
      }))
    } else {
      items = group.items
        .filter(page => page.status !== 'wip' || settings.value.expertMode)
        .map(page => ({
          label: page.label,
          icon: page.icon,
          to: page.to,
          description: pageDescriptions[page.id] ?? page.label,
          onSelect: () => { open.value = false }
        }))
    }
    return items.length > 0 ? [{ id: group.id, label: group.title, items }] : []
  })
  return [quickAccess, ...sections] as CommandPaletteGroup<CommandPaletteItem>[]
})
</script>

<template>
  <UDashboardGroup unit="rem" class="bg-default">
    <header class="fixed inset-x-0 top-0 z-50 h-16 border-b border-default bg-default/80 backdrop-blur-xl">
      <div class="flex h-16 items-center gap-1.5 overflow-x-auto px-3 sm:gap-3 sm:px-6">
        <UButton color="neutral" variant="ghost" square size="sm" icon="i-lucide-menu" class="flex shrink-0 lg:hidden" aria-label="Open navigation menu" @click="nuxtApp.hooks.callHook('dashboard:sidebar:toggle')" />

        <NuxtLink to="/" class="group flex min-w-0 shrink-0 items-center" aria-label="Go to home">
          <img src="/images/logo_with_text.svg" alt="OmniRID" class="h-10 w-auto shrink-0 object-contain transition group-hover:opacity-80 sm:h-11 dark:invert" />
        </NuxtLink>

        <UTooltip text="View source on GitHub">
          <UButton
            :to="appRepoUrl"
            target="_blank"
            external
            color="neutral"
            variant="ghost"
            icon="i-simple-icons-github"
            aria-label="GitHub source"
            class="hidden shrink-0 sm:flex"
          />
        </UTooltip>

        <UButton color="neutral" variant="ghost" square size="sm" icon="i-lucide-search" class="shrink-0 sm:hidden" aria-label="Open search" @click="openSearch" />

        <div class="min-w-0 flex-1" />

        <UButton
          color="neutral"
          variant="outline"
          icon="i-lucide-search"
          label="Search"
          class="hidden w-64 shrink-0 justify-between md:flex"
          :ui="{ label: 'flex-1 text-start' }"
          aria-label="Search pages and commands"
          @click="openSearch"
        >
          <template #trailing>
            <span class="flex items-center gap-1" aria-hidden="true">
              <UKbd variant="subtle" size="sm">Ctrl</UKbd>
              <UKbd variant="subtle" size="sm">K</UKbd>
            </span>
          </template>
        </UButton>

        <div class="hidden h-6 w-px shrink-0 bg-default md:block" aria-hidden="true" />

        <div class="flex shrink-0 items-center gap-1 sm:gap-1.5 lg:gap-2">
            <UPopover v-model:open="isChecklistOpen" :content="{ align: 'end', sideOffset: 8 }">
              <UButton color="neutral" variant="soft" size="sm" icon="i-lucide-list-checks" aria-label="Open configuration checklist">
                <span class="hidden sm:inline">Checklist</span>
                <template #trailing>
                  <span class="relative flex size-6 items-center justify-center">
                    <svg viewBox="0 0 36 36" class="size-6 -rotate-90" aria-hidden="true">
                      <circle cx="18" cy="18" r="15" fill="none" class="stroke-current/20" stroke-width="3" />
                      <circle cx="18" cy="18" r="15" fill="none" class="stroke-current" stroke-width="3" stroke-linecap="round" :stroke-dasharray="`${checklistProgress * 0.942} 100`" />
                    </svg>
                    <span class="absolute text-[9px] font-bold leading-none">{{ checklistProgress }}%</span>
                  </span>
                </template>
              </UButton>
              <template #content>
                <div class="w-80 max-w-[calc(100vw-2rem)] space-y-3 p-3">
                  <div class="flex items-start justify-between gap-4">
                    <div>
                      <p class="text-sm font-semibold text-highlighted">Configuration checklist</p>
                      <p class="mt-1 text-xs text-muted">{{ completedChecklistItems }} of {{ checklistItems.length }} completed</p>
                    </div>
                    <UBadge :color="checklistProgress === 100 ? 'success' : 'warning'" variant="soft" :label="`${checklistProgress}%`" />
                  </div>
                  <div class="space-y-2">
                    <div v-for="item in checklistItems" :key="item.label" class="flex items-start gap-2 rounded-lg p-2 hover:bg-elevated/60">
                      <button type="button" class="mt-0.5 shrink-0" :aria-label="item.complete ? `Mark ${item.label} incomplete` : `Mark ${item.label} complete`" @click="item.complete = !item.complete">
                        <UIcon :name="item.complete ? 'i-lucide-circle-check' : 'i-lucide-circle'" :class="item.complete ? 'text-success' : 'text-muted'" class="size-4" />
                      </button>
                      <button type="button" class="min-w-0 flex-1 text-left" @click="openChecklistStep(item)">
                        <span class="block text-sm font-medium text-highlighted">{{ item.label }}</span>
                        <span class="mt-0.5 block text-xs text-muted">{{ item.detail }}</span>
                      </button>
                      <UIcon name="i-lucide-arrow-up-right" class="mt-0.5 size-4 shrink-0 text-muted" aria-hidden="true" />
                    </div>
                  </div>
                  <UButton to="/device/identity" color="primary" variant="soft" size="sm" block label="Open configuration" @click="isChecklistOpen = false" />
                </div>
              </template>
            </UPopover>

            <UButton color="neutral" variant="soft" size="sm" class="hidden sm:flex" :icon="isEspConnected || isSimulated ? 'i-lucide-wifi' : 'i-lucide-wifi-off'" :loading="isChecking" :disabled="isChecking" :class="isEspConnected || isSimulated ? 'text-success' : 'text-muted'" aria-label="Retry ESP connection" @click="retryConnection">
                <span class="hidden lg:inline">{{ isSimulated ? 'Simulated' : isEspConnected ? 'Connected' : 'Disconnected' }}</span>
              </UButton>

            <UPopover v-model:open="isEspIpOpen" :content="{ align: 'end', sideOffset: 8 }">
              <UButton color="neutral" variant="soft" size="sm" icon="i-lucide-router" aria-label="Configure ESP connection IP">
                <span class="hidden lg:inline">{{ espIp }}</span>
              </UButton>
              <template #content>
                <div class="w-[22rem] max-w-[calc(100vw-2rem)] space-y-3 p-3">
                  <div class="flex items-start justify-between gap-3">
                    <div>
                      <p class="text-sm font-semibold text-highlighted">WiFi connection</p>
                      <p class="mt-0.5 text-xs text-muted">Link the app to the ESP software access point.</p>
                    </div>
                    <UBadge :color="isSimulated ? 'info' : isEspConnected ? 'success' : isChecking ? 'warning' : 'error'" variant="soft" :label="isSimulated ? 'Simulated' : isEspConnected ? 'Connected' : isChecking ? 'Checking…' : 'Offline'" />
                  </div>

                  <UAlert v-if="isSimulated" color="info" icon="i-lucide-sparkles" variant="soft" class="rounded-lg" description="Virtual connection active: the app simulates a WiFi link, no ESP is needed." />

                  <UAlert v-if="lastError && !isEspConnected" color="error" icon="i-lucide-circle-alert" variant="soft" class="rounded-lg" :title="lastError" />

                  <div class="flex items-center justify-between gap-2 rounded-xl border border-default bg-elevated/40 px-3 py-2.5">
                    <div class="flex min-w-0 items-center gap-2">
                      <span class="flex size-7 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary ring-1 ring-primary/20">
                        <UIcon name="i-lucide-wifi" class="size-3.5" aria-hidden="true" />
                      </span>
                      <div class="min-w-0">
                        <p class="text-xs font-semibold text-highlighted">Access point</p>
                        <p class="truncate text-[11px] text-muted">{{ espIp }} · ESP-RID</p>
                      </div>
                    </div>
                    <UButton size="xs" color="neutral" variant="outline" icon="i-lucide-refresh-cw" label="Re-check" :loading="isChecking" :disabled="isChecking" @click="retryConnection" />
                  </div>

                  <div v-if="isEspConnected && (fwVersion || capsInputs.length)" class="flex flex-wrap items-center gap-1.5 rounded-xl border border-default bg-elevated/40 px-3 py-2.5">
                    <UBadge v-if="fwVersion" color="primary" variant="soft" size="sm" icon="i-lucide-microchip" :label="fwVersion" />
                    <UBadge v-for="input in capsInputs" :key="input" color="neutral" variant="outline" size="sm" :label="input" />
                  </div>

                  <div class="space-y-3">
                    <p class="text-[11px] font-medium uppercase tracking-[0.16em] text-muted">Device address</p>
                    <UInput v-model="draftEspIp" inputmode="decimal" placeholder="192.168.4.1" icon="i-lucide-globe" aria-label="ESP IP address">
                      <template #trailing>
                        <UTooltip text="Reset to default address">
                          <UButton size="xs" color="neutral" variant="ghost" square icon="i-lucide-rotate-ccw" aria-label="Reset to default address" :disabled="draftEspIp === espDefaultIp" @click="draftEspIp = espDefaultIp" />
                        </UTooltip>
                      </template>
                    </UInput>
                    <div class="flex justify-between gap-2">
                      <p class="hidden text-[11px] leading-5 text-muted sm:block">Default <span class="font-mono">{{ espDefaultIp }}</span>. Connect your computer to the ESP-RID WiFi to reach the device.</p>
                      <div class="flex shrink-0 gap-2">
                        <UButton type="button" color="neutral" variant="ghost" size="sm" label="Cancel" @click="isEspIpOpen = false" />
                        <UButton type="submit" color="primary" size="sm" label="Save IP" @click="saveEspIp" />
                      </div>
                    </div>
                  </div>
                </div>
              </template>
            </UPopover>

            <UPopover v-model:open="isUsbOpen" :content="{ align: 'end', sideOffset: 8 }">
              <UButton color="neutral" variant="soft" size="sm" icon="i-lucide-usb" aria-label="Flash firmware over USB">
                <span class="hidden md:inline">USB</span>
              </UButton>
              <template #content>
                <div class="w-[22rem] max-w-[calc(100vw-2rem)] space-y-3 p-3">
                  <div class="flex items-start justify-between gap-3">
                    <div>
                      <p class="text-sm font-semibold text-highlighted">USB · WebSerial</p>
                      <p class="mt-0.5 text-xs text-muted">Install, recover or reflash firmware straight from the browser.</p>
                    </div>
                    <span class="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary ring-1 ring-primary/20" aria-hidden="true">
                      <UIcon name="i-lucide-usb" class="size-4" />
                    </span>
                  </div>

                  <UAlert color="info" icon="i-lucide-globe" variant="soft" class="rounded-lg" :description="'Requires desktop Chrome/Edge over HTTPS or localhost. No extra drivers.'" />

                  <div class="space-y-1.5">
                    <p class="text-[11px] font-medium uppercase tracking-[0.16em] text-muted">Setup steps</p>
                    <p v-for="(step, i) in usbSteps" :key="i" class="flex items-start gap-2 text-xs leading-5 text-muted">
                      <span class="mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[9px] font-semibold text-primary">{{ i + 1 }}</span>
                      <span>{{ step }}</span>
                    </p>
                  </div>

                  <div class="flex flex-col gap-2">
                    <UButton color="primary" size="sm" block icon="i-lucide-download" label="Open WebSerial installer" :to="appInstallerUrl" target="_blank" external @click="isUsbOpen = false" />
                    <div class="flex gap-2">
                      <UButton color="neutral" variant="outline" size="sm" block icon="i-lucide-book-open" label="Install guide" @click="openUsbGuide" />
                      <UButton color="neutral" variant="outline" size="sm" block icon="i-lucide-tag" label="Releases" :to="`${appRepoUrl}/releases`" target="_blank" external @click="isUsbOpen = false" />
                    </div>
                  </div>

                  <p class="text-[11px] leading-5 text-muted">Locked devices (level 1+) can always be recovered over USB.</p>
                </div>
              </template>
            </UPopover>

            <UButton color="neutral" variant="ghost" square :icon="colorMode.value === 'dark' ? 'i-lucide-sun' : 'i-lucide-moon'" aria-label="Toggle theme" @click="colorMode.preference = colorMode.value === 'dark' ? 'light' : 'dark'" />
            <div class="relative">
              <UButton color="neutral" variant="ghost" square icon="i-lucide-bell" aria-label="Open notifications" title="Notifications" @click="isNotificationsSlideoverOpen = true" />
              <span v-if="unreadCount" class="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-error px-1 text-[10px] font-bold leading-none text-white">{{ unreadCount }}</span>
            </div>
            <AppSettingsPopover v-model:open="isSettingsOpen" />
        </div>
      </div>
    </header>

    <UDashboardSidebar id="default" v-model:open="open" :collapsible="true" resizable class="bg-elevated/25 pt-16" :ui="{ root: 'pt-16' }">
      <template #default="{ collapsed }">
        <div class="flex h-full flex-col gap-3 px-2 pb-2">
          <UNavigationMenu :key="collapsed ? 'collapsed' : 'expanded'" :collapsed="collapsed" :items="navItems" orientation="vertical" tooltip popover :ui="{ link: 'p-1.5 overflow-hidden' }" />

          <div v-if="collapsed" class="mt-auto">
            <UPopover :content="{ sideOffset: 8 }">
              <UButton color="warning" variant="soft" square icon="i-lucide-triangle-alert" aria-label="Important disclaimer" />
              <template #content>
                <div class="w-[20rem] max-w-[calc(100vw-2rem)] space-y-2 p-3">
                  <p class="text-sm font-semibold text-highlighted">Important disclaimer</p>
                  <p class="text-[11px] leading-4 text-muted">{{ disclaimerText }}</p>
                </div>
              </template>
            </UPopover>
          </div>

          <div v-else class="mt-auto">
            <UAlert color="warning" variant="soft" icon="i-lucide-triangle-alert" class="rounded-xl">
              <template #description>
                <div class="max-h-[30vh] overflow-y-auto pr-1">
                  <p class="text-[11px] leading-4 text-muted">{{ disclaimerText }}</p>
                </div>
              </template>
            </UAlert>
          </div>
        </div>
      </template>
    </UDashboardSidebar>

    <UDashboardSearch :groups="groups" />
    <slot />
    <NotificationsSlideover />
  </UDashboardGroup>
</template>
