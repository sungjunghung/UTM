<script setup lang="ts">
import { ref, computed } from 'vue'
import MaterialIcon from '../MaterialIcon.vue'
import type { DroneInfo } from '../../services/drone/types'
import type { CollisionRisk } from '../../services/drone/collisionTypes'

const props = defineProps<{
  droneList: DroneInfo[]
  showDrones: boolean
  collisionRisks?: CollisionRisk[]
  isSimulatingConflict?: boolean
}>()

const emit = defineEmits<{
  (e: 'selectDrone', id: string): void
  (e: 'toggleDrones'): void
  (e: 'focusDroneZone'): void
  (e: 'triggerConflict'): void
  (e: 'resetConflict'): void
  (e: 'focusCollision', coordinate: [number, number]): void
}>()

const searchQuery = ref('')
const isSearchOpen = ref(false)

const highestAlertSeverity = computed(() => {
  if (!props.showDrones) return 'clear'
  if (!props.collisionRisks || props.collisionRisks.length === 0) return 'clear'
  if (props.collisionRisks.some((r) => r.severity === 'critical')) return 'critical'
  if (props.collisionRisks.some((r) => r.severity === 'warning')) return 'warning'
  return 'advisory'
})

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

function toggleSearch() {
  if (props.showDrones) {
    isSearchOpen.value = !isSearchOpen.value
  }
}

function handleAlertClick() {
  if (props.showDrones && props.collisionRisks && props.collisionRisks.length > 0) {
    emit('focusCollision', props.collisionRisks[0].cpaCoordinate)
  }
}

function handleConflictClick() {
  if (props.showDrones) {
    props.isSimulatingConflict ? emit('resetConflict') : emit('triggerConflict')
  }
}

function handleFocusHub() {
  if (props.showDrones) {
    emit('focusDroneZone')
  }
}
</script>

