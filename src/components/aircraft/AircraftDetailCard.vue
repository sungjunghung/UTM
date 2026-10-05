<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import MaterialIcon from '../MaterialIcon.vue'
import type { AircraftInfo } from '../../services/aircraft/types'
import { getAltitudeColor } from '../../services/aircraft/aircraftIcons'
import {
  flightInfoService,
  type RouteInfo,
  type AircraftDetails,
} from '../../services/aircraft/flightInfoService'

const props = defineProps<{
  aircraft: AircraftInfo | null
  isFollowing: boolean
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'toggleFollow'): void
}>()

const altColor = computed(() => {
  if (!props.aircraft) return '#38bdf8'
  return getAltitudeColor(props.aircraft.altitude, props.aircraft.isGround)
})

const speedKmh = computed(() => {
  if (!props.aircraft?.speed) return 0
  return Math.round(props.aircraft.speed * 1.852)
})

const verticalRateText = computed(() => {
  const rate = props.aircraft?.verticalRate || 0
  if (Math.abs(rate) < 64) return '平飛巡航 (Level)'
  return rate > 0 ? `+${rate} ft/min` : `${rate} ft/min`
})

const verticalIcon = computed(() => {
  const rate = props.aircraft?.verticalRate || 0
  if (Math.abs(rate) < 64) return 'trending_flat'
  return rate > 0 ? 'trending_up' : 'trending_down'
})

const flightLevel = computed(() => {
  if (!props.aircraft || props.aircraft.isGround) return 'GND'
  return `FL${Math.round(props.aircraft.altitude / 100)}`
})

// Instant 0ms Airline Recognition
const airline = computed(() => {
  return flightInfoService.getAirline(props.aircraft?.flight || '')
})

// Asynchronous Route & Aircraft Details Resolution
const routeInfo = ref<RouteInfo | null>(null)
const aircraftDetails = ref<AircraftDetails | null>(null)
const isRouteLoading = ref(false)

watch(
  () => props.aircraft?.flight,
  async (newFlight) => {
    if (!newFlight) {
      routeInfo.value = null
      return
    }
    isRouteLoading.value = true
    try {
      routeInfo.value = await flightInfoService.getRoute(newFlight)
    } finally {
      isRouteLoading.value = false
    }
  },
  { immediate: true }
)

watch(
  () => props.aircraft?.hex,
  async (newHex) => {
    if (!newHex) {
      aircraftDetails.value = null
      return
    }
    aircraftDetails.value = await flightInfoService.getAircraftDetails(newHex)
  },
  { immediate: true }
)
</script>

