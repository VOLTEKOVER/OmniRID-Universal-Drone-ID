export const useSecurityConfirm = () => {
  const isOpen = useState<boolean>('omnirid-security-confirm-open', () => false)
  const pendingPayload = useState<unknown>('omnirid-security-confirm-payload', () => null)
  const pendingResolve = useState<((v: boolean) => void) | null>('omnirid-security-confirm-resolve', () => null)
  const message = useState<string>('omnirid-security-confirm-msg', () => '')

  const confirm = (msg: string, payload?: unknown) => {
    return new Promise<boolean>((resolve) => {
      message.value = msg
      pendingPayload.value = payload ?? null
      pendingResolve.value = resolve
      isOpen.value = true
    })
  }

  const accept = () => {
    const r = pendingResolve.value
    isOpen.value = false
    pendingResolve.value = null
    pendingPayload.value = null
    if (r) r(true)
  }

  const cancel = () => {
    const r = pendingResolve.value
    isOpen.value = false
    pendingResolve.value = null
    pendingPayload.value = null
    if (r) r(false)
  }

  return { isOpen, message, confirm, accept, cancel }
}
