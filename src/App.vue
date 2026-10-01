<script setup lang="ts">
import { computed, onMounted, onUnmounted, reactive, ref, watch } from 'vue'
import EntityTable from './components/EntityTable.vue'
import UsageHistoryTable from './components/UsageHistoryTable.vue'
import PaginationBar from './components/PaginationBar.vue'
import ToastNotification from './components/ToastNotification.vue'

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

interface RouteParams {
  database?: string
  entityType?: EntityType
  entityId?: string
}

interface EntitySort {
  key: string
  direction: 'asc' | 'desc'
}

const entityPageSize = 25
const historyPageSize = 12
const databases = ref<string[]>([])
const selectedDatabase = ref('')
const entityType = ref<EntityType>('user')
const includeOlderEntities = ref(false)
const entitySort = reactive<Record<EntityType, EntitySort>>({
  computer: { key: 'Hostname', direction: 'asc' },
  user: { key: 'Username', direction: 'asc' }
})
const activeEntitySort = computed(() => entitySort[entityType.value])
const entities = ref<Entity[]>([])
const nextEntityToken = ref<string | null>(null)
const entityTokens = ref<(string | null)[]>([null])
const entityPageIndex = ref(0)
const entitySearchField = ref('Username')
const entitySearchQuery = ref('')
const entitySearchMode = ref<'prefix' | 'contains'>('prefix')
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
let entitySearchTimer: number | undefined

// Hash-based router functions
function parseHash(): RouteParams {
  const hash = window.location.hash.slice(1)
  if (!hash) return {}
  
  const params: RouteParams = {}
  const parts = hash.split('/')
  
  if (parts[0]) params.database = decodeURIComponent(parts[0])
  if (parts[1] && (parts[1] === 'computer' || parts[1] === 'user')) {
    params.entityType = parts[1]
  }
  if (parts[2]) params.entityId = decodeURIComponent(parts[2])
  
  return params
}

function updateHash(database?: string, type?: EntityType, entityId?: string) {
  const parts: string[] = []
  if (database) {
    parts.push(encodeURIComponent(database))
    if (type) {
      parts.push(type)
      if (entityId) {
        parts.push(encodeURIComponent(entityId))
      }
    }
  }
  const newHash = parts.length ? `#${parts.join('/')}` : ''
  if (window.location.hash !== newHash) {
    window.location.hash = newHash
  }
}

function handleHashChange() {
  const route = parseHash()
  
  if (route.database && route.database !== selectedDatabase.value) {
    selectedDatabase.value = route.database
  }
  
  if (route.entityType && route.entityType !== entityType.value) {
    entityType.value = route.entityType
  }
  
  if (route.entityId && route.database && route.entityType) {
    loadEntityById(route.database, route.entityType, route.entityId)
  } else if (selectedEntity.value) {
    returnToEntities()
  }
}

