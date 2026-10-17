<script setup lang="ts">
import type { NavigationMenuItem } from '@nuxt/ui'
import type { CommandPaletteGroup, CommandPaletteItem } from '@nuxt/ui/runtime/components/CommandPalette.vue'
import { useMediaQuery } from '@vueuse/core'
import { appRepoUrl, espDefaultIp } from '~/config/app'
import { sectionSearchText, guideSections } from '~/config/guide'
import { appSettingEntries, contentKeywords, loadAutoSearchIndex, referenceEntries, searchSummary, toCommandItems } from '~/config/search'
import type { AutoSearchIndex, SearchAction } from '~/config/search'
import { pageDescriptions, pageForRoute, pageGroups, pageStatusMeta } from '~/pages.config'
import type { PageStatus } from '~/pages.config'
import { DEFAULTS, normalizeConfig, pageStatus, regionChecklist, validateConfig } from '~/config/device'
import type { DeviceConfig, PageId, RequiredConfigItem, RuntimeCheck } from '~/config/device'

const route = useRoute()
const router = useRouter()
const colorMode = useColorMode()
const { isNotificationsSlideoverOpen, isSettingsOpen } = useDashboard()
const nuxtApp = useNuxtApp()
const openSearch = () => {
  ensureAutoIndex()
  nuxtApp.hooks.callHook('dashboard:search:toggle')
}
const { settings } = useAppSettings()
const { espIp, isEspConnected, isChecking, lastError, isSimulated, isWifiTransport, isUsbTransport, connect, refresh, proxyFetch } = useEspConnection()
const { status: telemetryStatus } = useTelemetry()
const { target } = useDeviceProfile()
const { unreadCount } = useNotifications()
// Start the shared firmware log poller app-wide: console warnings/errors are
// mirrored into the notification panel even when the Console page is closed.
useFirmwareLogs()
// Below `lg` the navigation lives in the sidebar drawer, so the theme /
// notifications / settings actions move there too (see the sidebar footer).
const isMobileNav = useMediaQuery('(max-width: 1023.98px)')
const open = ref(false)
// On phone the sidebar hosts the actions drawer; close it before opening the
// settings slideover so the two overlays don't stack.
const openMobileSettings = () => {
  open.value = false
  isSettingsOpen.value = true
}
const isChecklistOpen = ref(false)
const isEspIpOpen = ref(false)
const draftEspIp = ref(espIp.value)
const isVirtualUsb = computed(() => settings.value.virtualConnection === 'usb')
const isWifiActive = isWifiTransport
const isUsbActive = isUsbTransport
const connectionBadge = computed(() => {
  if (isEspConnected.value) {
    const label = isUsbTransport.value ? 'USB' : 'WiFi'
    return { color: 'success' as const, label: `${isSimulated.value ? 'Simulated' : 'Connected'} · ${label}` }
  }
  if (isChecking.value) return { color: 'warning' as const, label: 'Checking…' }
  return { color: 'error' as const, label: 'Offline' }
})
const USB_PORT_KEY = 'omnirid:usb-port'
const usbPort = ref('COM3')
const toast = useToast()

const saveUsbPort = () => {
  if (import.meta.client) localStorage.setItem(USB_PORT_KEY, usbPort.value.trim())
  isEspIpOpen.value = false
}

onMounted(() => {
  if (import.meta.client) {
    const stored = localStorage.getItem(USB_PORT_KEY)
    if (stored) usbPort.value = stored
  }
})
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
const checklistConfig = ref<DeviceConfig | null>(null)
const isChecklistLoading = ref(false)

const loadChecklist = async () => {
  if (!isEspConnected.value) {
    checklistConfig.value = null
    return
  }
  isChecklistLoading.value = true
  try {
    const data = await proxyFetch<Record<string, unknown> | null>('api/config', { timeout: 5000 })
    checklistConfig.value = normalizeConfig({ ...DEFAULTS, ...(data ?? {}) })
  } catch {
    checklistConfig.value = null
  } finally {
    isChecklistLoading.value = false
  }
}

