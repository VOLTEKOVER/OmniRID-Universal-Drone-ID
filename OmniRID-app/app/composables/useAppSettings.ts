import { createSharedComposable } from '@vueuse/core'

const SETTINGS_KEY = 'omnirid:app-settings'

export type VirtualConnection = 'wifi' | 'usb' | 'off'

export type AppSettings = {
  virtualConnection: VirtualConnection
  expertMode: boolean
  reopenLastTab: boolean
  disableInternet: boolean
  enableDarkTheme: boolean
  colorTheme: string
  uiScale: number
  language: string
}

export const defaults: AppSettings = {
  virtualConnection: 'off',
  expertMode: false,
  reopenLastTab: false,
  disableInternet: false,
  enableDarkTheme: true,
  colorTheme: 'blue',
  uiScale: 100,
  language: 'en'
}

const _useAppSettings = () => {
  const settings = useState<AppSettings>('app-settings', () => ({ ...defaults }))
  const loaded = useState<boolean>('app-settings-loaded', () => false)
  const colorMode = useColorMode()
  const appConfig = useAppConfig()

  const applySideEffects = () => {
    if (!import.meta.client) return
    colorMode.preference = settings.value.enableDarkTheme ? 'dark' : 'light'
    document.documentElement.style.fontSize = `${settings.value.uiScale}%`
    document.documentElement.lang = settings.value.language
    const appConfigColors = appConfig as unknown as { ui: { colors: { primary: string } } }
    appConfigColors.ui.colors.primary = settings.value.colorTheme
  }

  watch(settings, (value) => {
    if (import.meta.client && loaded.value) {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(value))
    }
    applySideEffects()
  }, { deep: true })

  onMounted(() => {
    if (!import.meta.client) return
    const raw = localStorage.getItem(SETTINGS_KEY)
    if (raw) {
      try {
        settings.value = { ...defaults, ...JSON.parse(raw) }
      } catch {
        /* ignore corrupt settings and fall back to defaults */
      }
    }
    loaded.value = true
    applySideEffects()
  })

  return { settings, loaded }
}

export const useAppSettings = createSharedComposable(_useAppSettings)
