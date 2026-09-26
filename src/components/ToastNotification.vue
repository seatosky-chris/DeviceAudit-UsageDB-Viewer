<script setup lang="ts">
defineProps<{
  message: string
}>()

const emit = defineEmits<{
  dismiss: []
}>()
</script>

<template>
  <div v-if="message" class="toast" role="alert">
    <span>{{ message }}</span>
    <button aria-label="Dismiss notification" @click="emit('dismiss')">×</button>
  </div>
</template>
