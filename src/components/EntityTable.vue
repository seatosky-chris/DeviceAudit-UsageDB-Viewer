<script setup lang="ts">
import { computed, ref } from 'vue'

type EntityType = 'computer' | 'user'
type SearchMode = 'prefix' | 'contains'
interface EntityLinks {
  itGlue: string[]
  dattoRmm: string[]
}
type Entity = Record<string, string | number | null | undefined> & { id: string; links?: EntityLinks }

interface SortConfig {
  key: string
  direction: 'asc' | 'desc'
}

interface SearchField {
  key: string
  label: string
}

const props = defineProps<{
  entities: Entity[]
  database: string
  entityType: EntityType
  searchField: string
  searchQuery: string
  searchMode: SearchMode
  sortKey: string
  sortDirection: SortConfig['direction']
  isLoading: boolean
  loadFailed: boolean
}>()

const emit = defineEmits<{
  select: [entity: Entity]
  sortChange: [sort: SortConfig]
  searchChange: [search: { field: string; query: string; mode: SearchMode }]
}>()

const entityLabel = computed(() => props.entityType === 'computer' ? 'computers' : 'users')
const searchFields = computed<SearchField[]>(() => props.entityType === 'computer'
  ? [
      { key: 'Hostname', label: 'Computer' },
      { key: 'SerialNumber', label: 'Serial number' },
      { key: 'DeviceType', label: 'Type' },
      { key: 'Manufacturer', label: 'Manufacturer' },
      { key: 'Model', label: 'Model' },
      { key: 'OS', label: 'Operating system' },
      { key: 'id', label: 'Entity ID' }
    ]
  : [
      { key: 'Username', label: 'Username' },
      { key: 'ADUsername', label: 'AD username' },
      { key: 'Domain', label: 'Domain' },
      { key: 'DomainOrLocal', label: 'Account type' },
      { key: 'O365Email', label: 'Email' },
      { key: 'id', label: 'Entity ID' }
    ])

function updateSearchField(event: Event) {
  emit('searchChange', {
    field: (event.target as HTMLSelectElement).value,
    query: props.searchQuery,
    mode: props.searchMode
  })
}

function updateSearchQuery(event: Event) {
  emit('searchChange', {
    field: props.searchField,
    query: (event.target as HTMLInputElement).value,
    mode: props.searchMode
  })
}

function updateSearchMode(event: Event) {
  emit('searchChange', {
    field: props.searchField,
    query: props.searchQuery,
    mode: (event.target as HTMLSelectElement).value as SearchMode
  })
}

function entityName(entity: Entity): string {
  const name = props.entityType === 'computer' ? entity.Hostname : entity.Username
  return typeof name === 'string' && name ? name : entity.id
}

