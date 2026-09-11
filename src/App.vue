<script setup lang="ts">
import { ref, onMounted } from 'vue'

const databases = ref<string[]>([])
const selectedDatabase = ref<string>('')
const isLoading = ref(true)
const error = ref<string | null>(null)

onMounted(async () => {
  try {
    const response = await fetch('/api/getDatabases')
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.error || `Failed to fetch databases: ${response.statusText}`)
    }
    const data = await response.json()
    databases.value = data.databases || []
  } catch (err: any) {
    error.value = err.message || 'An unknown error occurred.'
  } finally {
    isLoading.value = false
  }
})
</script>

<template>
  <main class="welcome-page">
    <section class="welcome-card" aria-labelledby="page-title">
      <p class="eyebrow">DeviceAudit</p>
      <h1 id="page-title">Welcome to the UsageDB Viewer</h1>
      <p class="intro">
        Your Azure Static Web App is ready. This is the foundation for exploring
        DeviceAudit usage data.
      </p>

      <div class="db-selector">
        <label for="db-select">Select a Customer Database:</label>
        
        <div v-if="isLoading" class="loading">Loading databases...</div>
        <div v-else-if="error" class="error">{{ error }}</div>
        <select 
          v-else 
          id="db-select" 
          v-model="selectedDatabase"
          class="dropdown"
        >
          <option value="" disabled>-- Select a Database --</option>
          <option v-for="db in databases" :key="db" :value="db">
            {{ db }}
          </option>
        </select>
      </div>

    </section>
  </main>
</template>
