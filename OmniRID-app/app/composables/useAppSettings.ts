import { createSharedComposable } from '@vueuse/core'

const SETTINGS_KEY = 'omnirid:app-settings'

export type VirtualConnection = 'wifi' | 'usb' | 'off'

export type AppSettings = {
  virtualConnection: VirtualConnection
  virtualNearbyDrones: boolean
  defaultCity: string
  expertMode: boolean
  reopenLastTab: boolean
  disableInternet: boolean
  uiScale: number
  language: string
}

export const defaults: AppSettings = {
  virtualConnection: 'off',
  virtualNearbyDrones: true,
  defaultCity: '',
  expertMode: false,
  reopenLastTab: false,
  disableInternet: false,
  uiScale: 100,
  language: 'en'
}

const _useAppSettings = () => {
  const settings = useState<AppSettings>('app-settings', () => ({ ...defaults }))
  const loaded = useState<boolean>('app-settings-loaded', () => false)

  const applySideEffects = () => {
    if (!import.meta.client) return
    document.documentElement.style.fontSize = `${settings.value.uiScale}%`
    document.documentElement.lang = settings.value.language
  }

  watch(settings, (value) => {
    if (import.meta.client && loaded.value) {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(value))
    }
    applySideEffects()
  }, { deep: true })

  if (import.meta.client && !loaded.value) {
    try {
      const raw = localStorage.getItem(SETTINGS_KEY)
      if (raw) {
        const saved = JSON.parse(raw) as Partial<AppSettings> & { enableDarkTheme?: boolean }
        delete saved.enableDarkTheme
        settings.value = { ...defaults, ...saved }
      }
    } catch {
      /* Ignore corrupt or unavailable storage and fall back to defaults. */
    }
    loaded.value = true
    applySideEffects()
  }

  return { settings, loaded }
}

export const useAppSettings = createSharedComposable(_useAppSettings)
