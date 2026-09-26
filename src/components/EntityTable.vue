<script setup lang="ts">
import { computed, ref, watch } from 'vue'

type EntityType = 'computer' | 'user'
interface EntityLinks {
  itGlue: string[]
  dattoRmm: string[]
}
type Entity = Record<string, string | number | null | undefined> & { id: string; links?: EntityLinks }

interface SortConfig {
  key: string
  direction: 'asc' | 'desc'
}

const props = defineProps<{
  entities: Entity[]
  entityType: EntityType
  isLoading: boolean
  loadFailed: boolean
}>()

const emit = defineEmits<{
  select: [entity: Entity]
}>()

const entityLabel = computed(() => props.entityType === 'computer' ? 'computers' : 'users')

const searchQuery = ref('')
const sortConfig = ref<SortConfig>({ key: props.entityType === 'computer' ? 'Hostname' : 'Username', direction: 'asc' })

watch(() => props.entityType, entityType => {
  sortConfig.value = { key: entityType === 'computer' ? 'Hostname' : 'Username', direction: 'asc' }
})

const filteredAndSortedEntities = computed(() => {
  let result = [...props.entities]

  // Apply search filter
  if (searchQuery.value) {
    const query = searchQuery.value.toLowerCase()
    result = result.filter(entity => {
      // Search in all string properties
      return Object.entries(entity).some(([key, value]) =>
        typeof value === 'string' && value.toLowerCase().includes(query)
      )
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

      // Compare values
      if (typeof aValue === 'string' && typeof bValue === 'string') {
        const aStr = aValue.toLowerCase()
        const bStr = bValue.toLowerCase()
        if (aStr < bStr) return sortConfig.value.direction === 'asc' ? -1 : 1
        if (aStr > bStr) return sortConfig.value.direction === 'asc' ? 1 : -1
      } else {
        if (aValue < bValue) return sortConfig.value.direction === 'asc' ? -1 : -1
        if (aValue > bValue) return sortConfig.value.direction === 'asc' ? 1 : 1
      }
      return 0
    })
  }

  return result
})

function entityName(entity: Entity): string {
  const name = props.entityType === 'computer' ? entity.Hostname : entity.Username
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

function setSort(key: string) {
  if (sortConfig.value.key === key) {
    // Toggle direction if same key
    sortConfig.value.direction = sortConfig.value.direction === 'asc' ? 'desc' : 'asc'
  } else {
    // Set new key and default to ascending
    sortConfig.value.key = key
    sortConfig.value.direction = 'asc'
  }
}
</script>

<template>
  <div class="table-controls">
    <div class="search-control">
      <label for="entity-search">Search:</label>
      <input
        id="entity-search"
        v-model="searchQuery"
        type="search"
        placeholder="Search all fields..."
        aria-label="Search entities"
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
    <div v-else-if="filteredAndSortedEntities.length === 0" class="table-state">
      No {{ entityLabel }} found matching your search.
    </div>
    <div v-else class="table-scroll">
      <table>
        <thead>
          <tr v-if="entityType === 'computer'">
            <th>
              <button class="sort-header" @click="setSort('Hostname')">
                Computer
                <span v-if="sortConfig.key === 'Hostname'" class="sort-indicator">
                  {{ sortConfig.direction === 'asc' ? '↑' : '↓' }}
                </span>
              </button>
            </th>
            <th>
              <button class="sort-header" @click="setSort('SerialNumber')">
                Serial number(s)
                <span v-if="sortConfig.key === 'SerialNumber'" class="sort-indicator">
                  {{ sortConfig.direction === 'asc' ? '↑' : '↓' }}
                </span>
              </button>
            </th>
            <th>
              <button class="sort-header" @click="setSort('DeviceType')">
                Type
                <span v-if="sortConfig.key === 'DeviceType'" class="sort-indicator">
                  {{ sortConfig.direction === 'asc' ? '↑' : '↓' }}
                </span>
              </button>
            </th>
            <th>
              <button class="sort-header" @click="setSort('Manufacturer')">
                Manufacturer
                <span v-if="sortConfig.key === 'Manufacturer'" class="sort-indicator">
                  {{ sortConfig.direction === 'asc' ? '↑' : '↓' }}
                </span>
              </button>
            </th>
            <th>
              <button class="sort-header" @click="setSort('Model')">
                Model
                <span v-if="sortConfig.key === 'Model'" class="sort-indicator">
                  {{ sortConfig.direction === 'asc' ? '↑' : '↓' }}
                </span>
              </button>
            </th>
            <th>
              <button class="sort-header" @click="setSort('OS')">
                Operating system
                <span v-if="sortConfig.key === 'OS'" class="sort-indicator">
                  {{ sortConfig.direction === 'asc' ? '↑' : '↓' }}
                </span>
              </button>
            </th>
            <th>
              <button class="sort-header" @click="setSort('LastUpdated')">
                Last updated
                <span v-if="sortConfig.key === 'LastUpdated'" class="sort-indicator">
                  {{ sortConfig.direction === 'asc' ? '↑' : '↓' }}
                </span>
              </button>
            </th>
          </tr>
          <tr v-else>
            <th>
              <button class="sort-header" @click="setSort('Username')">
                Username
                <span v-if="sortConfig.key === 'Username'" class="sort-indicator">
                  {{ sortConfig.direction === 'asc' ? '↑' : '↓' }}
                </span>
              </button>
            </th>
            <th>
              <button class="sort-header" @click="setSort('ADUsername')">
                AD username
                <span v-if="sortConfig.key === 'ADUsername'" class="sort-indicator">
                  {{ sortConfig.direction === 'asc' ? '↑' : '↓' }}
                </span>
              </button>
            </th>
            <th>
              <button class="sort-header" @click="setSort('Domain')">
                Domain
                <span v-if="sortConfig.key === 'Domain'" class="sort-indicator">
                  {{ sortConfig.direction === 'asc' ? '↑' : '↓' }}
                </span>
              </button>
            </th>
            <th>
              <button class="sort-header" @click="setSort('DomainOrLocal')">
                Account type
                <span v-if="sortConfig.key === 'DomainOrLocal'" class="sort-indicator">
                  {{ sortConfig.direction === 'asc' ? '↑' : '↓' }}
                </span>
              </button>
            </th>
            <th>
              <button class="sort-header" @click="setSort('O365Email')">
                Email
                <span v-if="sortConfig.key === 'O365Email'" class="sort-indicator">
                  {{ sortConfig.direction === 'asc' ? '↑' : '↓' }}
                </span>
              </button>
            </th>
            <th>
              <button class="sort-header" @click="setSort('LastUpdated')">
                Last updated
                <span v-if="sortConfig.key === 'LastUpdated'" class="sort-indicator">
                  {{ sortConfig.direction === 'asc' ? '↑' : '↓' }}
                </span>
              </button>
            </th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="entity in filteredAndSortedEntities" :key="entity.id">
            <td>
              <div class="entity-cell">
                <button 
                  class="entity-link" 
                  :aria-label="`View usage for ${entityName(entity)}`" 
                  @click="emit('select', entity)"
                >
                  <span>{{ entityName(entity) }}</span>
                  <small>{{ entity.id }}</small>
                </button>
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
