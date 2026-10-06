<script setup lang="ts">
import { ref, computed } from 'vue'
import MaterialIcon from '../MaterialIcon.vue'
import DroneAttitudeIndicator from './DroneAttitudeIndicator.vue'
import type { DroneInfo } from '../../services/drone/types'

const props = defineProps<{
  drone: DroneInfo | null
  isFollowing: boolean
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'toggleFollow'): void
}>()

const showAttitude = ref(false)
const isCollapsed = ref(true)

function toggleCollapse() {
  isCollapsed.value = !isCollapsed.value
}

const isAltitudeLegal = computed(() => {
  const maxLegal = props.drone?.maxLegalAltitudeMeters || (props.drone?.airspaceZone === 'yellow' ? 60 : 120)
  return (props.drone?.altitudeAglMeters || 0) <= maxLegal
})

const batteryColor = computed(() => {
  const p = props.drone?.batteryPercent || 0
  if (p > 50) return 'text-emerald-400'
  if (p > 25) return 'text-amber-400'
  return 'text-rose-500'
})

const batteryBg = computed(() => {
  const p = props.drone?.batteryPercent || 0
  if (p > 50) return 'bg-emerald-500'
  if (p > 25) return 'bg-amber-500'
  return 'bg-rose-500'
})

const compassDirection = computed(() => {
  const deg = props.drone?.heading || 0
  const dirs = ['北 (N)', '東北 (NE)', '東 (E)', '東南 (SE)', '南 (S)', '西南 (SW)', '西 (W)', '西北 (NW)']
  const idx = Math.round((deg % 360) / 45) % 8
  return dirs[idx]
})
</script>

