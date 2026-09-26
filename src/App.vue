<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'

type EntityType = 'computer' | 'user'
interface EntityLinks {
  itGlue: string[]
  dattoRmm: string[]
}
type Entity = Record<string, string | number | null | undefined> & { id: string; links?: EntityLinks }

interface EntityPage {
  entities: Entity[]
  continuationToken: string | null
}

interface UsageData {
  daysActive: {
    Total?: number
    LastMonth?: number
    LastMonthPercent?: number
    History?: Record<string, number>
    HistoryPercent?: Record<string, number>
  }
  lastActive: string | null
  partTimePercentage: number
}

const entityPageSize = 25
const historyPageSize = 12
const databases = ref<string[]>([])
const selectedDatabase = ref('')
const entityType = ref<EntityType>('user')
const entities = ref<Entity[]>([])
const nextEntityToken = ref<string | null>(null)
const entityTokens = ref<(string | null)[]>([null])
const entityPageIndex = ref(0)
const selectedEntity = ref<Entity | null>(null)
const usage = ref<UsageData | null>(null)
const partTimePercentage = ref(70)
const historyPage = ref(0)
const isLoadingDatabases = ref(true)
const isLoadingEntities = ref(false)
const isLoadingUsage = ref(false)
const databaseLoadFailed = ref(false)
const entityLoadFailed = ref(false)
const usageLoadFailed = ref(false)
const toastMessage = ref('')
let toastTimer: number | undefined
let entityController: AbortController | undefined
let usageController: AbortController | undefined

const entityLabel = computed(() => entityType.value === 'computer' ? 'Computers' : 'Users')
const historyRows = computed(() => {
  const history = usage.value?.daysActive.History ?? {}
  return Object.entries(history)
    .sort(([left], [right]) => right.localeCompare(left))
    .map(([month, days]) => ({
      month,
      days,
      percent: usage.value?.daysActive.HistoryPercent?.[month],
      overThreshold: (usage.value?.daysActive.HistoryPercent?.[month] ?? 0) >= partTimePercentage.value
    }))
})
const historySummary = computed(() => {
  const evaluatedMonths = historyRows.value.filter(row => row.percent !== undefined)
  return {
    tracked: historyRows.value.length,
    overThreshold: evaluatedMonths.filter(row => row.overThreshold).length,
    underThreshold: evaluatedMonths.filter(row => !row.overThreshold).length
  }
})
const visibleHistory = computed(() => {
  const start = historyPage.value * historyPageSize
  return historyRows.value.slice(start, start + historyPageSize)
})
const historyPageCount = computed(() => Math.max(1, Math.ceil(historyRows.value.length / historyPageSize)))

function showToast(message: string) {
  toastMessage.value = message
  if (toastTimer !== undefined) window.clearTimeout(toastTimer)
  toastTimer = window.setTimeout(() => { toastMessage.value = '' }, 6000)
}

async function readError(response: Response): Promise<string> {
  const data = await response.json().catch(() => ({})) as { error?: string }
  return data.error || `Request failed (${response.status}).`
}

async function loadEntities(token: string | null = entityTokens.value[entityPageIndex.value] ?? null) {
  if (!selectedDatabase.value) return

  entityController?.abort()
  const controller = new AbortController()
  entityController = controller
  isLoadingEntities.value = true
  entityLoadFailed.value = false
  nextEntityToken.value = null

  const params = new URLSearchParams({
    accountName: selectedDatabase.value,
    entityType: entityType.value,
    pageSize: String(entityPageSize)
  })
  if (token) params.set('continuationToken', token)

  try {
    const response = await fetch(`/api/getEntities?${params}`, { signal: controller.signal })
    if (!response.ok) throw new Error(await readError(response))
    const page = await response.json() as EntityPage
    entities.value = page.entities
    nextEntityToken.value = page.continuationToken
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') return
    showToast(error instanceof Error ? error.message : 'Could not load entities.')
    entities.value = []
    entityLoadFailed.value = true
  } finally {
    if (!controller.signal.aborted) isLoadingEntities.value = false
  }
}

