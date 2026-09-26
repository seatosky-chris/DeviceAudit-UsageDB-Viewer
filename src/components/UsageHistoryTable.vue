<script setup lang="ts">
import { computed, ref } from 'vue'

interface HistoryRow {
  month: string
  days: number
  percent?: number
  overThreshold: boolean
}

interface SortConfig {
  key: keyof HistoryRow
  direction: 'asc' | 'desc'
}

const props = defineProps<{
  historyRows: HistoryRow[]
  partTimePercentage: number
  isLoading: boolean
  loadFailed: boolean
  entityType: 'computer' | 'user'
}>()

const searchQuery = ref('')
const sortConfig = ref<SortConfig>({ 
	key: 'month', direction: 'desc' 
})

const filteredAndSortedHistory = computed(() => {
  let result = [...props.historyRows]

  // Apply search filter
  if (searchQuery.value) {
    const query = searchQuery.value.toLowerCase()
    result = result.filter(row => {
      // Search in month label and percent
      const monthText = monthLabel(row.month).toLowerCase()
      const percentText = row.percent?.toString() || ''
      return monthText.includes(query) || percentText.includes(query)
    })
  }

  // Apply sorting
  if (sortConfig.value.key) {
    result.sort((a, b) => {
      const aValue = a[sortConfig.value.key]
      const bValue = b[sortConfig.value.key]

      // Handle null/undefined values
      if (aValue === null || aValue === undefined) return 1
      if (bValue === null || bValue === undefined) return -1

      // Special handling for month
      if (sortConfig.value.key === 'month') {
        const aDate = new Date(`${aValue}-01`)
        const bDate = new Date(`${bValue}-01`)
        return sortConfig.value.direction === 'asc' ? aDate.getTime() - bDate.getTime() : bDate.getTime() - aDate.getTime()
      }

      // Compare values
      if (typeof aValue === 'string' && typeof bValue === 'string') {
        const aStr = aValue.toLowerCase()
        const bStr = bValue.toLowerCase()
        if (aStr < bStr) return sortConfig.value.direction === 'asc' ? -1 : 1
        if (aStr > bStr) return sortConfig.value.direction === 'asc' ? 1 : -1
      } else {
        if (aValue < bValue) return sortConfig.value.direction === 'asc' ? -1 : 1
        if (aValue > bValue) return sortConfig.value.direction === 'asc' ? 1 : -1
      }
      return 0
    })
  }

  return result
})

function monthLabel(month: string): string {
  const date = new Date(`${month}-01T00:00:00`)
  return Number.isNaN(date.valueOf()) ? month : date.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
}

function setSort(key: keyof HistoryRow) {
  if (sortConfig.value.key === key) {
    // Toggle direction if same key
    sortConfig.value.direction = sortConfig.value.direction === 'asc' ? 'desc' : 'asc'
  } else {
    // Set new key and default to ascending
    sortConfig.value.key = key
    sortConfig.value.direction = key === 'month' ? 'desc' : 'asc'
  }
}
</script>

<template>
  <div class="table-controls">
    <div class="search-control">
      <label for="history-search">Search:</label>
      <input
        id="history-search"
        v-model="searchQuery"
        type="search"
        placeholder="Search months or percentages..."
        aria-label="Search usage history"
      />
    </div>
  </div>

  <div class="table-frame">
    <div v-if="isLoading" class="table-state" role="status">
      Loading full usage history…
    </div>
    <div v-else-if="loadFailed" class="table-state">
      Usage history is unavailable.
    </div>
    <div v-else-if="filteredAndSortedHistory.length === 0" class="table-state">
      No monthly usage history matches your search.
    </div>
    <div v-else class="table-scroll">
      <table class="history-table">
        <thead>
          <tr>
            <th>
              <button class="sort-header" @click="setSort('month')">
                Month
                <span v-if="sortConfig.key === 'month'" class="sort-indicator">
                  {{ sortConfig.direction === 'asc' ? '↑' : '↓' }}
                </span>
              </button>
            </th>
            <th>
              <button class="sort-header" @click="setSort('days')">
                Active days
                <span v-if="sortConfig.key === 'days'" class="sort-indicator">
                  {{ sortConfig.direction === 'asc' ? '↑' : '↓' }}
                </span>
              </button>
            </th>
            <th>
              <button class="sort-header" @click="setSort('percent')">
                Month activity (over {{ partTimePercentage }}%)
                <span v-if="sortConfig.key === 'percent'" class="sort-indicator">
                  {{ sortConfig.direction === 'asc' ? '↑' : '↓' }}
                </span>
              </button>
            </th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in filteredAndSortedHistory" :key="row.month">
            <td>{{ monthLabel(row.month) }}</td>
            <td>{{ row.days }}</td>
            <td>
              <div class="percent-cell">
                <span 
                  class="percentage-value" 
                  :class="{ 'percentage-over-threshold': row.overThreshold }"
                >
                  {{ row.percent === undefined ? '—' : `${row.percent}%` }}
                </span>
                <span 
                  v-if="row.percent !== undefined" 
                  class="percent-track" 
                  :class="{ 'percent-track-over-threshold': row.overThreshold }"
                >
                  <span :style="{ width: `${Math.min(Math.max(row.percent, 0), 100)}%` }"></span>
                </span>
                <span v-if="row.overThreshold" class="threshold-label">
                  At/over threshold
                </span>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<style scoped>
.table-controls {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
  gap: 1rem;
}

.search-control {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.search-control label {
  font-size: 0.875rem;
  color: var(--color-text-secondary);
}

.search-control input {
  padding: 0.5rem 1rem;
  border: 1px solid var(--color-border);
  border-radius: 0.25rem;
  background-color: var(--color-input-background);
  color: var(--color-text);
  font-size: 0.875rem;
}

.sort-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  background: none;
  border: none;
  padding: 0.5rem;
  cursor: pointer;
  color: inherit;
  font-weight: inherit;
  text-align: left;
  width: 100%;
}

.sort-header:hover {
  background-color: var(--color-hover);
}

.sort-indicator {
  font-size: 0.75rem;
  color: var(--color-text-secondary);
}
</style>
