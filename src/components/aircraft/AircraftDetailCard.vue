<script setup lang="ts">
import { computed } from 'vue'
import MaterialIcon from '../MaterialIcon.vue'
import type { AircraftInfo } from '../../services/aircraft/types'
import { getAltitudeColor } from '../../services/aircraft/aircraftIcons'

const props = defineProps<{
  aircraft: AircraftInfo | null
  isFollowing: boolean
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'toggleFollow'): void
}>()

const altColor = computed(() => {
  if (!props.aircraft) return '#3b82f6'
  return getAltitudeColor(props.aircraft.altitude, props.aircraft.isGround)
})

const speedKmh = computed(() => {
  if (!props.aircraft?.speed) return 0
  return Math.round(props.aircraft.speed * 1.852)
})

const verticalRateText = computed(() => {
  const rate = props.aircraft?.verticalRate || 0
  if (Math.abs(rate) < 64) return '平飛巡航 (Level)'
  return rate > 0 ? `爬升中 +${rate} ft/min` : `下降中 ${rate} ft/min`
})

const verticalIcon = computed(() => {
  const rate = props.aircraft?.verticalRate || 0
  if (Math.abs(rate) < 64) return 'trending_flat'
  return rate > 0 ? 'trending_up' : 'trending_down'
})
</script>

<template>
  <div
    v-if="aircraft"
    class="w-80 sm:w-96 rounded-3xl bg-base-100/90 backdrop-blur-xl border border-base-300 shadow-2xl overflow-hidden text-base-content select-none animate-in fade-in slide-in-from-bottom-4 duration-200"
  >
    <!-- Header with flight callsign -->
    <div
      class="px-5 py-4 flex items-center justify-between text-white relative overflow-hidden"
      :style="{ background: `linear-gradient(135deg, ${altColor}, #0f172a)` }"
    >
      <div class="flex items-center gap-3 relative z-10">
        <div class="w-10 h-10 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center font-black">
          <MaterialIcon name="flight" :size="24" />
        </div>
        <div>
          <div class="flex items-center gap-2">
            <h3 class="font-extrabold text-xl tracking-wider leading-none">
              {{ aircraft.flight || 'UNKNOWN' }}
            </h3>
            <span class="badge badge-xs bg-white/20 text-white font-mono border-none">
              {{ aircraft.hex.toUpperCase() }}
            </span>
          </div>
          <p class="text-xs text-white/80 mt-1 font-mono">
            {{ aircraft.model }} · {{ aircraft.registration }}
          </p>
        </div>
      </div>

      <button
        class="btn btn-sm btn-circle btn-ghost text-white/80 hover:text-white hover:bg-white/20 z-10"
        title="關閉"
        @click="emit('close')"
      >
        <MaterialIcon name="close" :size="20" />
      </button>
    </div>

    <!-- Data Grid -->
    <div class="p-5 space-y-4">
      <div class="grid grid-cols-2 gap-3 text-xs">
        <!-- Altitude -->
        <div class="p-3 rounded-2xl bg-base-200/60 border border-base-300">
          <div class="text-base-content/60 flex items-center gap-1 mb-1">
            <MaterialIcon name="height" :size="16" class="text-primary" />
            <span>高度 (Altitude)</span>
          </div>
          <div class="font-bold text-lg font-mono text-base-content">
            <span v-if="aircraft.isGround" class="text-success">地面滑行</span>
            <span v-else>{{ aircraft.altitude.toLocaleString() }} <span class="text-xs font-normal">ft</span></span>
          </div>
        </div>

        <!-- Speed -->
        <div class="p-3 rounded-2xl bg-base-200/60 border border-base-300">
          <div class="text-base-content/60 flex items-center gap-1 mb-1">
            <MaterialIcon name="speed" :size="16" class="text-secondary" />
            <span>地速 (Ground Speed)</span>
          </div>
          <div class="font-bold text-lg font-mono text-base-content">
            {{ aircraft.speed }} <span class="text-xs font-normal">kts</span>
            <span class="text-[11px] text-base-content/50 block font-normal">{{ speedKmh }} km/h</span>
          </div>
        </div>

        <!-- Heading & Direction -->
        <div class="p-3 rounded-2xl bg-base-200/60 border border-base-300">
          <div class="text-base-content/60 flex items-center gap-1 mb-1">
            <MaterialIcon name="navigation" :size="16" class="text-accent" />
            <span>航向 (Track)</span>
          </div>
          <div class="font-bold text-sm font-mono flex items-center gap-1 text-base-content">
            <span>{{ aircraft.heading.toFixed(1) }}°</span>
            <span
              class="inline-block transform transition-transform"
              :style="{ transform: `rotate(${aircraft.heading}deg)` }"
            >
              ↑
            </span>
          </div>
        </div>

        <!-- Vertical Rate -->
        <div class="p-3 rounded-2xl bg-base-200/60 border border-base-300">
          <div class="text-base-content/60 flex items-center gap-1 mb-1">
            <MaterialIcon :name="verticalIcon" :size="16" :class="aircraft.verticalRate >= 0 ? 'text-success' : 'text-warning'" />
            <span>升降率</span>
          </div>
          <div class="font-semibold text-xs text-base-content leading-tight">
            {{ verticalRateText }}
          </div>
        </div>
      </div>

      <!-- Coordinates & Squawk -->
      <div class="flex items-center justify-between px-3 py-2 rounded-xl bg-base-200/40 text-[11px] font-mono text-base-content/70 border border-base-300">
        <div>
          <span>Lat: {{ aircraft.latitude.toFixed(4) }}°</span>
          <span class="ml-2">Lon: {{ aircraft.longitude.toFixed(4) }}°</span>
        </div>
        <div>
          <span>Squawk: {{ aircraft.squawk }}</span>
        </div>
      </div>

      <!-- Route & Heading Status -->
      <div class="flex items-center justify-between px-3 py-2 rounded-xl bg-primary/10 border border-primary/20 text-xs">
        <div class="flex items-center gap-1.5 text-primary font-semibold">
          <MaterialIcon name="route" :size="16" />
          <span>動態航線與前瞻預測已啟用</span>
        </div>
        <span class="text-[11px] font-mono text-base-content/70">
          {{ aircraft.trail.length }} 個航跡點
        </span>
      </div>

      <!-- Action Buttons -->
      <div class="flex gap-2">
        <button
          class="btn btn-sm flex-1 gap-1.5 transition-all"
          :class="isFollowing ? 'btn-primary shadow-lg shadow-primary/30' : 'btn-outline'"
          @click="emit('toggleFollow')"
        >
          <MaterialIcon :name="isFollowing ? 'videocam' : 'videocam_off'" :size="18" />
          <span>{{ isFollowing ? '取消鎖定視角' : '鏡頭跟隨飛機' }}</span>
        </button>
      </div>
    </div>
  </div>
</template>
