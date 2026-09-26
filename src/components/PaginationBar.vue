<script setup lang="ts">
defineProps<{
  currentPage: number
  hasNext?: boolean
  disabled?: boolean
}>()

const emit = defineEmits<{
  previous: []
  next: []
}>()
</script>

<template>
  <div class="pagination-bar">
    <span>Page {{ currentPage }}</span>
    <div class="pagination-actions">
      <button 
        class="page-button" 
        :disabled="currentPage === 1 || disabled" 
        @click="emit('previous')"
      >
        Previous
      </button>
      <button 
        class="page-button page-button-primary" 
        :disabled="!hasNext || disabled" 
        @click="emit('next')"
      >
        Next
      </button>
    </div>
  </div>
</template>
