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

// Sorted collision risks: critical first, then closest timeToCpa
const sortedRisks = computed(() => {
  if (!props.collisionRisks || props.collisionRisks.length === 0) return []
  return [...props.collisionRisks].sort((a, b) => {
    const rank = { critical: 3, warning: 2, advisory: 1, clear: 0 }
    if (rank[b.severity] !== rank[a.severity]) {
      return rank[b.severity] - rank[a.severity]
    }
    return a.timeToCpaSeconds - b.timeToCpaSeconds
  })
})
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
      v-if="sortedRisks.length > 0"
      class="pointer-events-auto max-w-2xl w-full mx-auto select-none flex flex-col gap-1.5"
    >
      <div
        v-for="(risk, idx) in sortedRisks"
        :key="risk.id"
        class="rounded-md p-2 sm:p-2.5 backdrop-blur-2xl shadow-2xl border flex flex-col gap-1 transition-all duration-150"
        :class="
          risk.severity === 'critical'
            ? 'bg-rose-950/95 border-rose-500 shadow-rose-950/70 text-rose-50 ring-1 ring-rose-500/50 animate-pulse'
            : risk.severity === 'warning'
            ? 'bg-amber-950/95 border-amber-500 shadow-amber-950/60 text-amber-50'
            : 'bg-slate-900/95 border-yellow-500 text-yellow-50'
        "
      >
        <!-- Top bar: Alert index, header, drone pair & live countdown -->
        <div class="flex items-center justify-between gap-2.5">
          <div class="flex items-center gap-2 min-w-0">
            <div
              class="w-5 h-5 rounded-sm flex items-center justify-center flex-shrink-0"
              :class="risk.severity === 'critical' ? 'bg-rose-500 text-white' : 'bg-amber-500 text-amber-950'"
            >
              <MaterialIcon :name="risk.severity === 'critical' ? 'report' : 'warning'" :size="14" />
            </div>
            <div class="min-w-0">
              <div class="flex items-center gap-1.5">
                <span
                  class="font-black text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded-sm"
                  :class="risk.severity === 'critical' ? 'bg-rose-500/40 text-rose-200' : 'bg-amber-500/30 text-amber-200'"
                >
                  {{ risk.severity === 'critical' ? '🔴 空域緊急碰撞 (CRITICAL)' : '🟠 衝突接近警戒' }}
                </span>
                <span v-if="sortedRisks.length > 1" class="badge badge-xs rounded-sm font-mono text-[9px] bg-black/40 border border-white/20 text-white/90">
                  警訊 #{{ idx + 1 }}
                </span>
                <span class="text-[11px] font-bold truncate font-mono text-white">
                  {{ risk.droneACallsign }} <span class="text-rose-400 font-extrabold">⚡</span> {{ risk.droneBCallsign }}
                </span>
              </div>
            </div>
          </div>

          <!-- Countdown, Distance & Focus Button -->
          <div class="flex items-center gap-1.5 flex-shrink-0">
            <!-- CPA Countdown Badge -->
            <div
              class="px-2 py-0.5 rounded-sm text-center font-mono"
              :class="risk.severity === 'critical' ? 'bg-rose-500 text-white' : 'bg-amber-500 text-amber-950'"
            >
              <div class="text-[7px] uppercase font-bold opacity-80 leading-none">預估交會</div>
              <div class="text-[11px] font-black leading-tight">{{ risk.timeToCpaSeconds }}s</div>
            </div>

            <!-- CPA Distance Badge -->
            <div class="px-2 py-0.5 rounded-sm bg-black/60 text-center font-mono border border-white/20">
              <div class="text-[7px] uppercase opacity-70 leading-none">最近距離</div>
              <div class="text-[11px] font-black text-cyan-300 leading-tight">{{ risk.cpaDistanceMeters }}m</div>
            </div>

            <!-- Focus Button -->
            <button
              class="btn btn-xs rounded-sm bg-white/10 hover:bg-white/25 border-white/20 text-white px-2 h-7 min-h-0 gap-1"
              :title="`立即將地圖鏡頭定位至 ${risk.droneACallsign} 與 ${risk.droneBCallsign} 的預估碰撞點`"
              @click="emit('focusCollision', risk.cpaCoordinate)"
            >
              <MaterialIcon name="my_location" :size="13" />
              <span class="text-[10px] hidden sm:inline">定位</span>
            </button>
          </div>
        </div>

        <!-- Bottom bar: Real-time Recommended Maneuver / Advisory Action -->
        <div class="flex items-center justify-between gap-2 pt-1 border-t border-white/10 text-xs">
          <div class="flex items-center gap-1.5 opacity-90 truncate">
            <MaterialIcon name="shield" :size="13" class="text-emerald-400 flex-shrink-0" />
            <span class="truncate font-medium text-[11px]">{{ risk.advisoryText }}</span>
          </div>
          <div class="text-[10px] font-mono opacity-70 flex-shrink-0">
            間距: {{ risk.currentDistanceMeters }}m | 高度差: {{ risk.altitudeDiffMeters }}m
          </div>
        </div>
      </div>
    </div>
  </transition>
</template>
