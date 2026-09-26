<script setup lang="ts">
interface HistoryRow {
  month: string
  days: number
  percent?: number
  overThreshold: boolean
}

defineProps<{
  historyRows: HistoryRow[]
  partTimePercentage: number
  isLoading: boolean
  loadFailed: boolean
  entityType: 'computer' | 'user'
}>()

function monthLabel(month: string): string {
  const date = new Date(`${month}-01T00:00:00`)
  return Number.isNaN(date.valueOf()) ? month : date.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
}
</script>

<template>
  <div class="table-frame">
    <div v-if="isLoading" class="table-state" role="status">
      Loading full usage history…
    </div>
    <div v-else-if="loadFailed" class="table-state">
      Usage history is unavailable.
    </div>
    <div v-else-if="historyRows.length === 0" class="table-state">
      No monthly usage history available for this {{ entityType }}.
    </div>
    <div v-else class="table-scroll">
      <table class="history-table">
        <thead>
          <tr>
            <th>Month</th>
            <th>Active days</th>
            <th>Month activity (over {{ partTimePercentage }}%)</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in historyRows" :key="row.month">
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
