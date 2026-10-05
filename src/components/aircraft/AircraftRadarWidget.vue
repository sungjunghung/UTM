<script setup lang="ts">
import { ref, computed } from 'vue'
import MaterialIcon from '../MaterialIcon.vue'
import type { AircraftInfo } from '../../services/aircraft/types'
import { flightInfoService } from '../../services/aircraft/flightInfoService'

const props = defineProps<{
  aircraftList: AircraftInfo[]
  isLoading: boolean
  error: string | null
  showTrails: boolean
  showAircraft: boolean
}>()

const emit = defineEmits<{
  (e: 'selectFlight', hex: string): void
  (e: 'toggleTrails'): void
  (e: 'refresh'): void
  (e: 'toggleAircraft'): void
}>()

const searchQuery = ref('')
const isSearchOpen = ref(false)
const isLegendOpen = ref(false)

const filteredList = computed(() => {
  const q = searchQuery.value.trim().toUpperCase()
  if (!q) return props.aircraftList.slice(0, 15)
  return props.aircraftList
    .filter((ac) => {
      const airline = flightInfoService.getAirline(ac.flight)
      return (
        ac.flight.toUpperCase().includes(q) ||
        ac.model.toUpperCase().includes(q) ||
        ac.hex.toUpperCase().includes(q) ||
        ac.registration.toUpperCase().includes(q) ||
        (airline && (airline.nameZh.includes(q) || airline.nameEn.toUpperCase().includes(q)))
      )
    })
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
  <div class="flex flex-col items-start gap-1.5 select-none">
    <!-- Status Pill -->
    <div
      class="flex items-center gap-2 p-1 pl-2.5 pr-1.5 rounded-md bg-base-100/95 backdrop-blur-md border border-base-300 shadow-lg transition-all"
      :class="{ 'opacity-60 border-dashed': !showAircraft }"
    >
      <!-- Radar Pulse Indicator -->
      <div class="relative flex items-center justify-center w-3 h-3">
        <span
          class="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75"
          :class="error ? 'bg-error' : isLoading ? 'bg-warning' : showAircraft ? 'bg-success' : 'bg-base-content/30'"
        ></span>
        <span
          class="relative inline-flex rounded-full h-2 w-2"
          :class="error ? 'bg-error' : isLoading ? 'bg-warning' : showAircraft ? 'bg-success' : 'bg-base-content/30'"
        ></span>
      </div>

      <div class="text-sm font-semibold flex items-center gap-2" title="空域即時在空航班與航機">
        <span class="text-base-content/80">空域即時航班:</span>
        <span class="font-mono font-bold text-base" :class="showAircraft ? 'text-primary' : 'text-base-content/50'">{{ aircraftList.length }}</span>
        <span class="text-base-content/70 text-sm">架</span>
      </div>

      <div class="divider divider-horizontal mx-0.5 h-4"></div>

      <!-- Action: Toggle Visibility (Direct on top bar) -->
      <button
        class="btn btn-sm btn-ghost btn-circle"
        :class="{ 'text-primary': showAircraft, 'text-base-content/40': !showAircraft }"
        :title="showAircraft ? '隱藏空域即時航班圖層' : '顯示空域即時航班圖層'"
        @click="emit('toggleAircraft')"
      >
        <MaterialIcon :name="showAircraft ? 'visibility' : 'visibility_off'" :size="18" />
      </button>

      <!-- Action: Toggle Search List -->
      <button
        class="btn btn-sm btn-ghost btn-circle"
        :class="{ 'btn-active text-primary': isSearchOpen }"
        title="搜尋航班"
        @click="isSearchOpen = !isSearchOpen"
      >
        <MaterialIcon name="search" :size="18" />
      </button>

      <!-- Action: Toggle Trails -->
      <button
        class="btn btn-sm btn-ghost btn-circle"
        :class="{ 'text-primary': showTrails }"
        :title="showTrails ? '隱藏飛行軌跡' : '顯示飛行軌跡'"
        @click="emit('toggleTrails')"
      >
        <MaterialIcon name="timeline" :size="18" />
      </button>

      <!-- Action: Altitude Legend -->
      <button
        class="btn btn-sm btn-ghost btn-circle"
        :class="{ 'text-secondary': isLegendOpen }"
        title="高度圖例"
        @click="isLegendOpen = !isLegendOpen"
      >
        <MaterialIcon name="palette" :size="18" />
      </button>
    </div>

    <!-- Error Alert if any -->
    <div v-if="error" class="alert alert-error py-2 px-3.5 text-sm shadow-lg max-w-sm flex items-center gap-2">
      <MaterialIcon name="error" :size="18" />
      <span class="truncate">{{ error }}</span>
      <button class="btn btn-sm btn-circle btn-ghost" @click="emit('refresh')">
        <MaterialIcon name="refresh" :size="16" />
      </button>
    </div>

    <!-- Flight Search / Quick Jump Dropdown Popover -->
    <div
      v-if="isSearchOpen"
      class="w-80 sm:w-96 rounded-md bg-base-100/98 backdrop-blur-md border border-base-300 shadow-2xl p-3.5 space-y-2.5 animate-in fade-in duration-100 text-sm"
    >
      <div class="flex items-center justify-between pb-1.5 border-b border-base-300">
        <span class="text-sm font-bold flex items-center gap-2">
          <MaterialIcon name="flight_takeoff" :size="18" class="text-primary" />
          台灣空域即時航班清單
        </span>
        <button class="btn btn-sm btn-circle btn-ghost" @click="isSearchOpen = false">
          <MaterialIcon name="close" :size="16" />
        </button>
      </div>

      <!-- Search Input -->
      <label class="input input-sm input-bordered rounded-sm flex items-center gap-2 bg-base-200/50">
        <MaterialIcon name="search" :size="16" class="text-base-content/60" />
        <input
          v-model="searchQuery"
          type="text"
          class="grow placeholder:text-base-content/50 text-sm"
          placeholder="搜尋呼號 (如 BR, CI, A350)..."
        />
        <button v-if="searchQuery" class="btn btn-ghost btn-circle btn-xs" @click="searchQuery = ''">
          <MaterialIcon name="close" :size="14" />
        </button>
      </label>

      <!-- Flights List -->
      <div class="max-h-64 overflow-y-auto space-y-1.5 pr-1">
        <button
          v-for="ac in filteredList"
          :key="ac.hex"
          class="w-full flex items-center justify-between p-2 rounded-sm bg-base-200/50 hover:bg-primary hover:text-primary-content text-left transition-colors group cursor-pointer"
          @click="emit('selectFlight', ac.hex)"
        >
          <div class="flex items-center gap-2.5 truncate">
            <span
              class="w-2.5 h-2.5 rounded-full flex-shrink-0"
              :style="{ background: ac.isGround ? '#10b981' : '#3b82f6' }"
            ></span>
            <div>
              <div class="flex items-center gap-2">
                <span class="font-bold font-mono text-sm leading-none">{{ ac.flight || ac.hex.toUpperCase() }}</span>
                <span
                  v-if="flightInfoService.getAirline(ac.flight)"
                  class="badge badge-sm bg-sky-400/20 text-sky-400 border-none text-xs px-1.5"
                >
                  {{ flightInfoService.getAirline(ac.flight)!.nameZh }}
                </span>
              </div>
              <div class="text-sm opacity-80 mt-0.5">{{ ac.model }} · {{ ac.registration }}</div>
            </div>
          </div>
          <div class="text-right font-mono text-sm flex-shrink-0">
            <div>{{ ac.altitude.toLocaleString() }} ft</div>
            <div class="text-xs opacity-75">{{ ac.speed }} kts</div>
          </div>
        </button>

        <div v-if="filteredList.length === 0" class="text-center py-5 text-sm text-base-content/60">
          無符合航班
        </div>
      </div>
    </div>

    <!-- Altitude Legend Popover -->
    <div
      v-if="isLegendOpen"
      class="rounded-md bg-base-100/98 backdrop-blur-md border border-base-300 shadow-2xl p-3.5 text-sm space-y-2 animate-in fade-in duration-100"
    >
      <div class="flex items-center justify-between pb-1.5 border-b border-base-300">
        <span class="font-bold text-sm text-base-content/80">高度顏色分級 (Altitude)</span>
        <button class="btn btn-sm btn-circle btn-ghost" @click="isLegendOpen = false">
          <MaterialIcon name="close" :size="16" />
        </button>
      </div>
      <div class="space-y-1.5 font-mono text-sm">
        <div v-for="leg in altitudeLegends" :key="leg.label" class="flex items-center gap-2.5">
          <span class="w-3 h-3 rounded-sm flex-shrink-0" :style="{ background: leg.color }"></span>
          <span>{{ leg.label }}</span>
        </div>
      </div>
    </div>
  </div>
</template>