<template>
  <div class="flex flex-col items-start gap-1.5 select-none">
    <!-- Status Pill -->
    <div
      class="flex items-center gap-1.5 p-1 pl-2.5 pr-1.5 rounded-md bg-base-100/95 backdrop-blur-md border shadow-lg transition-all"
      :class="showDrones ? 'border-cyan-500/50 shadow-cyan-950/20' : 'border-base-300 opacity-60'"
    >
      <!-- Drone Pulse Indicator (Cyan) -->
      <div class="relative flex items-center justify-center w-3 h-3">
        <span
          v-if="showDrones"
          class="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 bg-cyan-400"
        ></span>
        <span
          class="relative inline-flex rounded-full h-2 w-2"
          :class="showDrones ? 'bg-cyan-500' : 'bg-base-content/40'"
        ></span>
      </div>

      <!-- Drone Title & Main Layer Toggle Button -->
      <button
        class="flex items-center gap-2 text-sm font-bold transition-colors cursor-pointer"
        :class="showDrones ? 'text-cyan-400 hover:text-cyan-300' : 'text-base-content/70 hover:text-base-content'"
        title="點擊開關空域即時無人機圖層"
        @click="emit('toggleDrones')"
      >
        <MaterialIcon name="toys" :size="18" :class="showDrones ? 'text-cyan-400' : 'text-base-content/40'" />
        <span class="tracking-wide">空域即時無人機</span>
        <span v-if="showDrones" class="font-mono font-bold text-sm text-cyan-400">{{ droneList.length }} 架</span>
      </button>

      <div class="w-px h-4 bg-base-content/20 mx-0.5"></div>

      <!-- Action: Toggle Search List -->
      <button
        class="btn btn-sm btn-circle"
        :class="
          !showDrones
            ? 'btn-ghost text-base-content/25 opacity-40 cursor-not-allowed pointer-events-none'
            : isSearchOpen
            ? 'btn-ghost btn-active text-cyan-400'
            : 'btn-ghost'
        "
        :disabled="!showDrones"
        title="查看無人機機隊清單"
        @click="toggleSearch"
      >
        <MaterialIcon name="toys" :size="18" />
      </button>

      <!-- Action: Alert Status Indicator (警示燈號，不展開彈窗) -->
      <button
        class="btn btn-sm btn-circle relative transition-all"
        :class="
          !showDrones
            ? 'btn-ghost text-base-content/25 opacity-40 cursor-not-allowed pointer-events-none'
            : highestAlertSeverity === 'critical'
            ? 'btn-error animate-pulse text-white shadow-lg shadow-error/40'
            : highestAlertSeverity === 'warning'
            ? 'btn-warning text-slate-900 shadow-md'
            : highestAlertSeverity === 'advisory'
            ? 'btn-info text-white'
            : 'btn-ghost text-base-content/70'
        "
        :disabled="!showDrones"
        :title="
          !showDrones
            ? '無人機圖層已關閉'
            : collisionRisks && collisionRisks.length > 0
            ? `空域即時告警 (${collisionRisks.length} 則) - 點擊將視角定位至首要警戒空域`
            : '空域正常（無衝突與越界）'
        "
        @click="handleAlertClick"
      >
        <MaterialIcon
          :name="showDrones && highestAlertSeverity !== 'clear' ? 'warning' : 'security'"
          :size="18"
        />
        <span
          v-if="showDrones && collisionRisks && collisionRisks.length > 0"
          class="badge badge-sm absolute -top-1 -right-1 px-1 font-bold border-none"
          :class="highestAlertSeverity === 'critical' ? 'bg-white text-error' : 'bg-warning text-slate-900'"
        >
          {{ collisionRisks.length }}
        </span>
      </button>

      <!-- Action: Simulate Conflict Path (Interactive Testing) -->
      <button
        class="btn btn-sm rounded-sm px-2.5 gap-1.5 font-medium transition-all"
        :class="
          !showDrones
            ? 'btn-ghost opacity-40 cursor-not-allowed text-base-content/30 pointer-events-none'
            : isSimulatingConflict
            ? 'btn-error btn-outline animate-pulse text-sm'
            : 'btn-ghost text-sm hover:bg-cyan-500/10 text-cyan-400'
        "
        :disabled="!showDrones"
        :title="
          !showDrones
            ? '請先開啟無人機圖層'
            : isSimulatingConflict
            ? '重設為正常巡檢'
            : '模擬兩架無人機航向交會碰撞預警'
        "
        @click="handleConflictClick"
      >
        <MaterialIcon :name="isSimulatingConflict ? 'restart_alt' : 'crisis_alert'" :size="16" />
        <span class="text-sm font-semibold">{{ isSimulatingConflict ? '還原巡檢' : '模擬碰撞' }}</span>
      </button>

      <!-- Action: Center on Drone Operations Hub -->
      <button
        class="btn btn-sm btn-ghost btn-circle"
        :class="!showDrones ? 'text-base-content/25 opacity-40 cursor-not-allowed pointer-events-none' : 'text-cyan-400'"
        :disabled="!showDrones"
        title="視角移至合法空域無人機作業群"
        @click="handleFocusHub"
      >
        <MaterialIcon name="my_location" :size="18" />
      </button>
    </div>

    <!-- Drone Search / Quick Jump Dropdown Popover -->
    <div
      v-if="isSearchOpen"
      class="w-80 sm:w-96 rounded-md bg-base-100/98 backdrop-blur-md border border-cyan-500/40 shadow-2xl p-3.5 space-y-2.5 animate-in fade-in duration-100 z-50 text-sm"
    >
      <div class="flex items-center justify-between pb-1.5 border-b border-base-300">
        <span class="text-sm font-bold flex items-center gap-1.5 text-cyan-400">
          <MaterialIcon name="flight_takeoff" :size="18" />
          空域即時無人機任務清單
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
          placeholder="搜尋呼號、機型或任務單位..."
        />
        <button v-if="searchQuery" class="btn btn-ghost btn-circle btn-xs" @click="searchQuery = ''">
          <MaterialIcon name="close" :size="14" />
        </button>
      </label>

      <!-- Drones List -->
      <div class="max-h-64 overflow-y-auto space-y-1.5 pr-1">
        <button
          v-for="d in filteredList"
          :key="d.id"
          class="w-full flex items-center justify-between p-2 rounded-sm bg-base-200/50 hover:bg-cyan-950/40 hover:border-cyan-500/40 border border-transparent text-left transition-all cursor-pointer group"
          @click="
            emit('selectDrone', d.id);
            isSearchOpen = false;
          "
        >
          <div class="flex items-center gap-2.5 min-w-0">
            <span class="w-2.5 h-2.5 rounded-full flex-shrink-0 bg-cyan-400"></span>
            <div class="min-w-0">
              <div class="flex items-center gap-2">
                <span class="font-bold text-cyan-300 text-sm truncate">{{ d.callsign }}</span>
                <span class="badge badge-sm bg-cyan-500/20 text-cyan-300 border-none text-xs px-1.5 font-mono">
                  {{ d.remoteId }}
                </span>
              </div>
              <div class="text-sm text-base-content/80 mt-0.5 truncate">
                {{ d.missionType }}
              </div>
            </div>
          </div>
          <div class="text-right font-mono flex-shrink-0 ml-2">
            <div class="text-cyan-400 font-bold text-sm">{{ d.altitudeAglMeters }}m</div>
            <div class="text-sm text-emerald-400">🔋 {{ d.batteryPercent }}%</div>
          </div>
        </button>
      </div>
    </div>
  </div>
</template>
