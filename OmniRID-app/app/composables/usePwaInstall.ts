type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

export const usePwaInstall = () => {
  const deferredPrompt = useState<BeforeInstallPromptEvent | null>('omnirid-pwa-deferred-prompt', () => null)
  const isInstalled = useState<boolean>('omnirid-pwa-installed', () => false)
  const canInstall = computed(() => !!deferredPrompt.value && !isInstalled.value)

  if (import.meta.client) {
    const standalone = (navigator as Navigator & { standalone?: boolean }).standalone
    if (window.matchMedia('(display-mode: standalone)').matches || standalone) {
      isInstalled.value = true
    }

    window.addEventListener('beforeinstallprompt', (e) => {
      const event = e as BeforeInstallPromptEvent
      event.preventDefault()
      deferredPrompt.value = event
    })

    window.addEventListener('appinstalled', () => {
      deferredPrompt.value = null
      isInstalled.value = true
    })
  }

  const install = async () => {
    const promptEvent = deferredPrompt.value
    if (!promptEvent) return false
    await promptEvent.prompt()
    const choice = await promptEvent.userChoice
    deferredPrompt.value = null
    if (choice?.outcome === 'accepted') {
      isInstalled.value = true
      return true
    }
    return false
  }

  return { canInstall, isInstalled, install, deferredPrompt }
}
