<script setup lang="ts">
import { ref, computed } from 'vue'
import MaterialIcon from '../MaterialIcon.vue'
import type { AircraftInfo } from '../../services/aircraft/types'

const props = defineProps<{
  aircraftList: AircraftInfo[]
  isLoading: boolean
  error: string | null
  showTrails: boolean
}>()

const emit = defineEmits<{
  (e: 'selectFlight', hex: string): void
  (e: 'toggleTrails'): void
  (e: 'refresh'): void
}>()

const searchQuery = ref('')
const isSearchOpen = ref(false)
const isLegendOpen = ref(false)

const filteredList = computed(() => {
  const q = searchQuery.value.trim().toUpperCase()
  if (!q) return props.aircraftList.slice(0, 15)
  return props.aircraftList
    .filter(
      (ac) =>
        ac.flight.toUpperCase().includes(q) ||
        ac.model.toUpperCase().includes(q) ||
        ac.hex.toUpperCase().includes(q) ||
        ac.registration.toUpperCase().includes(q)
    )
    .slice(0, 20)
})

const altitudeLegends = [
  { label: '< 10k ft (進場/離場)', color: '#06b6d4' },
  { label: '10k ~ 24k ft (中空)', color: '#3b82f6' },
  { label: '24k ~ 34k ft (巡航)', color: '#8b5cf6' },
  { label: '> 34k ft (高空巡航)', color: '#f59e0b' },
]
</script>