async function loadEntityById(database: string, type: EntityType, entityId: string) {
  if (selectedEntity.value?.id === entityId) return
  
  usageController?.abort()
  const controller = new AbortController()
  usageController = controller
  
  const placeholderEntity: Entity = { id: entityId }
  selectedEntity.value = placeholderEntity
  usage.value = null
  historyPage.value = 0
  usageLoadFailed.value = false
  isLoadingUsage.value = true
  
  const params = new URLSearchParams({
    accountName: database,
    entityType: type,
    entityId: entityId
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
    pageSize: String(entityPageSize),
    sortBy: activeEntitySort.value.key,
    sortDirection: activeEntitySort.value.direction
  })
  if (includeOlderEntities.value) params.set('includeOlder', 'true')
  if (entitySearchQuery.value.trim()) {
    params.set('searchBy', entitySearchField.value)
    params.set('search', entitySearchQuery.value.trim())
    params.set('searchMode', entitySearchMode.value)
  }
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

function updateEntitySearch(search: { field: string; query: string; mode: 'prefix' | 'contains' }) {
  const searchWasActive = Boolean(entitySearchQuery.value.trim())
  entitySearchField.value = search.field
  entitySearchQuery.value = search.query
  entitySearchMode.value = search.mode
  if (!search.query.trim() && !searchWasActive) return

  entityController?.abort()
  if (entitySearchTimer !== undefined) window.clearTimeout(entitySearchTimer)
  entityTokens.value = [null]
  entityPageIndex.value = 0
  nextEntityToken.value = null
  entities.value = []
  entityLoadFailed.value = false

  if (!selectedDatabase.value) return

  isLoadingEntities.value = true
  entitySearchTimer = window.setTimeout(() => {
    entitySearchTimer = undefined
    void loadEntities(null)
  }, 300)
}

function resetEntityView() {
  entityController?.abort()
  if (entitySearchTimer !== undefined) window.clearTimeout(entitySearchTimer)
  entitySearchTimer = undefined
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
  if (selectedDatabase.value) {
    updateHash(selectedDatabase.value, entityType.value)
    void loadEntities(null)
  }
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
  updateHash(selectedDatabase.value, entityType.value, entity.id)
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
  updateHash(selectedDatabase.value, entityType.value)
  usageController?.abort()
  selectedEntity.value = null
  usage.value = null
  isLoadingUsage.value = false
}

function entityName(entity: Entity): string {
  const name = entityType.value === 'computer' ? entity.Hostname : entity.Username
  return typeof name === 'string' && name ? name : entity.id
}

function formatValue(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === '') return '—'
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(value)) {
    const date = new Date(value)
    return Number.isNaN(date.valueOf()) ? value : date.toLocaleDateString()
  }
  return String(value)
}

watch([
  selectedDatabase,
  entityType,
  includeOlderEntities,
  () => activeEntitySort.value.key,
  () => activeEntitySort.value.direction
], (values, previousValues) => {
  if (values[0] !== previousValues[0] || values[1] !== previousValues[1]) {
    entitySearchField.value = entityType.value === 'computer' ? 'Hostname' : 'Username'
    entitySearchQuery.value = ''
  }
  resetEntityView()
})

onMounted(async () => {
  window.addEventListener('hashchange', handleHashChange)
  
  try {
    const response = await fetch('/api/getDatabases')
    if (!response.ok) throw new Error(await readError(response))
    const data = await response.json() as { databases?: string[] }
    databases.value = data.databases ?? []
    
    // Apply initial route from URL hash
    const route = parseHash()
    if (route.database) {
      selectedDatabase.value = route.database
      if (route.entityType) {
        entityType.value = route.entityType
      }
      // Entity loading will be triggered by the watch or handleHashChange
      if (route.entityId) {
        await new Promise(resolve => setTimeout(resolve, 100))
        handleHashChange()
      }
    }
  } catch (error) {
    databaseLoadFailed.value = true
    showToast(error instanceof Error ? error.message : 'Could not load customer databases.')
  } finally {
    isLoadingDatabases.value = false
  }
})

onUnmounted(() => {
  window.removeEventListener('hashchange', handleHashChange)
  entityController?.abort()
  usageController?.abort()
  if (entitySearchTimer !== undefined) window.clearTimeout(entitySearchTimer)
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
          <label class="age-filter-control">
            <input v-model="includeOlderEntities" type="checkbox" />
            Include records not seen in the past year
          </label>
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

          <EntityTable 
            :entities="entities"
            :entity-type="entityType"
            :search-field="entitySearchField"
            :search-query="entitySearchQuery"
            :search-mode="entitySearchMode"
            :sort-key="activeEntitySort.key"
            :sort-direction="activeEntitySort.direction"
            :is-loading="isLoadingEntities"
            :load-failed="entityLoadFailed"
            @select="openUsage"
            @search-change="updateEntitySearch"
            @sort-change="entitySort[entityType] = $event"
          />

          <PaginationBar
            :current-page="entityPageIndex + 1"
            :has-next="!!nextEntityToken"
            :disabled="isLoadingEntities"
            @previous="moveEntityPage(-1)"
            @next="moveEntityPage(1)"
          />
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

          <UsageHistoryTable
            :history-rows="visibleHistory"
            :part-time-percentage="partTimePercentage"
            :is-loading="isLoadingUsage"
            :load-failed="usageLoadFailed"
            :entity-type="entityType"
          />

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

    <ToastNotification :message="toastMessage" @dismiss="toastMessage = ''" />
  </main>
</template>