function selectEntity(event: MouseEvent, entity: Entity) {
  if (event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return
  event.preventDefault()
  emit('select', entity)
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

function setSort(key: string) {
  const direction = props.sortKey === key && props.sortDirection === 'asc' ? 'desc' : 'asc'
  emit('sortChange', { key, direction })
}
</script>

<template>
  <div class="table-controls">
    <div class="search-control">
      <label for="entity-search-field">Field:</label>
      <select id="entity-search-field" :value="searchField" @change="updateSearchField">
        <option v-for="field in searchFields" :key="field.key" :value="field.key">{{ field.label }}</option>
      </select>
      <label for="entity-search-mode">Match:</label>
      <select id="entity-search-mode" :value="searchMode" @change="updateSearchMode">
        <option value="prefix">Starts with</option>
        <option value="contains">Contains (slower)</option>
      </select>
      <label for="entity-search">Search:</label>
      <input
        id="entity-search"
        :value="searchQuery"
        @input="updateSearchQuery"
        type="search"
        placeholder="Enter search text..."
        aria-label="Search selected field"
      />
    </div>
  </div>

  <div class="table-frame">
    <div v-if="isLoading" class="table-state" role="status">
      Loading {{ entityLabel }}…
    </div>
    <div v-else-if="loadFailed" class="table-state">
      The {{ entityLabel }} list is unavailable.
    </div>
    <div v-else-if="entities.length === 0" class="table-state">
      No {{ entityLabel }} found matching your search.
    </div>
    <div v-else class="table-scroll">
      <table>
        <thead>
          <tr v-if="entityType === 'computer'">
            <th>
              <button class="sort-header" @click="setSort('Hostname')">
                Computer
                <span v-if="sortKey === 'Hostname'" class="sort-indicator">
                  {{ sortDirection === 'asc' ? '↑' : '↓' }}
                </span>
              </button>
            </th>
            <th>
              <button class="sort-header" @click="setSort('SerialNumber')">
                Serial number(s)
                <span v-if="sortKey === 'SerialNumber'" class="sort-indicator">
                  {{ sortDirection === 'asc' ? '↑' : '↓' }}
                </span>
              </button>
            </th>
            <th>
              <button class="sort-header" @click="setSort('DeviceType')">
                Type
                <span v-if="sortKey === 'DeviceType'" class="sort-indicator">
                  {{ sortDirection === 'asc' ? '↑' : '↓' }}
                </span>
              </button>
            </th>
            <th>
              <button class="sort-header" @click="setSort('Manufacturer')">
                Manufacturer
                <span v-if="sortKey === 'Manufacturer'" class="sort-indicator">
                  {{ sortDirection === 'asc' ? '↑' : '↓' }}
                </span>
              </button>
            </th>
            <th>
              <button class="sort-header" @click="setSort('Model')">
                Model
                <span v-if="sortKey === 'Model'" class="sort-indicator">
                  {{ sortDirection === 'asc' ? '↑' : '↓' }}
                </span>
              </button>
            </th>
            <th>
              <button class="sort-header" @click="setSort('OS')">
                Operating system
                <span v-if="sortKey === 'OS'" class="sort-indicator">
                  {{ sortDirection === 'asc' ? '↑' : '↓' }}
                </span>
              </button>
            </th>
            <th>
              <button class="sort-header" @click="setSort('LastUpdated')">
                Last updated
                <span v-if="sortKey === 'LastUpdated'" class="sort-indicator">
                  {{ sortDirection === 'asc' ? '↑' : '↓' }}
                </span>
              </button>
            </th>
          </tr>
          <tr v-else>
            <th>
              <button class="sort-header" @click="setSort('Username')">
                Username
                <span v-if="sortKey === 'Username'" class="sort-indicator">
                  {{ sortDirection === 'asc' ? '↑' : '↓' }}
                </span>
              </button>
            </th>
            <th>
              <button class="sort-header" @click="setSort('ADUsername')">
                AD username
                <span v-if="sortKey === 'ADUsername'" class="sort-indicator">
                  {{ sortDirection === 'asc' ? '↑' : '↓' }}
                </span>
              </button>
            </th>
            <th>
              <button class="sort-header" @click="setSort('Domain')">
                Domain
                <span v-if="sortKey === 'Domain'" class="sort-indicator">
                  {{ sortDirection === 'asc' ? '↑' : '↓' }}
                </span>
              </button>
            </th>
            <th>
              <button class="sort-header" @click="setSort('DomainOrLocal')">
                Account type
                <span v-if="sortKey === 'DomainOrLocal'" class="sort-indicator">
                  {{ sortDirection === 'asc' ? '↑' : '↓' }}
                </span>
              </button>
            </th>
            <th>
              <button class="sort-header" @click="setSort('O365Email')">
                Email
                <span v-if="sortKey === 'O365Email'" class="sort-indicator">
                  {{ sortDirection === 'asc' ? '↑' : '↓' }}
                </span>
              </button>
            </th>
            <th>
              <button class="sort-header" @click="setSort('LastUpdated')">
                Last updated
                <span v-if="sortKey === 'LastUpdated'" class="sort-indicator">
                  {{ sortDirection === 'asc' ? '↑' : '↓' }}
                </span>
              </button>
            </th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="entity in entities" :key="entity.id">
            <td>
              <div class="entity-cell">
                <a
                  class="entity-link" 
                  :href="`#${encodeURIComponent(database)}/${entityType}/${encodeURIComponent(entity.id)}`"
                  :aria-label="`View usage for ${entityName(entity)}`" 
                  @click="selectEntity($event, entity)"
                >
                  <span>{{ entityName(entity) }}</span>
                  <small>{{ entity.id }}</small>
                </a>
                <div class="entity-links">
                  <template v-for="(href, index) in entity.links?.itGlue ?? []" :key="`itglue-${href}`">
                    <a
                      class="external-link"
                      :href="href"
                      target="_blank"
                      rel="noopener noreferrer"
                      :aria-label="`Open IT Glue record for ${entityName(entity)}${(entity.links?.itGlue.length ?? 0) > 1 ? `, link ${index + 1}` : ''}`"
                    >
                      {{ (entity.links?.itGlue.length ?? 0) > 1 ? `IT Glue ${index + 1}` : 'IT Glue' }}
                    </a>
                  </template>
                  <template v-for="(href, index) in entity.links?.dattoRmm ?? []" :key="`datto-${href}`">
                    <a
                      class="external-link"
                      :href="href"
                      target="_blank"
                      rel="noopener noreferrer"
                      :aria-label="`Open Datto RMM record for ${entityName(entity)}${(entity.links?.dattoRmm.length ?? 0) > 1 ? `, link ${index + 1}` : ''}`"
                    >
                      {{ (entity.links?.dattoRmm.length ?? 0) > 1 ? `Datto RMM ${index + 1}` : 'Datto RMM' }}
                    </a>
                  </template>
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

.search-control input,
.search-control select {
  padding: 0.5rem 1rem;
  border: 1px solid var(--color-border);
  border-radius: 0.25rem;
  background-color: var(--color-input-background);
  color: var(--color-text);
  font-size: 0.875rem;
}

.search-control input {
  min-width: 14rem;
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