function resetEntityView() {
  entityController?.abort()
  usageController?.abort()
  selectedEntity.value = null
  usage.value = null
  isLoadingUsage.value = false
  historyPage.value = 0
  entities.value = []
  nextEntityToken.value = null
  entityLoadFailed.value = false
  entityTokens.value = [null]
  entityPageIndex.value = 0
  if (selectedDatabase.value) void loadEntities(null)
}

async function moveEntityPage(direction: -1 | 1) {
  if (direction === 1) {
    if (!nextEntityToken.value) return
    entityTokens.value = [...entityTokens.value.slice(0, entityPageIndex.value + 1), nextEntityToken.value]
  }
  entityPageIndex.value += direction
  await loadEntities(entityTokens.value[entityPageIndex.value] ?? null)
}

async function openUsage(entity: Entity) {
  usageController?.abort()
  const controller = new AbortController()
  usageController = controller
  selectedEntity.value = entity
  usage.value = null
  historyPage.value = 0
  usageLoadFailed.value = false
  isLoadingUsage.value = true

  const params = new URLSearchParams({
    accountName: selectedDatabase.value,
    entityType: entityType.value,
    entityId: entity.id
  })

  try {
    const response = await fetch(`/api/getEntityUsage?${params}`, { signal: controller.signal })
    if (!response.ok) throw new Error(await readError(response))
    usage.value = await response.json() as UsageData
    partTimePercentage.value = usage.value.partTimePercentage ?? 70
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') return
    showToast(error instanceof Error ? error.message : 'Could not load usage history.')
    usageLoadFailed.value = true
  } finally {
    if (!controller.signal.aborted) isLoadingUsage.value = false
  }
}

function returnToEntities() {
  usageController?.abort()
  selectedEntity.value = null
  usage.value = null
  isLoadingUsage.value = false
}

function entityName(entity: Entity): string {
  const name = entityType.value === 'computer' ? entity.Hostname : entity.Username
  return typeof name === 'string' && name ? name : entity.id
}

function serialNumbers(entity: Entity): string {
  const serialNumber = entity.SerialNumber
  if (typeof serialNumber !== 'string') return '—'

  const hostname = typeof entity.Hostname === 'string' ? entity.Hostname.trim().toLocaleLowerCase() : ''
  const serials = serialNumber.split('|')
    .map(serial => serial.trim())
    .filter(serial => serial && serial.toLocaleLowerCase() !== hostname)

  return serials.length ? serials.join(', ') : '—'
}

function formatValue(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === '') return '—'
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(value)) {
    const date = new Date(value)
    return Number.isNaN(date.valueOf()) ? value : date.toLocaleDateString()
  }
  return String(value)
}

function monthLabel(month: string): string {
  const date = new Date(`${month}-01T00:00:00`)
  return Number.isNaN(date.valueOf()) ? month : date.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
}

watch([selectedDatabase, entityType], resetEntityView)

onMounted(async () => {
  try {
    const response = await fetch('/api/getDatabases')
    if (!response.ok) throw new Error(await readError(response))
    const data = await response.json() as { databases?: string[] }
    databases.value = data.databases ?? []
  } catch (error) {
    databaseLoadFailed.value = true
    showToast(error instanceof Error ? error.message : 'Could not load customer databases.')
  } finally {
    isLoadingDatabases.value = false
  }
})

onUnmounted(() => {
  entityController?.abort()
  usageController?.abort()
  if (toastTimer !== undefined) window.clearTimeout(toastTimer)
})
</script>