<template>
  <div v-if="drone" class="relative group select-none">
    <!-- Tactical HUD Leader Line connecting directly to drone center -->
    <div class="absolute -bottom-6 -left-7 w-7 h-6 pointer-events-none overflow-visible z-0">
      <svg class="w-full h-full overflow-visible" viewBox="0 0 28 24">
        <path
          d="M 0 24 L 14 12 L 28 0"
          fill="none"
          stroke="#06b6d4"
          stroke-width="1.5"
          stroke-dasharray="3 2"
        />
        <circle cx="0" cy="24" r="3" fill="#0891b2" stroke="#06b6d4" stroke-width="1.5" />
        <circle cx="0" cy="24" r="6.5" fill="none" stroke="#06b6d4" stroke-width="1" stroke-dasharray="2 2" opacity="0.6" />
        <circle cx="28" cy="0" r="2.5" fill="#06b6d4" />
      </svg>
    </div>

    <!-- Main Card Body: Stable Width (370px) to prevent layout shift and wrapping jitter -->
    <div
      class="w-[370px] max-w-[calc(100vw-2rem)] rounded-xl bg-slate-900/95 backdrop-blur-2xl border border-cyan-500/50 shadow-2xl shadow-cyan-950/70 overflow-hidden text-slate-100 transition-all duration-150"
    >
      <!-- Header with drone callsign & Remote ID -->
      <div
        class="px-4 py-3 flex items-center justify-between text-white relative overflow-hidden border-b border-cyan-500/30"
        style="background: linear-gradient(135deg, #0e7490, #0f172a 90%)"
      >
        <div class="flex items-center gap-2.5 relative z-10 min-w-0">
          <div class="w-9 h-9 rounded-lg bg-cyan-400/20 backdrop-blur-md flex items-center justify-center shrink-0 border border-cyan-400/30 shadow-inner">
            <MaterialIcon name="toys" :size="20" class="text-cyan-300" />
          </div>
          <div class="min-w-0">
            <div class="flex items-center gap-2">
              <h3 class="font-black text-lg tracking-wider leading-none truncate text-cyan-200">
                {{ drone.callsign }}
              </h3>
              <span class="badge badge-sm rounded bg-cyan-500/30 text-cyan-200 border border-cyan-400/40 font-mono text-[11px] shrink-0 whitespace-nowrap">
                {{ drone.remoteId }}
              </span>
            </div>
            <p class="text-xs text-slate-300 mt-1 truncate" :title="`${drone.model} · ${drone.operator}`">
              {{ drone.model }} · <span class="text-cyan-300/80">{{ drone.operator }}</span>
            </p>
          </div>
        </div>

        <div class="flex items-center gap-0.5 z-10 shrink-0 ml-1">
          <button
            class="btn btn-sm btn-circle btn-ghost text-white/80 hover:text-white hover:bg-white/20"
            :title="isCollapsed ? '展開詳細儀表資訊' : '縮小為精簡狀態列'"
            @click="toggleCollapse"
          >
            <MaterialIcon :name="isCollapsed ? 'expand_more' : 'expand_less'" :size="18" />
          </button>
          <button
            class="btn btn-sm btn-circle btn-ghost text-white/80 hover:text-white hover:bg-white/20"
            title="關閉"
            @click="emit('close')"
          >
            <MaterialIcon name="close" :size="18" />
          </button>
        </div>
      </div>

      <!-- Compact Mode Bar (Shown only when collapsed): Minimal footprint so map is not obscured -->
      <div
        v-if="isCollapsed"
        class="px-3 py-1.5 bg-slate-900/90 flex items-center justify-between text-xs font-mono text-slate-300 border-t border-cyan-500/20 cursor-pointer hover:bg-slate-800/80 transition-colors"
        @click="toggleCollapse"
      >
        <div class="flex items-center gap-3">
          <span class="flex items-center gap-1">
            <span class="text-cyan-400 font-bold">ALT</span>
            <span class="text-white">{{ drone.altitudeAglMeters }}m</span>
          </span>
          <span class="flex items-center gap-1">
            <span class="text-amber-400 font-bold">SPD</span>
            <span class="text-white">{{ drone.speedKmh }}km/h</span>
          </span>
          <span class="flex items-center gap-1">
            <span class="text-emerald-400 font-bold">BAT</span>
            <span :class="batteryColor">{{ drone.batteryPercent }}%</span>
          </span>
        </div>
        <div class="flex items-center gap-1 text-[11px] text-cyan-400/80">
          <span>展開</span>
          <MaterialIcon name="unfold_more" :size="14" />
        </div>
      </div>

      <!-- Full Body: Collapsible container -->
      <div v-show="!isCollapsed">
        <!-- Mission Banner & Attitude Display Toggle -->
        <div class="px-3.5 py-2 bg-slate-800/80 border-b border-slate-700/60 flex items-center justify-between text-xs gap-2">
        <div class="flex items-center gap-1.5 min-w-0 flex-1">
          <MaterialIcon name="assignment" :size="16" class="text-cyan-400 shrink-0" />
          <span class="text-slate-300 font-medium truncate" :title="drone.missionType">{{ drone.missionType }}</span>
        </div>
        <div class="flex items-center gap-1.5 shrink-0">
          <button
            class="btn btn-xs rounded px-2 h-7 font-medium text-xs transition-all gap-1"
            :class="showAttitude ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40' : 'btn-ghost text-slate-400'"
            title="開關姿態水平儀"
            @click="showAttitude = !showAttitude"
          >
            <MaterialIcon name="explore" :size="14" />
            <span>姿態儀</span>
          </button>
          <div
            class="badge badge-sm rounded px-2 py-0.5 font-bold text-[11px] shrink-0 whitespace-nowrap"
            :class="drone.status === '定點懸停' ? 'badge-warning' : 'badge-accent'"
          >
            {{ drone.status }}
          </div>
        </div>
      </div>

      <!-- Drone Flight Attitude Indicator (ADI / Artificial Horizon HUD) -->
      <div
        v-if="showAttitude"
        class="p-3 bg-slate-950/85 border-b border-slate-800 flex items-center justify-around gap-3"
      >
        <DroneAttitudeIndicator
          :pitch-deg="drone.pitchDeg ?? 0"
          :roll-deg="drone.rollDeg ?? 0"
          :yaw-deg="drone.yawDeg ?? drone.heading"
          :size="124"
        />

        <!-- Attitude Telemetry Pitch / Roll / Vertical Rate Data Readout with Tabular Numerals -->
        <div class="flex flex-col gap-1.5 font-mono min-w-0 flex-1 text-xs">
          <div class="flex items-center justify-between px-2.5 py-1.5 rounded bg-slate-800/80 border border-slate-700/70">
            <span class="text-slate-400 text-xs whitespace-nowrap">俯仰 (Pitch)</span>
            <span
              class="font-black text-sm tabular-nums"
              :class="(drone.pitchDeg || 0) < -15 ? 'text-amber-400' : 'text-cyan-300'"
            >
              {{ (drone.pitchDeg || 0) > 0 ? '+' : '' }}{{ (drone.pitchDeg || 0).toFixed(1) }}°
            </span>
          </div>

          <div class="flex items-center justify-between px-2.5 py-1.5 rounded bg-slate-800/80 border border-slate-700/70">
            <span class="text-slate-400 text-xs whitespace-nowrap">橫滾 (Roll)</span>
            <span
              class="font-black text-sm tabular-nums"
              :class="Math.abs(drone.rollDeg || 0) > 20 ? 'text-amber-400' : 'text-cyan-300'"
            >
              {{ (drone.rollDeg || 0) > 0 ? '+' : '' }}{{ (drone.rollDeg || 0).toFixed(1) }}°
            </span>
          </div>

          <div class="flex items-center justify-between px-2.5 py-1.5 rounded bg-slate-800/80 border border-slate-700/70">
            <span class="text-slate-400 text-xs whitespace-nowrap">爬升率 (V/S)</span>
            <span class="font-black text-sm text-slate-200 tabular-nums">
              {{ (drone.verticalRateMps || 0) > 0 ? '+' : '' }}{{ (drone.verticalRateMps || 0).toFixed(1) }} m/s
            </span>
          </div>
        </div>
      </div>

      <!-- Quick Telemetry Grid (2x2) with Strict Fixed Height to Prevent Jitter -->
      <div class="p-3.5 space-y-2.5 text-xs bg-slate-900/60">
        <!-- Airspace Zone Regulatory Banner -->
        <div
          v-if="drone.airspaceZone"
          class="flex items-center justify-between px-3 py-1.5 rounded-lg border text-xs"
          :class="drone.airspaceZone === 'yellow' ? 'bg-amber-950/40 border-amber-500/40 text-amber-200' : 'bg-emerald-950/40 border-emerald-500/40 text-emerald-200'"
        >
          <div class="flex items-center gap-1.5 font-bold whitespace-nowrap">
            <span class="w-2.5 h-2.5 rounded-full shrink-0" :class="drone.airspaceZone === 'yellow' ? 'bg-amber-400' : 'bg-emerald-400'"></span>
            <span>{{ drone.airspaceZone === 'yellow' ? '🟠 限航區 (法定上限 60m)' : '🟢 非管制空域 (法定上限 120m)' }}</span>
          </div>
          <span v-if="drone.zoneName" class="text-slate-300 font-mono text-xs font-bold shrink-0 ml-2 truncate">{{ drone.zoneName }}</span>
        </div>

        <div class="grid grid-cols-2 gap-2.5">
          <!-- 1. Altitude AGL Tile (Fixed Height, No Wrapping, Tabular Numerals) -->
          <div class="p-2.5 rounded-lg bg-slate-800/80 border border-slate-700/70 h-[86px] flex flex-col justify-between">
            <div class="flex items-center justify-between text-xs">
              <span class="text-slate-400 font-medium flex items-center gap-1 whitespace-nowrap">
                <MaterialIcon name="height" :size="15" class="text-cyan-400 shrink-0" />
                <span>對地高度</span>
              </span>
              <span
                class="badge badge-xs rounded text-[10px] font-bold border-none shrink-0 whitespace-nowrap px-1.5 py-0.5"
                :class="isAltitudeLegal ? 'bg-emerald-500/20 text-emerald-300' : 'bg-rose-500/20 text-rose-300'"
              >
                {{ isAltitudeLegal ? `≤${drone.maxLegalAltitudeMeters || (drone.airspaceZone === 'yellow' ? 60 : 120)}m` : '超高' }}
              </span>
            </div>
            <div class="flex items-baseline gap-1 font-mono font-black text-xl text-slate-100 whitespace-nowrap tabular-nums leading-none">
              {{ drone.altitudeAglMeters.toFixed(1) }}
              <span class="text-xs font-normal text-slate-400">m</span>
            </div>
            <div class="text-[11px] font-mono text-slate-400 whitespace-nowrap tabular-nums leading-none">
              約 {{ drone.altitudeAglFeet }} ft AGL
            </div>
          </div>

          <!-- 2. Speed Tile (Fixed Height, No Wrapping) -->
          <div class="p-2.5 rounded-lg bg-slate-800/80 border border-slate-700/70 h-[86px] flex flex-col justify-between">
            <div class="flex items-center justify-between text-xs">
              <span class="text-slate-400 font-medium flex items-center gap-1 whitespace-nowrap">
                <MaterialIcon name="speed" :size="15" class="text-amber-400 shrink-0" />
                <span>飛行速度</span>
              </span>
              <span class="text-[10px] font-mono text-amber-300/80 shrink-0 whitespace-nowrap">GPS地速</span>
            </div>
            <div class="flex items-baseline gap-1 font-mono font-black text-xl text-slate-100 whitespace-nowrap tabular-nums leading-none">
              {{ drone.speedKmh.toFixed(0) }}
              <span class="text-xs font-normal text-slate-400">km/h</span>
            </div>
            <div class="text-[11px] font-mono text-slate-400 whitespace-nowrap tabular-nums leading-none">
              約 {{ Math.round((drone.speedKmh * 1000) / 3600) }} m/s
            </div>
          </div>

          <!-- 3. Heading Tile (Fixed Height, No Wrapping) -->
          <div class="p-2.5 rounded-lg bg-slate-800/80 border border-slate-700/70 h-[86px] flex flex-col justify-between">
            <div class="flex items-center justify-between text-xs">
              <span class="text-slate-400 font-medium flex items-center gap-1 whitespace-nowrap">
                <MaterialIcon name="navigation" :size="15" class="text-sky-400 shrink-0" />
                <span>航向方位</span>
              </span>
              <span class="text-[10px] font-mono text-cyan-300/80 shrink-0 whitespace-nowrap">{{ compassDirection }}</span>
            </div>
            <div class="flex items-baseline gap-1 font-mono font-black text-xl text-slate-100 whitespace-nowrap tabular-nums leading-none">
              {{ drone.heading.toFixed(0) }}°
              <span
                class="inline-block transform transition-transform text-cyan-400 font-bold ml-1"
                :style="{ transform: `rotate(${drone.heading}deg)` }"
              >
                ↑
              </span>
            </div>
            <div class="text-[11px] font-mono text-slate-400 whitespace-nowrap leading-none">
              真實航向 True
            </div>
          </div>

          <!-- 4. Battery Tile (Fixed Height, No Wrapping) -->
          <div class="p-2.5 rounded-lg bg-slate-800/80 border border-slate-700/70 h-[86px] flex flex-col justify-between">
            <div class="flex items-center justify-between text-xs">
              <span class="text-slate-400 font-medium flex items-center gap-1 whitespace-nowrap">
                <MaterialIcon name="battery_charging_full" :size="15" :class="batteryColor" />
                <span>剩餘電量</span>
              </span>
              <span class="font-mono font-black text-sm tabular-nums whitespace-nowrap" :class="batteryColor">
                {{ drone.batteryPercent }}%
              </span>
            </div>
            <div class="w-full bg-slate-700/80 h-2 rounded-full overflow-hidden">
              <div
                class="h-full transition-all duration-300 rounded-full"
                :class="batteryBg"
                :style="{ width: `${drone.batteryPercent}%` }"
              ></div>
            </div>
            <div class="text-[11px] font-mono text-slate-400 whitespace-nowrap tabular-nums leading-none">
              預估續航 {{ Math.round(drone.batteryPercent * 0.32) }} 分鐘
            </div>
          </div>
        </div>

        <!-- Coordinates, Comm Link & GNSS Satellites (Tabular numbers, no jitter) -->
        <div class="flex items-center justify-between px-3 py-2 rounded-lg bg-slate-800/60 text-xs font-mono text-slate-300 border border-slate-700/60 whitespace-nowrap">
          <div class="tabular-nums">
            <span>{{ drone.latitude.toFixed(4) }}°N</span>
            <span class="ml-2">{{ drone.longitude.toFixed(4) }}°E</span>
          </div>
          <div class="flex items-center gap-2.5 tabular-nums">
            <span class="flex items-center gap-1 text-emerald-400">
              <MaterialIcon name="wifi" :size="13" />
              <span>{{ drone.linkQuality }}%</span>
            </span>
            <span class="text-slate-500">·</span>
            <span class="flex items-center gap-1 text-cyan-300">
              <MaterialIcon name="satellite_alt" :size="13" />
              <span>{{ drone.satellites }} 星</span>
            </span>
          </div>
        </div>

        <!-- Action: Follow Camera Toggle -->
        <div>
          <button
            class="btn btn-sm rounded-lg w-full gap-2 font-bold text-xs transition-all h-9"
            :class="isFollowing ? 'btn-accent shadow-md shadow-accent/30' : 'bg-slate-800 hover:bg-slate-700 border-slate-600 text-slate-200'"
            @click="emit('toggleFollow')"
          >
            <MaterialIcon :name="isFollowing ? 'videocam' : 'videocam_off'" :size="16" />
            <span>{{ isFollowing ? '無人機視角鎖定中（點擊解除）' : '鎖定鏡頭跟隨無人機' }}</span>
          </button>
        </div>
      </div>
      </div>
    </div>
  </div>
</template>
