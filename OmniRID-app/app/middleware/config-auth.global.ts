import { useEspConnection } from '~/composables/useEspConnection'

const CONFIG_PROTECTED = ['/tx', '/rx', '/firmware', '/presets', '/console', '/logging']

export default defineNuxtRouteMiddleware((to) => {
  if (import.meta.server) return
  const { isEspConnected, configAuthRequired, configAuthenticated, configAuthChecked } = useEspConnection()

  const path = to.path
  if (path === '/' || path === '/dashboard' || path.startsWith('/guide')) {
    return
  }

  const isProtected = CONFIG_PROTECTED.some((p) => path === p || path.startsWith(`${p}/`))
  if (!isProtected) return

  if (!isEspConnected.value) return

  if (!configAuthChecked.value) return

  if (configAuthRequired.value && !configAuthenticated.value) {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('omnirid:config-auth-required'))
    }
    return abortNavigation()
  }
})
