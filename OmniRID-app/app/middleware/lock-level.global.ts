import { pageGroups } from '~/pages.config'

export default defineNuxtRouteMiddleware((to) => {
  if (import.meta.server) return
  const path = to.path
  let entry
  for (const group of pageGroups) {
    for (const p of group.items) {
      if (p.to === path) { entry = p; break }
    }
    if (entry) break
  }
  if (!entry || !entry.minLockLevel) return
  const lockLevel = useState<number>('omnirid-device-lock-level', () => 0)
  if ((lockLevel.value || 0) < entry.minLockLevel) {
    return navigateTo('/')
  }
})
