<script setup lang="ts">
import { computed } from 'vue'
import MaterialIcon from '../MaterialIcon.vue'
import type { CollisionRisk } from '../../services/drone/collisionTypes'

const props = defineProps<{
  collisionRisks: CollisionRisk[]
}>()

const emit = defineEmits<{
  (e: 'focusCollision', coordinate: [number, number]): void
}>()

// Most critical active collision risk
const primaryRisk = computed(() => {
  if (!props.collisionRisks || props.collisionRisks.length === 0) return null
  // Sort critical first, then smallest timeToCpa
  return [...props.collisionRisks].sort((a, b) => {
    const rank = { critical: 3, warning: 2, advisory: 1, clear: 0 }
    if (rank[b.severity] !== rank[a.severity]) {
      return rank[b.severity] - rank[a.severity]
    }
    return a.timeToCpaSeconds - b.timeToCpaSeconds
  })[0]
})

const isCritical = computed(() => primaryRisk.value?.severity === 'critical')
const isWarning = computed(() => primaryRisk.value?.severity === 'warning')
</script>

<template>
  <transition
    enter-active-class="transition duration-300 ease-out"
    enter-from-class="opacity-0 -translate-y-4 scale-95"
    enter-to-class="opacity-100 translate-y-0 scale-100"
    leave-active-class="transition duration-200 ease-in"
    leave-from-class="opacity-100 translate-y-0 scale-100"
    leave-to-class="opacity-0 -translate-y-4 scale-95"
  >
    <div
      v-if="primaryRisk"
      class="pointer-events-auto max-w-xl w-full mx-auto select-none"
    >
      <div
        class="rounded-2xl p-3 sm:p-3.5 backdrop-blur-2xl shadow-2xl border flex flex-col gap-2 transition-all duration-200"
        :class="
          isCritical
            ? 'bg-rose-950/90 border-rose-500/80 shadow-rose-950/70 text-rose-50 ring-2 ring-rose-500/40 animate-pulse'
            : isWarning
            ? 'bg-amber-950/90 border-amber-500/80 shadow-amber-950/60 text-amber-50'
            : 'bg-slate-900/90 border-yellow-500/50 text-yellow-50'
        "
      >
        <!-- Top bar: Header & Live Countdown Badge -->
        <div class="flex items-center justify-between gap-3">
          <div class="flex items-center gap-2 min-w-0">
            <div
              class="w-7 h-7 rounded-xl flex items-center justify-center flex-shrink-0"
              :class="isCritical ? 'bg-rose-500 text-white' : 'bg-amber-500 text-amber-950'"
            >
              <MaterialIcon :name="isCritical ? 'report' : 'warning'" :size="18" />
            </div>
            <div class="min-w-0">
              <div class="flex items-center gap-2">
                <span
                  class="font-black text-xs uppercase tracking-wider px-2 py-0.5 rounded-full"
                  :class="isCritical ? 'bg-rose-500/40 text-rose-200' : 'bg-amber-500/30 text-amber-200'"
                >
                  {{ isCritical ? '🔴 空域緊急碰撞預警 (CRITICAL CPA)' : '🟠 空域衝突接近警戒' }}
                </span>
                <span class="text-[11px] opacity-75 hidden sm:inline">
                  {{ collisionRisks.length > 1 ? `共 ${collisionRisks.length} 起預警` : '' }}
                </span>
              </div>
              <div class="font-bold text-sm truncate mt-0.5">
                {{ primaryRisk.droneACallsign }} ⚡ {{ primaryRisk.droneBCallsign }}
              </div>
            </div>
          </div>

          <!-- Countdown & Distance Big Indicators -->
          <div class="flex items-center gap-2 flex-shrink-0">
            <!-- CPA Countdown Badge -->
            <div
              class="px-2.5 py-1 rounded-xl text-center font-mono"
              :class="isCritical ? 'bg-rose-500 text-white' : 'bg-amber-500 text-amber-950'"
            >
              <div class="text-[9px] uppercase font-bold opacity-80">預估交會</div>
              <div class="text-sm font-black leading-tight">{{ primaryRisk.timeToCpaSeconds }}s</div>
            </div>

            <!-- CPA Distance Badge -->
            <div class="px-2.5 py-1 rounded-xl bg-black/40 text-center font-mono border border-white/10">
              <div class="text-[9px] uppercase opacity-70">最近距離</div>
              <div class="text-sm font-black text-cyan-300 leading-tight">{{ primaryRisk.cpaDistanceMeters }}m</div>
            </div>

            <!-- Focus Button -->
            <button
              class="btn btn-sm btn-circle bg-white/10 hover:bg-white/20 border-white/20 text-white"
              title="立即定位衝突交會空域"
              @click="emit('focusCollision', primaryRisk.cpaCoordinate)"
            >
              <MaterialIcon name="my_location" :size="18" />
            </button>
          </div>
        </div>

        <!-- Bottom bar: Real-time Recommended Maneuver / Advisory Action -->
        <div class="flex items-center justify-between gap-2 pt-1 border-t border-white/10 text-xs">
          <div class="flex items-center gap-1.5 opacity-90 truncate">
            <MaterialIcon name="shield" :size="14" class="text-emerald-400 flex-shrink-0" />
            <span class="truncate font-medium">{{ primaryRisk.advisoryText }}</span>
          </div>
          <div class="text-[10px] font-mono opacity-60 flex-shrink-0">
            間距: {{ primaryRisk.currentDistanceMeters }}m | 高度差: {{ primaryRisk.altitudeDiffMeters }}m
          </div>
        </div>
      </div>
    </div>
  </transition>
</template>