<template>
  <div v-if="aircraft" class="relative group select-none">
    <!-- Tactical HUD Leader Line connecting directly to aircraft center -->
    <div class="absolute -bottom-6 -left-7 w-7 h-6 pointer-events-none overflow-visible z-0">
      <svg class="w-full h-full overflow-visible" viewBox="0 0 28 24">
        <!-- Connector leader line from plane (0, 24) to card corner (28, 0) -->
        <path
          d="M 0 24 L 14 12 L 28 0"
          fill="none"
          stroke="#38bdf8"
          stroke-width="1.5"
          stroke-dasharray="3 2"
        />
        <!-- Target reticle dot on aircraft -->
        <circle cx="0" cy="24" r="3" fill="#0284c7" stroke="#38bdf8" stroke-width="1.5" />
        <circle cx="0" cy="24" r="6.5" fill="none" stroke="#38bdf8" stroke-width="1" stroke-dasharray="2 2" opacity="0.6" />
        <!-- Anchor dot at card corner -->
        <circle cx="28" cy="0" r="2.5" fill="#38bdf8" />
      </svg>
    </div>

    <!-- Main Card Body -->
    <div
      class="w-80 sm:w-88 rounded-md bg-slate-900/95 backdrop-blur-xl border border-sky-500/50 shadow-2xl shadow-sky-950/60 overflow-hidden text-slate-100 transition-all duration-150"
    >
      <!-- Header with dynamic altitude gradient & flight callsign -->
      <div
        class="px-3.5 py-2.5 flex items-center justify-between text-white relative overflow-hidden border-b border-sky-500/30"
        :style="{ background: `linear-gradient(135deg, ${altColor}dd, #0f172a 90%)` }"
      >
        <div class="flex items-center gap-2.5 relative z-10 min-w-0">
          <div class="w-8 h-8 rounded-sm bg-white/20 backdrop-blur-md flex items-center justify-center shrink-0 border border-white/30">
            <MaterialIcon name="flight" :size="20" />
          </div>
          <div class="min-w-0">
            <div class="flex items-center gap-1.5">
              <h3 class="font-extrabold text-base tracking-wider leading-none truncate">
                {{ aircraft.flight || 'UNKNOWN' }}
              </h3>
              <span
                v-if="airline"
                class="badge badge-sm rounded-sm bg-sky-400/25 text-sky-200 border border-sky-400/30 font-medium shrink-0"
              >
                {{ airline.nameZh }}
              </span>
              <span class="badge badge-sm rounded-sm bg-white/20 text-white font-mono border border-white/30 shrink-0">
                {{ aircraft.hex.toUpperCase() }}
              </span>
            </div>
            <p class="text-xs text-white/80 mt-0.5 font-mono truncate">
              <span v-if="aircraftDetails?.fullType">{{ aircraftDetails.fullType }} · </span>
              <span v-else>{{ aircraft.model }} · </span>
              <span>{{ aircraft.registration }}</span>
              <span v-if="airline" class="text-white/60"> ({{ airline.nameEn }})</span>
            </p>
          </div>
        </div>

        <button
          class="btn btn-sm btn-square rounded-sm btn-ghost text-white/80 hover:text-white hover:bg-white/20 z-10 shrink-0 ml-1"
          title="關閉"
          @click="emit('close')"
        >
          <MaterialIcon name="close" :size="16" />
        </button>
      </div>

      <!-- Route Banner (Origin -> Destination) if resolved -->
      <div v-if="routeInfo" class="px-3.5 py-2 bg-slate-800/80 border-b border-slate-700/60">
        <div class="flex items-center justify-between">
          <!-- Departure Airport -->
          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-1">
              <span class="text-sm font-black font-mono text-sky-400 tracking-wider">
                {{ routeInfo.origin.iata }}
              </span>
              <span class="text-xs text-slate-400 font-mono">({{ routeInfo.origin.icao }})</span>
            </div>
            <div class="text-xs text-slate-200 font-medium truncate" :title="routeInfo.origin.name">
              {{ routeInfo.origin.city || routeInfo.origin.name }}
            </div>
          </div>

          <!-- Middle Flight Arrow -->
          <div class="px-2 flex flex-col items-center shrink-0">
            <MaterialIcon name="flight_takeoff" :size="16" class="text-sky-400" />
            <span class="text-xs font-mono text-slate-400">直飛</span>
          </div>

          <!-- Destination Airport -->
          <div class="flex-1 min-w-0 text-right">
            <div class="flex items-center justify-end gap-1">
              <span class="text-xs text-slate-400 font-mono">({{ routeInfo.destination.icao }})</span>
              <span class="text-sm font-black font-mono text-emerald-400 tracking-wider">
                {{ routeInfo.destination.iata }}
              </span>
            </div>
            <div class="text-xs text-slate-200 font-medium truncate" :title="routeInfo.destination.name">
              {{ routeInfo.destination.city || routeInfo.destination.name }}
            </div>
          </div>
        </div>
      </div>
      <!-- Route Loading Placeholder -->
      <div v-else-if="isRouteLoading" class="px-3.5 py-1.5 bg-slate-800/50 border-b border-slate-700/40 text-xs text-slate-400 flex items-center gap-1.5 animate-pulse">
        <MaterialIcon name="sync" :size="14" class="animate-spin text-sky-400" />
        <span>正在查詢全球航線庫起迄站...</span>
      </div>

      <!-- Quick Telemetry Grid (2x2) -->
      <div class="p-3 space-y-2 text-xs bg-slate-900/60">
        <div class="grid grid-cols-2 gap-2">
          <!-- Altitude -->
          <div class="p-2 rounded-sm bg-slate-800/80 border border-slate-700/70">
            <div class="text-slate-400 flex items-center justify-between text-xs mb-1">
              <div class="flex items-center gap-1">
                <MaterialIcon name="height" :size="14" class="text-sky-400" />
                <span>高度</span>
              </div>
              <span class="text-xs font-mono text-sky-400 font-bold">{{ flightLevel }}</span>
            </div>
            <div class="font-bold text-base font-mono text-slate-100">
              <span v-if="aircraft.isGround" class="text-emerald-400">地面滑行</span>
              <span v-else>{{ aircraft.altitude.toLocaleString() }} <span class="text-xs font-normal text-slate-400">ft</span></span>
            </div>
          </div>

          <!-- Speed -->
          <div class="p-2 rounded-sm bg-slate-800/80 border border-slate-700/70">
            <div class="text-slate-400 flex items-center justify-between text-xs mb-1">
              <div class="flex items-center gap-1">
                <MaterialIcon name="speed" :size="14" class="text-amber-400" />
                <span>地速</span>
              </div>
              <span class="text-xs font-mono text-slate-400">{{ speedKmh }} km/h</span>
            </div>
            <div class="font-bold text-base font-mono text-slate-100">
              {{ aircraft.speed }} <span class="text-xs font-normal text-slate-400">kts</span>
            </div>
          </div>

          <!-- Heading -->
          <div class="p-2 rounded-sm bg-slate-800/80 border border-slate-700/70">
            <div class="text-slate-400 flex items-center gap-1 text-xs mb-1">
              <MaterialIcon name="navigation" :size="14" class="text-cyan-400" />
              <span>航向</span>
            </div>
            <div class="font-bold text-base font-mono flex items-center gap-1 text-slate-100">
              <span>{{ aircraft.heading.toFixed(0) }}°</span>
              <span
                class="inline-block transform transition-transform text-cyan-400 font-bold"
                :style="{ transform: `rotate(${aircraft.heading}deg)` }"
              >
                ↑
              </span>
            </div>
          </div>

          <!-- Vertical Rate -->
          <div class="p-2 rounded-sm bg-slate-800/80 border border-slate-700/70">
            <div class="text-slate-400 flex items-center gap-1 text-xs mb-1">
              <MaterialIcon :name="verticalIcon" :size="14" :class="aircraft.verticalRate >= 0 ? 'text-emerald-400' : 'text-amber-400'" />
              <span>升降率</span>
            </div>
            <div class="font-semibold text-sm font-mono leading-tight" :class="aircraft.verticalRate >= 0 ? 'text-emerald-300' : 'text-amber-300'">
              {{ verticalRateText }}
            </div>
          </div>
        </div>

        <!-- Coordinates & Squawk -->
        <div class="flex items-center justify-between px-2.5 py-1.5 rounded-sm bg-slate-800/60 text-xs font-mono text-slate-300 border border-slate-700/60">
          <div>
            <span>{{ aircraft.latitude.toFixed(3) }}°N</span>
            <span class="ml-1.5">{{ aircraft.longitude.toFixed(3) }}°E</span>
          </div>
          <div class="flex items-center gap-2">
            <span>SQ: <strong class="text-sky-300">{{ aircraft.squawk }}</strong></span>
            <span class="text-slate-400">·</span>
            <span class="text-slate-400">{{ aircraft.trail.length }} 航跡點</span>
          </div>
        </div>

        <!-- Action: Follow Camera Toggle -->
        <div>
          <button
            class="btn btn-sm rounded-sm w-full gap-1.5 font-medium text-xs transition-all"
            :class="isFollowing ? 'btn-primary shadow-md shadow-primary/30' : 'bg-slate-800 hover:bg-slate-700 border-slate-600 text-slate-200'"
            @click="emit('toggleFollow')"
          >
            <MaterialIcon :name="isFollowing ? 'videocam' : 'videocam_off'" :size="16" />
            <span>{{ isFollowing ? '視角鎖定中（點擊解除）' : '鎖定鏡頭跟隨飛機' }}</span>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
