import { useEspConnection } from '~/composables/useEspConnection'

export default defineNuxtPlugin(() => {
  const { isEspConnected, checkConfigAuth } = useEspConnection()

  watch(isEspConnected, async (connected) => {
    if (connected) {
      await checkConfigAuth()
    }
  }, { immediate: true })

  if (typeof window !== 'undefined') {
    window.addEventListener('omnirid:config-auth-required', () => {
      // Modal is handled by layout/component
    })
  }
})