<template>
  <main class="app-shell">
    <header class="topbar">
      <a class="brand" href="/" aria-label="DeviceAudit UsageDB Viewer home">
        <span class="brand-mark" aria-hidden="true">D</span>
        <span>DeviceAudit <span class="brand-divider">/</span> UsageDB</span>
      </a>
      <span class="topbar-caption">Customer activity</span>
    </header>

    <section class="workspace" aria-labelledby="page-title">
      <div class="page-heading">
        <div>
          <p class="eyebrow">Usage database</p>
          <h1 id="page-title">Customer activity</h1>
          <p class="page-description">Browse device and user activity by month.</p>
        </div>
        <label class="database-control" for="db-select">
          <span>Customer account</span>
          <span v-if="isLoadingDatabases" class="control-message">Loading accounts…</span>
          <select v-else id="db-select" v-model="selectedDatabase" class="select-control">
            <option value="">Select an account</option>
            <option v-for="database in databases" :key="database" :value="database">{{ database }}</option>
          </select>
        </label>
      </div>

      <div v-if="selectedDatabase" class="content-area">
        <nav v-if="!selectedEntity" class="view-toolbar" aria-label="Activity type">
          <div class="segmented-control" role="group" aria-label="Choose users or computers">
            <button :aria-pressed="entityType === 'computer'" @click="entityType = 'computer'">Computers</button>
            <button :aria-pressed="entityType === 'user'" @click="entityType = 'user'">Users</button>
          </div>
          <span class="result-context">{{ selectedDatabase }} <span>/</span> {{ entityLabel }}</span>
        </nav>

        <template v-if="!selectedEntity">
          <div class="table-heading">
            <div>
              <h2>{{ entityLabel }}</h2>
              <p>Choose a row to inspect its complete monthly history.</p>
            </div>
            <span class="page-indicator">Page {{ entityPageIndex + 1 }}</span>
          </div>

          <div class="table-frame">
            <div v-if="isLoadingEntities" class="table-state" role="status">Loading {{ entityLabel.toLowerCase() }}…</div>
            <div v-else-if="entityLoadFailed" class="table-state">The {{ entityLabel.toLowerCase() }} list is unavailable.</div>
            <div v-else-if="entities.length === 0" class="table-state">
              No {{ entityLabel.toLowerCase() }} found for this account.
            </div>
            <div v-else class="table-scroll">
              <table>
                <thead>
                  <tr v-if="entityType === 'computer'">
                    <th>Computer</th><th>Serial number(s)</th><th>Type</th><th>Manufacturer</th><th>Model</th><th>Operating system</th><th>Last updated</th>
                  </tr>
                  <tr v-else>
                    <th>Username</th><th>AD username</th><th>Domain</th><th>Account type</th><th>Email</th><th>Last updated</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="entity in entities" :key="entity.id">
                    <td>
                      <div class="entity-cell">
                        <button class="entity-link" :aria-label="`View usage for ${entityName(entity)}`" @click="openUsage(entity)">
                          <span>{{ entityName(entity) }}</span>
                          <small>{{ entity.id }}</small>
                        </button>
                        <div class="entity-links">
                          <a
                            v-for="(href, index) in entity.links?.itGlue ?? []"
                            :key="`itglue-${href}`"
                            class="external-link"
                            :href="href"
                            target="_blank"
                            rel="noopener noreferrer"
                            :aria-label="`Open IT Glue record for ${entityName(entity)}${(entity.links?.itGlue.length ?? 0) > 1 ? `, link ${index + 1}` : ''}`"
                          >{{ (entity.links?.itGlue.length ?? 0) > 1 ? `IT Glue ${index + 1}` : 'IT Glue' }}</a>
                          <a
                            v-for="(href, index) in entity.links?.dattoRmm ?? []"
                            :key="`datto-${href}`"
                            class="external-link"
                            :href="href"
                            target="_blank"
                            rel="noopener noreferrer"
                            :aria-label="`Open Datto RMM record for ${entityName(entity)}${(entity.links?.dattoRmm.length ?? 0) > 1 ? `, link ${index + 1}` : ''}`"
                          >{{ (entity.links?.dattoRmm.length ?? 0) > 1 ? `Datto RMM ${index + 1}` : 'Datto RMM' }}</a>
                        </div>
                      </div>
                    </td>
                    <template v-if="entityType === 'computer'">
                      <td>{{ serialNumbers(entity) }}</td>
                      <td>{{ formatValue(entity.DeviceType) }}</td>
                      <td>{{ formatValue(entity.Manufacturer) }}</td>
                      <td>{{ formatValue(entity.Model) }}</td>
                      <td>{{ formatValue(entity.OS) }}</td>
                    </template>
                    <template v-else>
                      <td>{{ formatValue(entity.ADUsername) }}</td>
                      <td>{{ formatValue(entity.Domain) }}</td>
                      <td>{{ formatValue(entity.DomainOrLocal) }}</td>
                      <td>{{ formatValue(entity.O365Email) }}</td>
                    </template>
                    <td>{{ formatValue(entity.LastUpdated) }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <div class="pagination-bar">
            <span>Page {{ entityPageIndex + 1 }}</span>
            <div class="pagination-actions">
              <button class="page-button" :disabled="entityPageIndex === 0 || isLoadingEntities" @click="moveEntityPage(-1)">Previous</button>
              <button class="page-button page-button-primary" :disabled="!nextEntityToken || isLoadingEntities" @click="moveEntityPage(1)">Next</button>
            </div>
          </div>
        </template>

        <section v-else class="usage-view" aria-labelledby="usage-title">
          <button class="back-button" @click="returnToEntities">← Back to {{ entityLabel.toLowerCase() }}</button>
          <div class="table-heading usage-heading">
            <div>
              <p class="eyebrow">{{ entityType === 'computer' ? 'Computer' : 'User' }} activity</p>
              <h2 id="usage-title">{{ entityName(selectedEntity) }}</h2>
              <p>{{ selectedEntity.id }}<span v-if="usage?.lastActive"> · Last active {{ formatValue(usage.lastActive) }}</span></p>
            </div>
            <div v-if="usage" class="usage-metrics">
              <div class="metric">
                <strong>{{ usage.daysActive.Total ?? '—' }}</strong><span>Active days</span>
              </div>
              <div class="metric">
                <strong>{{ historySummary.tracked }}</strong><span>Months tracked</span>
              </div>
              <div class="metric metric-over">
                <strong>{{ historySummary.overThreshold }}</strong><span>Months at or over {{ partTimePercentage }}%</span>
              </div>
              <div class="metric">
                <strong>{{ historySummary.underThreshold }}</strong><span>Months under {{ partTimePercentage }}%</span>
              </div>
            </div>
          </div>

          <div class="table-frame">
            <div v-if="isLoadingUsage" class="table-state" role="status">Loading full usage history…</div>
            <div v-else-if="usageLoadFailed" class="table-state">Usage history is unavailable.</div>
            <div v-else-if="historyRows.length === 0" class="table-state">No monthly usage history available for this {{ entityType }}.</div>
            <div v-else class="table-scroll">
              <table class="history-table">
                <thead><tr><th>Month</th><th>Active days</th><th>Month activity (over {{ partTimePercentage }}%)</th></tr></thead>
                <tbody>
                  <tr v-for="row in visibleHistory" :key="row.month">
                    <td>{{ monthLabel(row.month) }}</td>
                    <td>{{ row.days }}</td>
                    <td>
                      <div class="percent-cell">
                        <span class="percentage-value" :class="{ 'percentage-over-threshold': row.overThreshold }">{{ row.percent === undefined ? '—' : `${row.percent}%` }}</span>
                        <span v-if="row.percent !== undefined" class="percent-track" :class="{ 'percent-track-over-threshold': row.overThreshold }"><span :style="{ width: `${Math.min(Math.max(row.percent, 0), 100)}%` }"></span></span>
                        <span v-if="row.overThreshold" class="threshold-label">At/over threshold</span>
                      </div>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <div v-if="historyRows.length" class="pagination-bar">
            <span>{{ historyRows.length }} months · Page {{ historyPage + 1 }} of {{ historyPageCount }}</span>
            <div class="pagination-actions">
              <button class="page-button" :disabled="historyPage === 0" @click="historyPage--">Previous</button>
              <button class="page-button page-button-primary" :disabled="historyPage + 1 >= historyPageCount" @click="historyPage++">Next</button>
            </div>
          </div>
        </section>
      </div>

      <div v-else-if="!isLoadingDatabases && databaseLoadFailed" class="empty-workspace">
        Customer accounts could not be loaded.
      </div>
      <div v-else-if="!isLoadingDatabases && databases.length === 0" class="empty-workspace">
        No customer accounts are available to your account.
      </div>
      <div v-else-if="!isLoadingDatabases" class="empty-workspace">
        Select a customer account to view its computers or users.
      </div>
    </section>

    <div v-if="toastMessage" class="toast" role="alert">
      <span>{{ toastMessage }}</span>
      <button aria-label="Dismiss notification" @click="toastMessage = ''">×</button>
    </div>
  </main>
</template>
