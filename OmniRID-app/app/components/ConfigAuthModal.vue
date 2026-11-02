<template>
  <UModal
    v-model:open="open"
    :dismissible="false"
    :ui="{
      content: 'sm:max-w-md'
    }"
  >
    <template #content>
      <div class="p-6 space-y-4">
        <div class="flex items-start gap-3">
          <UIcon
            name="i-lucide-lock"
            class="size-5 text-primary mt-0.5"
          />
          <div class="flex-1 space-y-1">
            <h3 class="text-base font-semibold text-highlighted">
              Configuration password
            </h3>
            <p class="text-sm text-muted">
              An app connection password has been set on the ESP TX. Enter it to access configuration, firmware, presets, console and logging.
            </p>
            <p class="text-xs text-muted">
              Receiving and viewing Remote ID data on the Dashboard always remains available.
            </p>
          </div>
        </div>

        <UForm
          :state="state"
          class="space-y-4"
          @submit="onSubmit"
        >
          <UFormField
            label="Password"
            name="password"
            required
          >
            <UInput
              v-model="state.password"
              type="password"
              autocomplete="off"
              placeholder="Enter the password"
              class="w-full"
              :disabled="loading"
              autofocus
            />
          </UFormField>

          <UAlert
            v-if="authError"
            color="error"
            variant="subtle"
            :title="authError"
            icon="i-lucide-alert-circle"
          />

          <div class="flex justify-end">
            <UButton
              type="submit"
              color="primary"
              :loading="loading"
              :disabled="!state.password.trim()"
              icon="i-lucide-unlock"
            >
              Unlock
            </UButton>
          </div>
        </UForm>
      </div>
    </template>
  </UModal>
</template>

<script setup lang="ts">
const { configAuthRequired, configAuthenticated, configAuthError, submitConfigAuth } = useEspConnection()

const open = computed(() => {
  return configAuthRequired.value && !configAuthenticated.value
})

const state = reactive({
  password: ''
})

const loading = ref(false)

watch(open, (val) => {
  if (val) {
    state.password = ''
  }
})

const authError = computed(() => configAuthError.value)

const onSubmit = async () => {
  if (loading.value) return
  loading.value = true
  try {
    await submitConfigAuth(state.password)
  } catch {
    // error is shown via configAuthError
  } finally {
    loading.value = false
  }
}
</script>
