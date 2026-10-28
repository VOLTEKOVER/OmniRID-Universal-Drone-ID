export const usePwaInstall = () => {
  const deferredPrompt = useState<any>('omnirid-pwa-deferred-prompt', () => null)
  const isInstalled = useState<boolean>('omnirid-pwa-installed', () => false)
  const canInstall = computed(() => !!deferredPrompt.value && !isInstalled.value)

  if (import.meta.client) {
    if (window.matchMedia('(display-mode: standalone)').matches || (navigator as any).standalone) {
      isInstalled.value = true
    }

    window.addEventListener('beforeinstallprompt', (e: any) => {
      e.preventDefault()
      deferredPrompt.value = e
    })

    window.addEventListener('appinstalled', () => {
      deferredPrompt.value = null
      isInstalled.value = true
    })
  }

  const install = async () => {
    const promptEvent = deferredPrompt.value
    if (!promptEvent) return false
    promptEvent.prompt()
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
