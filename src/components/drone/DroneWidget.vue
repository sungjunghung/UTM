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
const isAlertsOpen = ref(false)

const highestAlertSeverity = computed(() => {
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
</script>

<template>
  <div class="flex flex-col items-start gap-1.5 select-none">
    <!-- Status Pill -->
    <div
      class="flex items-center gap-2 p-1 pl-2.5 pr-1.5 rounded-md bg-base-100/95 backdrop-blur-md border border-cyan-500/40 shadow-lg transition-all"
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

      <!-- Action: Collision Alerts (CPA) Button -->
      <button
        class="btn btn-xs btn-circle relative transition-all"
        :class="
          highestAlertSeverity === 'critical'
            ? 'btn-error animate-pulse text-white shadow-lg shadow-error/40'
            : highestAlertSeverity === 'warning'
            ? 'btn-warning text-slate-900 shadow-md'
            : highestAlertSeverity === 'advisory'
            ? 'btn-info text-white'
            : 'btn-ghost text-base-content/60'
        "
        :title="`CPA 碰撞預警監控 (${collisionRisks?.length || 0} 起衝突預警)`"
        @click="isAlertsOpen = !isAlertsOpen"
      >
        <MaterialIcon
          :name="highestAlertSeverity !== 'clear' ? 'warning' : 'security'"
          :size="16"
        />
        <span
          v-if="collisionRisks && collisionRisks.length > 0"
          class="badge badge-xs absolute -top-1 -right-1 px-1 font-bold border-none"
          :class="highestAlertSeverity === 'critical' ? 'bg-white text-error' : 'bg-warning text-slate-900'"
        >
          {{ collisionRisks.length }}
        </span>
      </button>

      <!-- Action: Simulate Conflict Path (Interactive Testing) -->
      <button
        class="btn btn-xs rounded-sm px-2 gap-1 font-medium transition-all"
        :class="
          isSimulatingConflict
            ? 'btn-error btn-outline animate-pulse text-xs'
            : 'btn-ghost text-xs hover:bg-cyan-500/10 text-cyan-400'
        "
        :title="isSimulatingConflict ? '重設為正常巡檢' : '模擬兩架無人機航向交會碰撞預警'"
        @click="isSimulatingConflict ? emit('resetConflict') : emit('triggerConflict')"
      >
        <MaterialIcon :name="isSimulatingConflict ? 'restart_alt' : 'crisis_alert'" :size="14" />
        <span class="text-[11px]">{{ isSimulatingConflict ? '還原巡檢' : '模擬碰撞' }}</span>
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
      class="w-72 sm:w-84 rounded-md bg-base-100/98 backdrop-blur-md border border-cyan-500/40 shadow-2xl p-2.5 space-y-2 animate-in fade-in duration-100 z-50"
    >
      <div class="flex items-center justify-between pb-1 border-b border-base-300">
        <span class="text-xs font-bold flex items-center gap-1.5 text-cyan-400">
          <MaterialIcon name="flight_takeoff" :size="15" />
          空域即時無人機任務清單
        </span>
        <button class="btn btn-xs btn-circle btn-ghost" @click="isSearchOpen = false">
          <MaterialIcon name="close" :size="13" />
        </button>
      </div>

      <!-- Search Input -->
      <label class="input input-xs input-bordered rounded-sm flex items-center gap-1.5 bg-base-200/50">
        <MaterialIcon name="search" :size="13" class="text-base-content/50" />
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
      <div class="max-h-64 overflow-y-auto space-y-1 pr-1">
        <button
          v-for="d in filteredList"
          :key="d.id"
          class="w-full flex items-center justify-between p-1.5 rounded-sm bg-base-200/50 hover:bg-cyan-950/40 hover:border-cyan-500/40 border border-transparent text-left text-xs transition-all cursor-pointer group"
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

    <!-- Collision Risk Alerts Popover -->
    <div
      v-if="isAlertsOpen"
      class="w-80 sm:w-96 rounded-md bg-base-100/98 backdrop-blur-md border border-warning/40 shadow-2xl p-3 space-y-2 animate-in fade-in duration-100 z-50"
    >
      <div class="flex items-center justify-between pb-1 border-b border-base-300">
        <span class="text-xs font-bold flex items-center gap-1.5 text-warning">
          <MaterialIcon name="crisis_alert" :size="15" />
          UTM 空域衝突與 CPA 碰撞預警
        </span>
        <button class="btn btn-xs btn-circle btn-ghost" @click="isAlertsOpen = false">
          <MaterialIcon name="close" :size="13" />
        </button>
      </div>

      <!-- No alerts state -->
      <div
        v-if="!collisionRisks || collisionRisks.length === 0"
        class="py-5 text-center text-xs text-base-content/60 space-y-1.5"
      >
        <div class="w-9 h-9 mx-auto rounded-full bg-success/20 text-success flex items-center justify-center">
          <MaterialIcon name="verified_user" :size="18" />
        </div>
        <div>全空域無碰撞風險（綠燈安全）</div>
        <div class="text-[11px] text-base-content/40">
          點擊上方「模擬碰撞」按鈕可立即體驗航向交叉碰撞預警
        </div>
      </div>

      <!-- Active Alerts List -->
      <div v-else class="space-y-1.5 max-h-72 overflow-y-auto pr-1">
        <div
          v-for="risk in collisionRisks"
          :key="risk.id"
          class="p-2 rounded-sm border text-xs transition-all space-y-1.5"
          :class="
            risk.severity === 'critical'
              ? 'bg-error/15 border-error/50 shadow-md shadow-error/20'
              : risk.severity === 'warning'
              ? 'bg-warning/15 border-warning/50'
              : 'bg-info/10 border-info/40'
          "
        >
          <!-- Conflict Header -->
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-1.5 font-bold">
              <span
                class="badge badge-xs"
                :class="
                  risk.severity === 'critical'
                    ? 'badge-error text-white font-bold'
                    : risk.severity === 'warning'
                    ? 'badge-warning text-slate-900 font-bold'
                    : 'badge-info text-white'
                "
              >
                {{ risk.severity === 'critical' ? '🔴 緊急衝突' : risk.severity === 'warning' ? '🟠 碰撞警戒' : '🟡 空域注意' }}
              </span>
              <span class="truncate">{{ risk.droneACallsign }} ↔ {{ risk.droneBCallsign }}</span>
            </div>
            <button
              class="btn btn-xs btn-outline btn-ghost text-[10px] px-1.5 h-6 min-h-0"
              title="聚焦衝突預測點"
              @click="
                emit('focusCollision', risk.cpaCoordinate);
                isAlertsOpen = false;
              "
            >
              <MaterialIcon name="my_location" :size="12" />
              定位
            </button>
          </div>

          <!-- Spatial CPA Stats Grid -->
          <div class="grid grid-cols-3 gap-1.5 bg-base-100/60 p-2 rounded-sm border border-base-content/10 font-mono text-[11px]">
            <div>
              <div class="text-[9px] text-base-content/60">目前距離</div>
              <div class="font-bold text-cyan-400">{{ risk.currentDistanceMeters }} m</div>
            </div>
            <div>
              <div class="text-[9px] text-base-content/60">預估 CPA 距離</div>
              <div
                class="font-bold"
                :class="risk.cpaDistanceMeters < 30 ? 'text-error font-extrabold' : 'text-warning'"
              >
                {{ risk.cpaDistanceMeters }} m
              </div>
            </div>
            <div>
              <div class="text-[9px] text-base-content/60">發生時間</div>
              <div class="font-bold text-amber-300">{{ risk.timeToCpaSeconds }} 秒後</div>
            </div>
          </div>

          <!-- Suggested Advisory Action -->
          <div class="text-[11px] leading-relaxed text-base-content/90 font-sans">
            {{ risk.advisoryText }}
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
