<template>
  <UModal :open="isOpen" @update:open="(v) => { if (!v) cancel() }">
    <template #content>
      <UCard class="ring-2 ring-red-500">
        <template #header>
          <div class="flex items-center gap-2">
            <UIcon name="i-lucide-alert-triangle" class="size-5 text-red-500" />
            <h3 class="text-base font-semibold">
              Security warning
            </h3>
          </div>
        </template>
        <div class="text-sm text-muted whitespace-pre-wrap">
          {{ message }}
        </div>
        <template #footer>
          <div class="flex justify-end gap-2">
            <UButton
              color="neutral"
              variant="ghost"
              label="Cancel"
              @click="cancel"
            />
            <UButton color="error" label="I understand, continue" @click="accept" />
          </div>
        </template>
      </UCard>
    </template>
  </UModal>
</template>

<script setup lang="ts">
import { useSecurityConfirm } from '~/composables/useSecurityConfirm'

const { isOpen, message, accept, cancel } = useSecurityConfirm()
</script>
