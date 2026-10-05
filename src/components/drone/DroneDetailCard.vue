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

const showAttitude = ref(true)

const isAltitudeLegal = computed(() => {
  return (props.drone?.altitudeAglMeters || 0) <= 120
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
</script>

<template>
  <div v-if="drone" class="relative group select-none">
    <!-- Tactical HUD Leader Line connecting directly to drone center -->
    <div class="absolute -bottom-6 -left-7 w-7 h-6 pointer-events-none overflow-visible z-0">
      <svg class="w-full h-full overflow-visible" viewBox="0 0 28 24">
        <!-- Connector leader line from drone (0, 24) to card corner (28, 0) -->
        <path
          d="M 0 24 L 14 12 L 28 0"
          fill="none"
          stroke="#06b6d4"
          stroke-width="1.5"
          stroke-dasharray="3 2"
        />
        <!-- Target reticle dot on drone -->
        <circle cx="0" cy="24" r="3" fill="#0891b2" stroke="#06b6d4" stroke-width="1.5" />
        <circle cx="0" cy="24" r="6.5" fill="none" stroke="#06b6d4" stroke-width="1" stroke-dasharray="2 2" opacity="0.6" />
        <!-- Anchor dot at card corner -->
        <circle cx="28" cy="0" r="2.5" fill="#06b6d4" />
      </svg>
    </div>

    <!-- Main Card Body -->
    <div
      class="w-80 sm:w-88 rounded-md bg-slate-900/95 backdrop-blur-xl border border-cyan-500/50 shadow-2xl shadow-cyan-950/60 overflow-hidden text-slate-100 transition-all duration-150"
    >
      <!-- Header with drone callsign & Remote ID -->
      <div
        class="px-3.5 py-2.5 flex items-center justify-between text-white relative overflow-hidden border-b border-cyan-500/30"
        style="background: linear-gradient(135deg, #0e7490, #0f172a 90%)"
      >
        <div class="flex items-center gap-2.5 relative z-10 min-w-0">
          <div class="w-8 h-8 rounded-sm bg-cyan-400/20 backdrop-blur-md flex items-center justify-center shrink-0 border border-cyan-400/30">
            <MaterialIcon name="toys" :size="20" class="text-cyan-300" />
          </div>
          <div class="min-w-0">
            <div class="flex items-center gap-2">
              <h3 class="font-extrabold text-lg tracking-wider leading-none truncate text-cyan-200">
                {{ drone.callsign }}
              </h3>
              <span class="badge badge-sm rounded-sm bg-cyan-500/30 text-cyan-200 border border-cyan-400/40 font-mono text-xs shrink-0">
                {{ drone.remoteId }}
              </span>
            </div>
            <p class="text-sm text-slate-300 mt-1 truncate">
              {{ drone.model }} · <span class="text-cyan-300/80">{{ drone.operator }}</span>
            </p>
          </div>
        </div>

        <button
          class="btn btn-sm btn-square rounded-sm btn-ghost text-white/80 hover:text-white hover:bg-white/20 z-10 shrink-0 ml-1"
          title="關閉"
          @click="emit('close')"
        >
          <MaterialIcon name="close" :size="18" />
        </button>
      </div>

      <!-- Mission Banner & Attitude Display Toggle -->
      <div class="px-4 py-2.5 bg-slate-800/80 border-b border-slate-700/60 flex items-center justify-between text-sm">
        <div class="flex items-center gap-2 truncate">
          <MaterialIcon name="assignment" :size="18" class="text-cyan-400 shrink-0" />
          <span class="text-slate-300 font-medium text-sm truncate">{{ drone.missionType }}</span>
        </div>
        <div class="flex items-center gap-2">
          <button
            class="btn btn-sm rounded-sm px-2.5 h-8 min-h-0 font-medium text-sm transition-all"
            :class="showAttitude ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40' : 'btn-ghost text-slate-400'"
            title="開關姿態水平儀"
            @click="showAttitude = !showAttitude"
          >
            <MaterialIcon name="explore" :size="16" />
            <span>姿態儀</span>
          </button>
          <div class="badge badge-md rounded-sm px-2.5 py-1 font-semibold text-sm shrink-0" :class="drone.status === '定點懸停' ? 'badge-warning' : 'badge-accent'">
            {{ drone.status }}
          </div>
        </div>
      </div>

      <!-- Drone Flight Attitude Indicator (ADI / Artificial Horizon HUD) -->
      <div
        v-if="showAttitude"
        class="p-3.5 bg-slate-950/80 border-b border-slate-800 flex items-center justify-around gap-3.5"
      >
        <DroneAttitudeIndicator
          :pitch-deg="drone.pitchDeg ?? 0"
          :roll-deg="drone.rollDeg ?? 0"
          :yaw-deg="drone.yawDeg ?? drone.heading"
          :size="130"
        />

        <!-- Attitude Telemetry Pitch / Roll / Vertical Rate Data Readout -->
        <div class="flex flex-col gap-2 font-mono min-w-0 flex-1 text-sm">
          <div class="flex items-center justify-between px-3 py-1.5 rounded-sm bg-slate-800/80 border border-slate-700/70">
            <span class="text-slate-400 text-sm">俯仰 (Pitch)</span>
            <span
              class="font-bold text-base"
              :class="(drone.pitchDeg || 0) < -15 ? 'text-amber-400' : 'text-cyan-300'"
            >
              {{ (drone.pitchDeg || 0) > 0 ? '+' : '' }}{{ (drone.pitchDeg || 0).toFixed(1) }}°
            </span>
          </div>

          <div class="flex items-center justify-between px-3 py-1.5 rounded-sm bg-slate-800/80 border border-slate-700/70">
            <span class="text-slate-400 text-sm">橫滾 (Roll)</span>
            <span
              class="font-bold text-base"
              :class="Math.abs(drone.rollDeg || 0) > 20 ? 'text-amber-400' : 'text-cyan-300'"
            >
              {{ (drone.rollDeg || 0) > 0 ? '+' : '' }}{{ (drone.rollDeg || 0).toFixed(1) }}°
            </span>
          </div>

          <div class="flex items-center justify-between px-3 py-1.5 rounded-sm bg-slate-800/80 border border-slate-700/70">
            <span class="text-slate-400 text-sm">爬升率 (V/S)</span>
            <span class="font-bold text-base text-slate-200">
              {{ (drone.verticalRateMps || 0) > 0 ? '+' : '' }}{{ (drone.verticalRateMps || 0).toFixed(1) }} m/s
            </span>
          </div>
        </div>
      </div>

      <!-- Quick Telemetry Grid (2x2) -->
      <div class="p-3.5 space-y-2.5 text-sm bg-slate-900/60">
        <div class="grid grid-cols-2 gap-2.5">
          <!-- Altitude AGL (Against 120m Legal Limit) -->
          <div class="p-2.5 rounded-sm bg-slate-800/80 border border-slate-700/70">
            <div class="text-slate-400 flex items-center justify-between text-sm mb-1">
              <div class="flex items-center gap-1.5">
                <MaterialIcon name="height" :size="16" class="text-cyan-400" />
                <span>對地高度 (AGL)</span>
              </div>
              <span
                class="badge badge-sm rounded-sm text-xs font-bold border-none"
                :class="isAltitudeLegal ? 'bg-emerald-500/20 text-emerald-300' : 'bg-amber-500/20 text-amber-300'"
              >
                {{ isAltitudeLegal ? '≤120m 合規' : '超高警戒' }}
              </span>
            </div>
            <div class="font-bold text-lg font-mono text-slate-100">
              {{ drone.altitudeAglMeters }} <span class="text-sm font-normal text-slate-400">m</span>
              <span class="text-sm text-slate-400 ml-1">({{ drone.altitudeAglFeet }} ft)</span>
            </div>
          </div>

          <!-- Speed -->
          <div class="p-2.5 rounded-sm bg-slate-800/80 border border-slate-700/70">
            <div class="text-slate-400 flex items-center gap-1.5 text-sm mb-1">
              <MaterialIcon name="speed" :size="16" class="text-amber-400" />
              <span>飛行速度</span>
            </div>
            <div class="font-bold text-lg font-mono text-slate-100">
              {{ drone.speedKmh }} <span class="text-sm font-normal text-slate-400">km/h</span>
            </div>
          </div>

          <!-- Heading -->
          <div class="p-2.5 rounded-sm bg-slate-800/80 border border-slate-700/70">
            <div class="text-slate-400 flex items-center gap-1.5 text-sm mb-1">
              <MaterialIcon name="navigation" :size="16" class="text-sky-400" />
              <span>航向</span>
            </div>
            <div class="font-bold text-lg font-mono flex items-center gap-1 text-slate-100">
              <span>{{ drone.heading }}°</span>
              <span
                class="inline-block transform transition-transform text-cyan-400 font-bold"
                :style="{ transform: `rotate(${drone.heading}deg)` }"
              >
                ↑
              </span>
            </div>
          </div>

          <!-- Battery Level with progress bar -->
          <div class="p-2.5 rounded-sm bg-slate-800/80 border border-slate-700/70">
            <div class="text-slate-400 flex items-center justify-between text-sm mb-1">
              <div class="flex items-center gap-1.5">
                <MaterialIcon name="battery_charging_full" :size="16" :class="batteryColor" />
                <span>剩餘電量</span>
              </div>
              <span class="font-mono font-bold text-base" :class="batteryColor">{{ drone.batteryPercent }}%</span>
            </div>
            <div class="w-full bg-slate-700 h-2 rounded-sm overflow-hidden mt-1.5">
              <div
                class="h-full transition-all duration-300 rounded-sm"
                :class="batteryBg"
                :style="{ width: `${drone.batteryPercent}%` }"
              ></div>
            </div>
          </div>
        </div>

        <!-- Coordinates, Comm Link & GNSS Satellites -->
        <div class="flex items-center justify-between px-3 py-2 rounded-sm bg-slate-800/60 text-sm font-mono text-slate-300 border border-slate-700/60">
          <div>
            <span>{{ drone.latitude.toFixed(4) }}°N</span>
            <span class="ml-2">{{ drone.longitude.toFixed(4) }}°E</span>
          </div>
          <div class="flex items-center gap-2.5">
            <span class="flex items-center gap-1 text-emerald-400">
              <MaterialIcon name="wifi" :size="14" />
              <span>{{ drone.linkQuality }}%</span>
            </span>
            <span class="text-slate-500">·</span>
            <span class="flex items-center gap-1 text-cyan-300">
              <MaterialIcon name="satellite_alt" :size="14" />
              <span>{{ drone.satellites }} 星</span>
            </span>
          </div>
        </div>

        <!-- Action: Follow Camera Toggle -->
        <div>
          <button
            class="btn btn-sm rounded-sm w-full gap-2 font-medium text-sm transition-all"
            :class="isFollowing ? 'btn-accent shadow-md shadow-accent/30' : 'bg-slate-800 hover:bg-slate-700 border-slate-600 text-slate-200'"
            @click="emit('toggleFollow')"
          >
            <MaterialIcon :name="isFollowing ? 'videocam' : 'videocam_off'" :size="18" />
            <span>{{ isFollowing ? '無人機視角鎖定中（點擊解除）' : '鎖定鏡頭跟隨無人機' }}</span>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