watch(() => isEspConnected.value, (connected) => {
  if (connected) loadChecklist()
  else checklistConfig.value = null
})

watch(isChecklistOpen, (open) => {
  if (open) loadChecklist()
})

const checklistIssues = computed(() => checklistConfig.value
  ? validateConfig(checklistConfig.value, { chip: target.value })
  : [])

const complianceStandard = computed(() => checklistConfig.value
  ? regionChecklist(checklistConfig.value).standard
  : '')

const complianceItems = computed(() => {
  if (!checklistConfig.value) return []
  const runtime = {
    gpsFix: telemetryStatus.value.gps_valid === true,
    txTotal: typeof telemetryStatus.value.tx_total === 'number' ? telemetryStatus.value.tx_total : 0
  }
  return regionChecklist(checklistConfig.value, runtime).items.filter(item => item.required)
})

const complianceMeta: Record<RequiredConfigItem | RuntimeCheck, { label: string, detail: string, route: string }> = {
  uas_id: { label: 'UAS ID', detail: 'Broadcast identifier for the aircraft.', route: '/device/identity' },
  ua_type: { label: 'UA Type', detail: 'Aircraft category reported to receivers.', route: '/device/identity' },
  op_id: { label: 'Operator ID', detail: 'Registration number required in this region.', route: '/device/identity' },
  tx: { label: 'Transmission mode', detail: 'At least one broadcast link enabled.', route: '/device/nation' },
  gps: { label: 'GPS fix', detail: 'Live position lock from the flight controller.', route: '/dashboard' },
  broadcast: { label: 'Live broadcast', detail: 'Remote ID frames seen on air.', route: '/dashboard' }
}

const configPages: { id: PageId, label: string, route: string }[] = [
  { id: 'identity', label: 'Identity', route: '/device/identity' },
  { id: 'nation', label: 'Nation & transmission', route: '/device/nation' },
  { id: 'fc', label: 'Flight controller', route: '/device/flight-controller' },
  { id: 'hardware', label: 'Hardware', route: '/device/hardware' },
  { id: 'system', label: 'Security & options', route: '/compliance-security/security' }
]

const configPageStatus = (id: PageId) => pageStatus(checklistIssues.value, id)

const checklistProgress = computed(() => {
  const items = complianceItems.value
  if (!items.length) return 0
  return Math.round((items.filter(item => item.ok).length / items.length) * 100)
})

const checklistReady = computed(() => !!checklistConfig.value
  && complianceItems.value.length > 0
  && complianceItems.value.every(item => item.ok)
  && checklistIssues.value.every(issue => issue.severity !== 'error'))

const openChecklistRoute = (route: string) => {
  isChecklistOpen.value = false
  router.push(route)
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
      if (page) {
        items.push(pageLink(page, () => {
          open.value = false
        }))
      }
    } else {
      items.push({
        label: group.title,
        icon: group.icon,
        defaultOpen: isActive,
        children: group.items.map(page => pageLink(page, () => { open.value = false }))
      })
    }
  }
  return items.filter(Boolean) as NavigationMenuItem[]
})

// Search: the term drives the "everything" groups below; when the field is
// empty only the usual navigation is shown. Cross-field token matching and an
// expanded result limit let it search the whole site word by word.
const searchTerm = ref('')
const searchFuse = {
  fuseOptions: {
    threshold: 0.25,
    keys: ['label', 'description', 'keywords', 'suffix']
  },
  resultLimit: 24
}

const runSearchAction = (action: SearchAction) => {
  if (action === 'open-settings') isSettingsOpen.value = true
}

// The automatic index (settings, actions, reference data) is derived from the
// page/component sources and loaded the first time the palette is used, so the
// extra data never slows down the initial page load.
const autoIndex = shallowRef<AutoSearchIndex | null>(null)
let autoIndexRequested = false
const ensureAutoIndex = () => {
  if (autoIndexRequested) return
  autoIndexRequested = true
  loadAutoSearchIndex()
    .then((index) => { autoIndex.value = index })
    .catch(() => { autoIndexRequested = false })
}