<template>
  <div class="flex flex-col items-start gap-2 select-none">
    <!-- Status Pill -->
    <div class="flex items-center gap-2 p-1.5 pl-3 pr-2 rounded-2xl bg-base-100/90 backdrop-blur-xl border border-base-300 shadow-xl">
      <!-- Radar Pulse Indicator -->
      <div class="relative flex items-center justify-center w-3 h-3">
        <span
          class="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75"
          :class="error ? 'bg-error' : isLoading ? 'bg-warning' : 'bg-success'"
        ></span>
        <span
          class="relative inline-flex rounded-full h-2 w-2"
          :class="error ? 'bg-error' : isLoading ? 'bg-warning' : 'bg-success'"
        ></span>
      </div>

      <div class="text-xs font-semibold flex items-center gap-1.5">
        <span class="text-base-content/70">雷達追蹤:</span>
        <span class="font-mono font-bold text-primary">{{ aircraftList.length }}</span>
        <span class="text-base-content/60 text-[11px]">架</span>
      </div>

      <div class="divider divider-horizontal mx-0.5 h-4"></div>

      <!-- Action: Toggle Search List -->
      <button
        class="btn btn-xs btn-ghost btn-circle"
        :class="{ 'btn-active text-primary': isSearchOpen }"
        title="搜尋航班"
        @click="isSearchOpen = !isSearchOpen"
      >
        <MaterialIcon name="search" :size="16" />
      </button>

      <!-- Action: Toggle Trails -->
      <button
        class="btn btn-xs btn-ghost btn-circle"
        :class="{ 'text-primary': showTrails }"
        :title="showTrails ? '隱藏飛行軌跡' : '顯示飛行軌跡'"
        @click="emit('toggleTrails')"
      >
        <MaterialIcon name="timeline" :size="16" />
      </button>

      <!-- Action: Altitude Legend -->
      <button
        class="btn btn-xs btn-ghost btn-circle"
        :class="{ 'text-secondary': isLegendOpen }"
        title="高度圖例"
        @click="isLegendOpen = !isLegendOpen"
      >
        <MaterialIcon name="palette" :size="16" />
      </button>
    </div>

    <!-- Error Alert if any -->
    <div v-if="error" class="alert alert-error py-1.5 px-3 text-xs shadow-lg max-w-xs flex items-center gap-2">
      <MaterialIcon name="error" :size="16" />
      <span class="truncate">{{ error }}</span>
      <button class="btn btn-xs btn-circle btn-ghost" @click="emit('refresh')">
        <MaterialIcon name="refresh" :size="14" />
      </button>
    </div>

    <!-- Flight Search / Quick Jump Dropdown Popover -->
    <div
      v-if="isSearchOpen"
      class="w-72 sm:w-80 rounded-2xl bg-base-100/95 backdrop-blur-xl border border-base-300 shadow-2xl p-3 space-y-2 animate-in fade-in zoom-in-95 duration-150"
    >
      <div class="flex items-center justify-between pb-1 border-b border-base-300">
        <span class="text-xs font-bold flex items-center gap-1.5">
          <MaterialIcon name="flight_takeoff" :size="16" class="text-primary" />
          台灣空域即時航班清單
        </span>
        <button class="btn btn-xs btn-circle btn-ghost" @click="isSearchOpen = false">
          <MaterialIcon name="close" :size="14" />
        </button>
      </div>

      <!-- Search Input -->
      <label class="input input-xs input-bordered flex items-center gap-1.5 bg-base-200/50">
        <MaterialIcon name="search" :size="14" class="text-base-content/50" />
        <input
          v-model="searchQuery"
          type="text"
          class="grow placeholder:text-base-content/40 text-xs"
          placeholder="搜尋呼號 (如 BR, CI, A350)..."
        />
        <button v-if="searchQuery" class="btn btn-ghost btn-circle btn-xs" @click="searchQuery = ''">
          <MaterialIcon name="close" :size="12" />
        </button>
      </label>

      <!-- Flights List -->
      <div class="max-h-60 overflow-y-auto space-y-1 pr-1">
        <button
          v-for="ac in filteredList"
          :key="ac.hex"
          class="w-full flex items-center justify-between p-2 rounded-xl bg-base-200/50 hover:bg-primary hover:text-primary-content text-left text-xs transition-colors group cursor-pointer"
          @click="emit('selectFlight', ac.hex)"
        >
          <div class="flex items-center gap-2 truncate">
            <span
              class="w-2 h-2 rounded-full flex-shrink-0"
              :style="{ background: ac.isGround ? '#10b981' : '#3b82f6' }"
            ></span>
            <div>
              <div class="font-bold font-mono leading-none">{{ ac.flight || ac.hex.toUpperCase() }}</div>
              <div class="text-[10px] opacity-70 mt-0.5">{{ ac.model }} · {{ ac.registration }}</div>
            </div>
          </div>
          <div class="text-right font-mono text-[11px] flex-shrink-0">
            <div>{{ ac.altitude.toLocaleString() }} ft</div>
            <div class="text-[10px] opacity-70">{{ ac.speed }} kts</div>
          </div>
        </button>

        <div v-if="filteredList.length === 0" class="text-center py-4 text-xs text-base-content/50">
          無符合航班
        </div>
      </div>
    </div>

    <!-- Altitude Legend Popover -->
    <div
      v-if="isLegendOpen"
      class="rounded-2xl bg-base-100/95 backdrop-blur-xl border border-base-300 shadow-2xl p-3 text-xs space-y-2 animate-in fade-in zoom-in-95 duration-150"
    >
      <div class="flex items-center justify-between pb-1 border-b border-base-300">
        <span class="font-bold text-[11px] text-base-content/70">高度顏色分級 (Altitude)</span>
        <button class="btn btn-xs btn-circle btn-ghost" @click="isLegendOpen = false">
          <MaterialIcon name="close" :size="14" />
        </button>
      </div>
      <div class="space-y-1.5 font-mono text-[11px]">
        <div v-for="leg in altitudeLegends" :key="leg.label" class="flex items-center gap-2">
          <span class="w-3 h-3 rounded-md flex-shrink-0" :style="{ background: leg.color }"></span>
          <span>{{ leg.label }}</span>
        </div>
      </div>
    </div>
  </div>
</template>
