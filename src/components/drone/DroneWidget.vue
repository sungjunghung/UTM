<script setup lang="ts">
import { ref, computed } from 'vue'
import MaterialIcon from '../MaterialIcon.vue'
import type { DroneInfo } from '../../services/drone/types'

const props = defineProps<{
  droneList: DroneInfo[]
  showDrones: boolean
}>()

const emit = defineEmits<{
  (e: 'selectDrone', id: string): void
  (e: 'toggleDrones'): void
  (e: 'focusDroneZone'): void
}>()

const searchQuery = ref('')
const isSearchOpen = ref(false)

const filteredList = computed(() => {
  const q = searchQuery.value.trim().toUpperCase()
  if (!q) return props.droneList
  return props.droneList.filter(
    (d) =>
      d.callsign.toUpperCase().includes(q) ||
      d.model.toUpperCase().includes(q) ||
      d.remoteId.toUpperCase().includes(q) ||
      d.operator.toUpperCase().includes(q) ||
      d.missionType.toUpperCase().includes(q)
  )
})
</script>

<template>
  <div class="flex flex-col items-start gap-2 select-none">
    <!-- Status Pill -->
    <div
      class="flex items-center gap-2 p-1.5 pl-3 pr-2 rounded-2xl bg-base-100/90 backdrop-blur-xl border border-cyan-500/30 shadow-xl transition-all"
      :class="{ 'opacity-60': !showDrones }"
    >
      <!-- Drone Pulse Indicator (Cyan) -->
      <div class="relative flex items-center justify-center w-3 h-3">
        <span
          class="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 bg-cyan-400"
        ></span>
        <span class="relative inline-flex rounded-full h-2 w-2 bg-cyan-500"></span>
      </div>

      <div class="text-xs font-semibold flex items-center gap-1.5" title="空域即時在空無人機 (UAV / Drone)">
        <span class="text-base-content/70">空域即時無人機:</span>
        <span class="font-mono font-bold text-cyan-400">{{ droneList.length }}</span>
        <span class="text-base-content/60 text-[11px]">架</span>
      </div>

      <div class="divider divider-horizontal mx-0.5 h-4"></div>

      <!-- Action: Toggle Search List -->
      <button
        class="btn btn-xs btn-ghost btn-circle"
        :class="{ 'btn-active text-cyan-400': isSearchOpen }"
        title="查看無人機機隊清單"
        @click="isSearchOpen = !isSearchOpen"
      >
        <MaterialIcon name="toys" :size="16" />
      </button>

      <!-- Action: Toggle Visibility -->
      <button
        class="btn btn-xs btn-ghost btn-circle"
        :class="{ 'text-cyan-400': showDrones, 'text-base-content/40': !showDrones }"
        :title="showDrones ? '隱藏無人機圖層' : '顯示無人機圖層'"
        @click="emit('toggleDrones')"
      >
        <MaterialIcon :name="showDrones ? 'visibility' : 'visibility_off'" :size="16" />
      </button>

      <!-- Action: Center on Drone Operations Hub (NCHC) -->
      <button
        class="btn btn-xs btn-ghost btn-circle text-cyan-400"
        title="視角移至新竹國網無人機空域"
        @click="emit('focusDroneZone')"
      >
        <MaterialIcon name="my_location" :size="16" />
      </button>
    </div>

    <!-- Drone Search / Quick Jump Dropdown Popover -->
    <div
      v-if="isSearchOpen"
      class="w-72 sm:w-84 rounded-2xl bg-base-100/95 backdrop-blur-xl border border-cyan-500/40 shadow-2xl p-3 space-y-2 animate-in fade-in zoom-in-95 duration-150 z-50"
    >
      <div class="flex items-center justify-between pb-1.5 border-b border-base-300">
        <span class="text-xs font-bold flex items-center gap-1.5 text-cyan-400">
          <MaterialIcon name="flight_takeoff" :size="16" />
          空域即時無人機任務清單
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
          placeholder="搜尋呼號、機型或任務單位..."
        />
        <button v-if="searchQuery" class="btn btn-ghost btn-circle btn-xs" @click="searchQuery = ''">
          <MaterialIcon name="close" :size="12" />
        </button>
      </label>

      <!-- Drones List -->
      <div class="max-h-64 overflow-y-auto space-y-1.5 pr-1">
        <button
          v-for="d in filteredList"
          :key="d.id"
          class="w-full flex items-center justify-between p-2 rounded-xl bg-base-200/50 hover:bg-cyan-950/40 hover:border-cyan-500/40 border border-transparent text-left text-xs transition-all cursor-pointer group"
          @click="
            emit('selectDrone', d.id);
            isSearchOpen = false;
          "
        >
          <div class="flex items-center gap-2 min-w-0">
            <span class="w-2 h-2 rounded-full flex-shrink-0 bg-cyan-400"></span>
            <div class="min-w-0">
              <div class="flex items-center gap-1.5">
                <span class="font-bold text-cyan-300 truncate">{{ d.callsign }}</span>
                <span class="badge badge-xs bg-cyan-500/20 text-cyan-300 border-none text-[9px] px-1 font-mono">
                  {{ d.remoteId }}
                </span>
              </div>
              <div class="text-[10px] text-base-content/70 mt-0.5 truncate">
                {{ d.missionType }}
              </div>
            </div>
          </div>
          <div class="text-right font-mono text-[11px] flex-shrink-0 ml-2">
            <div class="text-cyan-400 font-bold">{{ d.altitudeAglMeters }}m</div>
            <div class="text-[10px] text-emerald-400">🔋 {{ d.batteryPercent }}%</div>
          </div>
        </button>
      </div>
    </div>
  </div>
</template>
