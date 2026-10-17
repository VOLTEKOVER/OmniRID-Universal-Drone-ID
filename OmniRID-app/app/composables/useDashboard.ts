import { createSharedComposable } from '@vueuse/core'

const _useDashboard = () => {
  const route = useRoute()
  const router = useRouter()
  const isNotificationsSlideoverOpen = ref(false)
  const isSettingsOpen = ref(false)

  const configActions = useEventBus<'save' | 'export'>('omnirid:config-actions')

  defineShortcuts({
    'g-h': () => router.push('/'),
    'n': () => isNotificationsSlideoverOpen.value = !isNotificationsSlideoverOpen.value,
    'ctrl+s': (event) => {
      event.preventDefault()
      configActions.emit('save')
    },
    'ctrl+e': (event) => {
      event.preventDefault()
      configActions.emit('export')
    }
  })

  watch(() => route.fullPath, () => {
    isNotificationsSlideoverOpen.value = false
  })

  return {
    configActions,
    isNotificationsSlideoverOpen,
    isSettingsOpen
  }
}

export const useDashboard = createSharedComposable(_useDashboard)
