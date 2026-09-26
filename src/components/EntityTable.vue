<script setup lang="ts">
import { computed } from 'vue'

type EntityType = 'computer' | 'user'
interface EntityLinks {
  itGlue: string[]
  dattoRmm: string[]
}
type Entity = Record<string, string | number | null | undefined> & { id: string; links?: EntityLinks }

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
</script>

<template>
  <div class="table-frame">
    <div v-if="isLoading" class="table-state" role="status">
      Loading {{ entityLabel }}…
    </div>
    <div v-else-if="loadFailed" class="table-state">
      The {{ entityLabel }} list is unavailable.
    </div>
    <div v-else-if="entities.length === 0" class="table-state">
      No {{ entityLabel }} found for this account.
    </div>
    <div v-else class="table-scroll">
      <table>
        <thead>
          <tr v-if="entityType === 'computer'">
            <th>Computer</th>
            <th>Serial number(s)</th>
            <th>Type</th>
            <th>Manufacturer</th>
            <th>Model</th>
            <th>Operating system</th>
            <th>Last updated</th>
          </tr>
          <tr v-else>
            <th>Username</th>
            <th>AD username</th>
            <th>Domain</th>
            <th>Account type</th>
            <th>Email</th>
            <th>Last updated</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="entity in entities" :key="entity.id">
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
                  <a
                    v-for="(href, index) in entity.links?.itGlue ?? []"
                    :key="`itglue-${href}`"
                    class="external-link"
                    :href="href"
                    target="_blank"
                    rel="noopener noreferrer"
                    :aria-label="`Open IT Glue record for ${entityName(entity)}${(entity.links?.itGlue.length ?? 0) > 1 ? `, link ${index + 1}` : ''}`"
                  >
                    {{ (entity.links?.itGlue.length ?? 0) > 1 ? `IT Glue ${index + 1}` : 'IT Glue' }}
                  </a>
                  <a
                    v-for="(href, index) in entity.links?.dattoRmm ?? []"
                    :key="`datto-${href}`"
                    class="external-link"
                    :href="href"
                    target="_blank"
                    rel="noopener noreferrer"
                    :aria-label="`Open Datto RMM record for ${entityName(entity)}${(entity.links?.dattoRmm.length ?? 0) > 1 ? `, link ${index + 1}` : ''}`"
                  >
                    {{ (entity.links?.dattoRmm.length ?? 0) > 1 ? `Datto RMM ${index + 1}` : 'Datto RMM' }}
                  </a>
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