const pageSearchKeywords = (to: string) =>
  [autoIndex.value?.pageKeywords[to], contentKeywords[to]].filter(Boolean).join(' ')

const groups = computed(() => {
  const searching = searchTerm.value.trim().length > 0
  const auto = autoIndex.value

  const quickAccess = { id: 'links', label: 'Quick access', items: primaryLinks.value }
  const sections = pageGroups.flatMap((group) => {
    let items: CommandPaletteItem[]
    if (group.id === 'docs') {
      items = guideSections.map((section) => {
        const fullText = sectionSearchText(section)
        return {
          label: `${section.number}. ${section.title}`,
          icon: section.icon,
          to: '/docs/guide',
          value: section.id,
          description: searchSummary(fullText),
          keywords: `guide documentation ${section.title} ${fullText}`,
          onSelect: () => {
            open.value = false
            router.push(`/docs/guide#${section.id}`)
          }
        }
      })
    } else {
      items = group.items
        .filter(page => page.status !== 'wip' || settings.value.expertMode)
        .map(page => ({
          label: page.label,
          icon: page.icon,
          to: page.to,
          description: pageDescriptions[page.id] ?? page.label,
          keywords: searching ? pageSearchKeywords(page.to) : undefined,
          onSelect: () => { open.value = false }
        }))
    }
    return items.length > 0 ? [{ id: group.id, label: group.title, items }] : []
  })

  const dynamic: CommandPaletteGroup<CommandPaletteItem>[] = searching && auto
    ? [
        { id: 'features', label: 'Features & settings', items: toCommandItems(appSettingEntries(), runSearchAction) },
        { id: 'fields', label: 'Settings & fields', items: toCommandItems(auto.fields) },
        { id: 'actions', label: 'Commands & actions', items: toCommandItems(auto.actions) },
        { id: 'reference', label: 'Reference', items: toCommandItems(referenceEntries()) }
      ]
    : []

  return [quickAccess, ...dynamic, ...sections] as CommandPaletteGroup<CommandPaletteItem>[]
})

// Start loading the index as soon as the user types or opens the palette.
watch(searchTerm, (term) => {
  if (term.trim()) ensureAutoIndex()
})
</script>

<template>
  <UDashboardGroup unit="rem" class="bg-default">
    <header class="fixed inset-x-0 top-0 z-50 h-16 border-b border-default bg-default/85 backdrop-blur-xl">
      <div aria-hidden="true" class="absolute inset-x-0 top-0 h-0.5 bg-primary" />
      <div class="flex h-16 items-center gap-1.5 overflow-x-auto px-3 sm:gap-3 sm:px-6 lg:px-8">
        <UButton
          color="neutral"
          variant="ghost"
          square
          size="sm"
          icon="i-lucide-menu"
          class="flex shrink-0 lg:hidden"
          aria-label="Open navigation menu"
          @click="nuxtApp.hooks.callHook('dashboard:sidebar:toggle')"
        />

        <NuxtLink to="/" class="group flex min-w-0 shrink-0 items-center" aria-label="Go to home">
          <img src="/images/logo_with_text.svg" alt="OmniRID" class="h-10 w-auto shrink-0 object-contain transition group-hover:opacity-80 sm:h-11 dark:invert">
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

        <UButton
          color="neutral"
          variant="ghost"
          square
          size="sm"
          icon="i-lucide-search"
          class="shrink-0 sm:hidden"
          aria-label="Open search"
          @click="openSearch"
        />

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
            <UButton
              color="neutral"
              variant="soft"
              size="sm"
              icon="i-lucide-list-checks"
              aria-label="Open configuration checklist"
            >
              <span class="hidden sm:inline">Checklist</span>
              <template #trailing>
                <span class="flex items-center gap-1.5">
                  <svg viewBox="0 0 36 36" class="size-8 -rotate-90" aria-hidden="true">
                    <circle
                      cx="18"
                      cy="18"
                      r="15"
                      fill="none"
                      class="stroke-current/15"
                      stroke-width="3.5"
                    />
                    <circle
                      cx="18"
                      cy="18"
                      r="15"
                      fill="none"
                      class="stroke-primary"
                      stroke-width="3.5"
                      stroke-linecap="round"
                      :stroke-dasharray="`${checklistProgress * 0.942} 100`"
                    />
                  </svg>
                  <span class="text-[11px] font-bold leading-none tabular-nums">{{ isEspConnected ? `${checklistProgress}%` : '—' }}</span>
                </span>
              </template>
            </UButton>
            <template #content>
              <div class="w-[24rem] max-w-[calc(100vw-2rem)] space-y-3 p-3">
                <div class="flex items-start justify-between gap-3">
                  <div>
                    <p class="text-sm font-semibold text-highlighted">
                      Mission readiness
                    </p>
                    <p class="mt-0.5 text-xs text-muted">
                      {{ isEspConnected ? `Live checks for ${complianceStandard}.` : 'Connect to the ESP to run live checks.' }}
                    </p>
                  </div>
                  <UBadge
                    :color="!isEspConnected ? 'neutral' : checklistReady ? 'success' : 'warning'"
                    variant="soft"
                    :label="!isEspConnected ? 'Offline' : checklistReady ? 'Ready' : 'Action needed'"
                  />
                </div>

                <div v-if="!isEspConnected" class="rounded-lg border border-dashed border-default px-3 py-6 text-center">
                  <UIcon name="i-lucide-plug-zap" class="mx-auto size-5 text-muted" aria-hidden="true" />
                  <p class="mt-2 text-xs text-muted">
                    Readiness checks compare the live configuration against your region requirements.
                  </p>
                  <UButton
                    class="mt-3"
                    color="primary"
                    variant="soft"
                    size="sm"
                    icon="i-lucide-router"
                    label="Configure connection"
                    @click="isChecklistOpen = false; isEspIpOpen = true"
                  />
                </div>

                <template v-else>
                  <div class="space-y-1">
                    <p class="px-1 text-[11px] font-medium uppercase tracking-[0.16em] text-muted">
                      Region compliance
                    </p>
                    <button
                      v-for="item in complianceItems"
                      :key="item.id"
                      type="button"
                      class="flex w-full items-start gap-2.5 rounded-md px-2 py-2 text-left transition hover:bg-elevated/60"
                      @click="openChecklistRoute(complianceMeta[item.id].route)"
                    >
                      <UIcon
                        :name="item.ok ? 'i-lucide-circle-check' : 'i-lucide-circle-dashed'"
                        :class="item.ok ? 'text-success' : 'text-warning'"
                        class="mt-0.5 size-4 shrink-0"
                      />
                      <span class="min-w-0 flex-1">
                        <span class="block text-sm font-medium text-highlighted">{{ complianceMeta[item.id].label }}</span>
                        <span class="mt-0.5 block text-xs text-muted">{{ item.ok ? 'Compliant.' : complianceMeta[item.id].detail }}</span>
                      </span>
                      <UIcon name="i-lucide-arrow-up-right" class="mt-0.5 size-3.5 shrink-0 text-muted" aria-hidden="true" />
                    </button>
                  </div>

                  <div class="space-y-1">
                    <p class="px-1 text-[11px] font-medium uppercase tracking-[0.16em] text-muted">
                      Configuration
                    </p>
                    <button
                      v-for="page in configPages"
                      :key="page.id"
                      type="button"
                      class="flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left transition hover:bg-elevated/60"
                      @click="openChecklistRoute(page.route)"
                    >
                      <span
                        class="size-2 shrink-0 rounded-full"
                        :class="configPageStatus(page.id) === 'invalid' ? 'bg-error' : configPageStatus(page.id) === 'warning' ? 'bg-warning' : 'bg-success'"
                      />
                      <span class="min-w-0 flex-1 truncate text-sm text-default">{{ page.label }}</span>
                      <span
                        class="shrink-0 text-[11px] font-medium uppercase tracking-[0.12em]"
                        :class="configPageStatus(page.id) === 'invalid' ? 'text-error' : configPageStatus(page.id) === 'warning' ? 'text-warning' : 'text-muted'"
                      >{{ configPageStatus(page.id) === 'invalid' ? 'Error' : configPageStatus(page.id) === 'warning' ? 'Review' : 'Valid' }}</span>
                    </button>
                  </div>

                  <UButton
                    color="primary"
                    variant="soft"
                    size="sm"
                    block
                    icon="i-lucide-refresh-cw"
                    label="Re-run checks"
                    :loading="isChecklistLoading"
                    @click="loadChecklist"
                  />
                </template>
              </div>
            </template>
          </UPopover>

          <UPopover v-model:open="isEspIpOpen" :content="{ align: 'end', sideOffset: 8 }">
            <UButton
              color="neutral"
              variant="soft"
              size="sm"
              aria-label="Configure ESP connection"
            >
              <span class="hidden lg:inline">Connection</span>
              <template #trailing>
                <span class="flex h-8 items-center justify-center gap-1">
                  <UIcon
                    name="i-lucide-wifi"
                    class="size-4 transition-colors"
                    :class="isWifiActive ? 'text-success' : 'text-dimmed'"
                    aria-hidden="true"
                  />
                  <UIcon
                    name="i-lucide-usb"
                    class="size-4 transition-colors"
                    :class="isUsbActive ? 'text-success' : 'text-dimmed'"
                    aria-hidden="true"
                  />
                </span>
              </template>
            </UButton>
            <template #content>
              <div class="w-[22rem] max-w-[calc(100vw-2rem)] space-y-3 p-3">
                <div class="flex items-start justify-between gap-3">
                  <div>
                    <p class="text-sm font-semibold text-highlighted">
                      Connection
                    </p>
                    <p class="mt-0.5 text-xs text-muted">
                      Link the app to the ESP over WiFi, or go to the firmware page for USB update and recovery.
                    </p>
                  </div>
                  <UBadge :color="connectionBadge.color" variant="soft" :label="connectionBadge.label" />
                </div>

                <UAlert
                  v-if="isSimulated"
                  color="info"
                  icon="i-lucide-sparkles"
                  variant="soft"
                  class="rounded-lg"
                  :description="`Virtual connection active: the app simulates a ${isVirtualUsb ? 'USB' : 'WiFi'} link, no ESP is needed.`"
                />

                <UAlert
                  v-if="lastError && !isEspConnected"
                  color="error"
                  icon="i-lucide-circle-alert"
                  variant="soft"
                  class="rounded-lg"
                  :title="lastError"
                />

                <div class="flex items-center justify-between gap-2">
                  <p class="text-[11px] font-medium uppercase tracking-[0.16em] text-muted">
                    WiFi
                  </p>
                  <span v-if="isWifiActive" class="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-success">
                    <span class="size-1.5 rounded-full bg-success" />
                    Active
                  </span>
                </div>

                <div class="flex items-center justify-between gap-2 rounded-lg border border-default bg-elevated/40 px-3 py-2.5">
                  <div class="flex min-w-0 items-center gap-2">
                    <span class="flex size-7 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary ring-1 ring-primary/20">
                      <UIcon name="i-lucide-wifi" class="size-3.5" aria-hidden="true" />
                    </span>
                    <div class="min-w-0">
                      <p class="text-xs font-semibold text-highlighted">
                        Access point
                      </p>
                      <p class="truncate font-mono text-[11px] text-muted">
                        {{ espIp }} · ESP-RID
                      </p>
                    </div>
                  </div>
                  <UButton
                    size="xs"
                    color="neutral"
                    variant="outline"
                    icon="i-lucide-refresh-cw"
                    label="Re-check"
                    :loading="isChecking"
                    :disabled="isChecking"
                    @click="retryConnection"
                  />
                </div>

                <div class="space-y-3">
                  <p class="text-[11px] font-medium uppercase tracking-[0.16em] text-muted">
                    Device address
                  </p>
                  <UInput
                    v-model="draftEspIp"
                    inputmode="decimal"
                    placeholder="192.168.4.1"
                    icon="i-lucide-globe"
                    aria-label="ESP IP address"
                  >
                    <template #trailing>
                      <UTooltip text="Reset to default address">
                        <UButton
                          size="xs"
                          color="neutral"
                          variant="ghost"
                          square
                          icon="i-lucide-rotate-ccw"
                          aria-label="Reset to default address"
                          :disabled="draftEspIp === espDefaultIp"
                          @click="draftEspIp = espDefaultIp"
                        />
                      </UTooltip>
                    </template>
                  </UInput>
                  <div class="flex justify-between gap-2">
                    <p class="hidden text-[11px] leading-5 text-muted sm:block">
                      Default <span class="font-mono">{{ espDefaultIp }}</span>. Connect your computer to the ESP-RID WiFi to reach the device.
                    </p>
                    <div class="flex shrink-0 gap-2">
                      <UButton
                        type="button"
                        color="neutral"
                        variant="ghost"
                        size="xs"
                        label="Cancel"
                        @click="isEspIpOpen = false"
                      />
                      <UButton
                        type="submit"
                        color="primary"
                        size="xs"
                        label="Save IP"
                        @click="saveEspIp"
                      />
                    </div>
                  </div>
                </div>

                <div class="flex items-center justify-between border-t border-default pt-3">
                  <p class="text-[11px] font-medium uppercase tracking-[0.16em] text-muted">
                    USB
                  </p>
                  <span class="flex items-center gap-2">
                    <span v-if="isUsbActive" class="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-success">
                      <span class="size-1.5 rounded-full bg-success" />
                      Active
                    </span>
                    <UBadge
                      v-if="isVirtualUsb"
                      color="info"
                      variant="soft"
                      size="sm"
                      label="Virtual"
                    />
                  </span>
                </div>

                <div class="flex items-center justify-between gap-2 rounded-lg border border-default bg-elevated/40 px-3 py-2.5">
                  <div class="flex min-w-0 items-center gap-2">
                    <span class="flex size-7 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary ring-1 ring-primary/20">
                      <UIcon name="i-lucide-usb" class="size-3.5" aria-hidden="true" />
                    </span>
                    <div class="min-w-0">
                      <p class="text-xs font-semibold text-highlighted">
                        WebSerial
                      </p>
                      <p class="truncate font-mono text-[11px] text-muted">
                        {{ usbPort }} · USB CDC
                      </p>
                    </div>
                  </div>
                  <UButton
                    size="xs"
                    color="neutral"
                    variant="outline"
                    icon="i-lucide-refresh-cw"
                    label="Re-check"
                    :loading="isChecking"
                    :disabled="isChecking"
                    @click="retryConnection"
                  />
                </div>

                <div class="space-y-3">
                  <p class="text-[11px] font-medium uppercase tracking-[0.16em] text-muted">
                    USB port
                  </p>
                  <UInput
                    v-model="usbPort"
                    placeholder="COM3 / /dev/ttyUSB0"
                    icon="i-lucide-usb"
                    aria-label="USB serial port"
                  />
                  <div class="flex justify-between gap-2">
                    <p class="hidden text-[11px] leading-5 text-muted sm:block">
                      Serial port used by WebSerial. Select it on the firmware page.
                    </p>
                    <div class="flex shrink-0 gap-2">
                      <UButton
                        type="button"
                        color="neutral"
                        variant="ghost"
                        size="xs"
                        label="Cancel"
                        @click="isEspIpOpen = false"
                      />
                      <UButton
                        type="submit"
                        color="primary"
                        size="xs"
                        label="Save port"
                        @click="saveUsbPort"
                      />
                    </div>
                  </div>
                </div>

                <UButton
                  to="/firmware"
                  color="neutral"
                  variant="outline"
                  size="sm"
                  block
                  icon="i-lucide-download"
                  label="Open firmware page"
                  @click="isEspIpOpen = false"
                />
                <p class="text-[11px] leading-5 text-muted">
                  Flash over USB/WebSerial or push a verified OTA update from the firmware page.
                </p>
              </div>
            </template>
          </UPopover>

          <UButton
            v-if="!isMobileNav"
            color="neutral"
            variant="ghost"
            square
            :icon="colorMode.value === 'dark' ? 'i-lucide-sun' : 'i-lucide-moon'"
            aria-label="Toggle theme"
            @click="colorMode.preference = colorMode.value === 'dark' ? 'light' : 'dark'"
          />
          <div v-if="!isMobileNav" class="relative">
            <UButton
              color="neutral"
              variant="ghost"
              square
              icon="i-lucide-bell"
              aria-label="Open notifications"
              title="Notifications"
              @click="isNotificationsSlideoverOpen = true"
            />
            <span v-if="unreadCount" class="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-error px-1 text-[10px] font-bold leading-none text-white">{{ unreadCount }}</span>
          </div>
          <AppSettingsPopover v-if="!isMobileNav" v-model:open="isSettingsOpen" />
        </div>
      </div>
    </header>

    <UDashboardSidebar
      id="default"
      v-model:open="open"
      :collapsible="true"
      resizable
      class="border-e border-default bg-elevated/20 pt-16"
      :ui="{ root: 'pt-16' }"
    >
      <template #default="{ collapsed }">
        <div class="flex h-full flex-col gap-3 px-2 pb-2">
          <UNavigationMenu
            :key="collapsed ? 'collapsed' : 'expanded'"
            :collapsed="collapsed"
            :items="navItems"
            orientation="vertical"
            tooltip
            popover
            :ui="{
              link: 'rounded-md p-1.5 overflow-hidden',
              linkLeadingIcon: 'size-4',
              linkTrailingBadge: 'text-[10px]'
            }"
          />

          <div class="mt-auto space-y-3">
            <!-- Phone/tablet: the header controls live here instead (see `isMobileNav`). -->
            <div
              v-if="isMobileNav"
              class="flex items-center justify-between gap-1 rounded-lg border border-default bg-elevated/40 p-1.5"
            >
              <UButton
                color="neutral"
                variant="ghost"
                square
                :icon="colorMode.value === 'dark' ? 'i-lucide-sun' : 'i-lucide-moon'"
                aria-label="Toggle theme"
                @click="colorMode.preference = colorMode.value === 'dark' ? 'light' : 'dark'"
              />
              <div class="relative">
                <UButton
                  color="neutral"
                  variant="ghost"
                  square
                  icon="i-lucide-bell"
                  aria-label="Open notifications"
                  title="Notifications"
                  @click="isNotificationsSlideoverOpen = true"
                />
                <span v-if="unreadCount" class="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-error px-1 text-[10px] font-bold leading-none text-white">{{ unreadCount }}</span>
              </div>
              <UButton
                color="neutral"
                variant="ghost"
                square
                icon="i-lucide-settings"
                aria-label="Open app settings"
                title="App settings"
                @click="openMobileSettings"
              />
            </div>

            <UPopover v-if="collapsed" :content="{ sideOffset: 8 }">
              <UButton
                color="error"
                variant="solid"
                square
                icon="i-lucide-triangle-alert"
                aria-label="Important disclaimer"
              />
              <template #content>
                <div class="w-[20rem] max-w-[calc(100vw-2rem)] space-y-2 p-3">
                  <p class="text-sm font-semibold text-highlighted">
                    Important disclaimer
                  </p>
                  <p class="text-[11px] leading-4 text-muted">
                    {{ disclaimerText }}
                  </p>
                </div>
              </template>
            </UPopover>

            <UAlert
              v-else
              color="error"
              variant="solid"
              icon="i-lucide-triangle-alert"
              :ui="{ icon: 'text-white' }"
              class="rounded-lg"
            >
              <template #description>
                <div class="max-h-[30vh] overflow-y-auto pr-1">
                  <p class="text-[11px] leading-4 text-white">
                    {{ disclaimerText }}
                  </p>
                </div>
              </template>
            </UAlert>
          </div>
        </div>
      </template>
    </UDashboardSidebar>

    <UDashboardSearch
      v-model:search-term="searchTerm"
      preserve-group-order
      :groups="groups"
      :fuse="searchFuse"
    />
    <slot />
    <NotificationsSlideover />
    <AppSettingsSlideover v-if="isMobileNav" />
  </UDashboardGroup>
</template>
