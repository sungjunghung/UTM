<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import MaterialIcon from '../MaterialIcon.vue'
import type { CollisionRisk } from '../../services/drone/collisionTypes'

const props = defineProps<{
  collisionRisks: CollisionRisk[]
  selectedRiskId?: string | null
}>()

const emit = defineEmits<{
  (e: 'focusCollision', coordinate: [number, number]): void
  (e: 'selectRisk', risk: CollisionRisk): void
}>()

const internalSelectedId = ref<string | null>(null)
const activeSelectedId = computed(() =>
  props.selectedRiskId !== undefined ? props.selectedRiskId : internalSelectedId.value
)

function handleCardClick(risk: CollisionRisk) {
  internalSelectedId.value = risk.id
  emit('selectRisk', risk)
  emit('focusCollision', risk.cpaCoordinate)
}

watch(
  () => props.collisionRisks,
  (newRisks) => {
    if (activeSelectedId.value && !newRisks.some((r) => r.id === activeSelectedId.value)) {
      internalSelectedId.value = null
    }
  },
  { deep: true }
)

// Sorted collision & airspace risks: critical first, then warning, then by closest time
const sortedRisks = computed(() => {
  if (!props.collisionRisks || props.collisionRisks.length === 0) return []
  return [...props.collisionRisks].sort((a, b) => {
    const rank = { critical: 3, warning: 2, advisory: 1, clear: 0 }
    if (rank[b.severity] !== rank[a.severity]) {
      return rank[b.severity] - rank[a.severity]
    }
    return (a.timeToCpaSeconds || 99) - (b.timeToCpaSeconds || 99)
  })
})
</script>

<template>
  <div
    v-if="sortedRisks.length > 0"
    class="pointer-events-auto flex flex-col gap-2.5 w-full select-none max-h-[calc(100vh-5.5rem)] overflow-y-auto pr-1.5 custom-scrollbar"
  >
    <!-- Counter Badge when multiple alerts exist -->
    <div
      v-if="sortedRisks.length > 1"
      class="flex items-center justify-between px-2.5 py-1 rounded-md bg-black/70 backdrop-blur-md border border-white/15 text-[11px] font-mono text-white/80 shadow-lg"
    >
      <span class="flex items-center gap-1.5 font-bold text-amber-300">
        <span class="w-2 h-2 rounded-full bg-rose-500 animate-ping"></span>
        即時告警監控 (共 {{ sortedRisks.length }} 則)
      </span>
      <span class="text-white/50 text-[10px]">點擊卡片可切換選取與定位</span>
    </div>

    <transition-group
      tag="div"
      enter-active-class="transition duration-300 ease-out"
      enter-from-class="opacity-0 translate-x-8 scale-95"
      enter-to-class="opacity-100 translate-x-0 scale-100"
      leave-active-class="transition duration-200 ease-in"
      leave-from-class="opacity-100 translate-x-0 scale-100"
      leave-to-class="opacity-0 translate-x-8 scale-95"
      class="flex flex-col gap-2.5 w-full"
    >
    <div
      v-for="(risk, idx) in sortedRisks"
      :key="risk.id"
      class="group relative pointer-events-auto w-full rounded-xl p-3.5 backdrop-blur-2xl border border-l-[5px] flex flex-col gap-2.5 transition-all duration-200 cursor-pointer overflow-hidden"
      :class="[
        activeSelectedId === risk.id
          ? 'scale-[1.01] opacity-100 z-10'
          : 'opacity-65 hover:opacity-95 hover:scale-[1.005]',
        risk.severity === 'critical'
          ? (activeSelectedId === risk.id
              ? 'bg-gradient-to-br from-rose-950/95 via-neutral-950/95 to-rose-950/90 border-rose-500/80 border-l-rose-400 shadow-2xl shadow-rose-950/90 ring-1 ring-rose-400/50 text-rose-50'
              : 'bg-neutral-950/85 border-white/10 border-l-rose-500/50 text-rose-100/90 hover:border-rose-500/40 shadow-lg')
          : (activeSelectedId === risk.id
              ? 'bg-gradient-to-br from-amber-950/95 via-neutral-950/95 to-amber-950/90 border-amber-500/80 border-l-amber-400 shadow-2xl shadow-amber-950/90 ring-1 ring-amber-400/50 text-amber-50'
              : 'bg-neutral-950/85 border-white/10 border-l-amber-500/50 text-amber-100/90 hover:border-amber-500/40 shadow-lg')
      ]"
      :title="`點擊將地圖視角移動至警告發生地點`"
      @click="handleCardClick(risk)"
    >
      <!-- Row 1: Header / Multi-Stage Alert Status Pill & Focus Action -->
      <div class="flex items-center justify-between gap-2 border-b border-white/10 pb-2">
        <div class="flex items-center gap-2 min-w-0">
          <div
            class="w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0"
            :class="risk.severity === 'critical' ? 'bg-rose-500 text-white' : 'bg-amber-500 text-amber-950'"
          >
            <MaterialIcon :name="risk.severity === 'critical' ? 'report' : 'warning'" :size="16" />
          </div>

          <!-- Multi-Stage Tag (階段標籤) -->
          <span
            class="font-black text-xs tracking-wider px-2 py-0.5 rounded uppercase whitespace-nowrap"
            :class="
              risk.severity === 'critical'
                ? 'bg-rose-500/30 text-rose-200 border border-rose-500/40'
                : 'bg-amber-500/25 text-amber-200 border border-amber-500/30'
            "
          >
            <template v-if="risk.type === 'no-fly-zone'">
              {{ risk.stage === 'breached' ? '🔴 階段二：違規入侵' : '⚠️ 階段一：即將誤觸' }}
            </template>
            <template v-else-if="risk.type === 'altitude-violation'">
              {{ risk.stage === 'breached' ? '🚨 階段二：違規超高' : '⚠️ 階段一：高度預警' }}
            </template>
            <template v-else>
              {{ risk.severity === 'critical' ? '🔴 階段二：緊急碰撞' : '🟠 階段一：接近警戒' }}
            </template>
          </span>

          <span v-if="sortedRisks.length > 1" class="badge badge-xs font-mono text-[10px] bg-black/40 border border-white/20 text-white/80">
            #{{ idx + 1 }}
          </span>
        </div>

        <!-- Right Side: Status / Action Indicator -->
        <div v-if="activeSelectedId === risk.id" class="flex items-center gap-1.5 text-[11px] font-mono font-medium px-2 py-0.5 rounded bg-white/10 border border-white/20 text-white shadow-sm flex-shrink-0">
          <span class="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
          <span>鎖定中</span>
        </div>
        <button
          v-else
          class="flex items-center gap-1 text-[11px] font-mono px-2 py-0.5 rounded border border-white/10 text-white/60 group-hover:text-white group-hover:border-white/30 group-hover:bg-white/5 transition-all flex-shrink-0"
          title="點擊選取並定位"
        >
          <MaterialIcon name="near_me" :size="12" />
          <span>定位</span>
        </button>
      </div>

      <!-- Row 2: Target & Drone Relationship (換行拆分，不再擠成一團！) -->
      <div class="flex flex-col gap-1 text-xs">
        <!-- Drone Origin -->
        <div class="flex items-center gap-2">
          <span class="text-white/60 font-mono text-[11px] w-16 flex-shrink-0">受控機號</span>
          <span class="font-bold text-sm text-white font-mono flex items-center gap-1.5 truncate">
            <span class="w-2 h-2 rounded-full bg-cyan-400"></span>
            {{ risk.droneACallsign }}
            <span class="text-[11px] text-white/50 font-normal">({{ risk.droneAId }})</span>
          </span>
        </div>

        <!-- Target / Zone with clear title -->
        <div class="flex items-center gap-2">
          <span class="text-white/60 font-mono text-[11px] w-16 flex-shrink-0">
            {{ risk.type === 'collision' ? '衝突對象' : '管制標的' }}
          </span>
          <span
            class="font-bold text-sm font-mono truncate"
            :class="risk.severity === 'critical' ? 'text-rose-300' : 'text-amber-300'"
          >
            <template v-if="risk.type === 'collision'">
              {{ risk.droneBCallsign }} <span class="text-[11px] text-white/50">({{ risk.droneBId }})</span>
            </template>
            <template v-else>
              {{ risk.zoneName }}
            </template>
          </span>
        </div>
      </div>

      <!-- Row 3: Multi-Stage Telemetry Metrics Grid (清晰結構化數據磚) -->
      <div class="grid grid-cols-2 gap-2 text-center font-mono">
        <!-- Metric Box 1 -->
        <div class="rounded-lg p-2 bg-black/40 border border-white/10 flex flex-col justify-center">
          <div class="text-[10px] uppercase font-bold tracking-wider text-white/60 leading-none">
            {{ risk.metricPrimaryTitle || '預估時程' }}
          </div>
          <div class="text-base sm:text-lg font-black mt-1 leading-none text-white">
            {{ risk.metricPrimaryValue }}
          </div>
        </div>

        <!-- Metric Box 2 -->
        <div class="rounded-lg p-2 bg-black/40 border border-white/10 flex flex-col justify-center">
          <div class="text-[10px] uppercase font-bold tracking-wider text-white/60 leading-none">
            {{ risk.metricSecondaryTitle || '安全距離' }}
          </div>
          <div class="text-base sm:text-lg font-black mt-1 leading-none text-cyan-300">
            {{ risk.metricSecondaryValue }}
          </div>
        </div>
      </div>

      <!-- Row 4: Recommended Action / Advisory Callout (文字完整換行，絕不截斷) -->
      <div class="rounded-lg p-2.5 bg-black/30 border border-white/10 flex flex-col gap-1 text-xs">
        <div class="flex items-start gap-1.5 leading-snug">
          <MaterialIcon name="shield" :size="15" class="text-emerald-400 flex-shrink-0 mt-0.5" />
          <span class="font-medium text-white/95 text-xs break-words">{{ risk.advisoryText }}</span>
        </div>
        <div class="flex items-center justify-between text-[11px] font-mono text-white/60 pt-1 border-t border-white/5 mt-0.5">
          <span>當前高度: {{ risk.currentAltitudeMeters }}m AGL</span>
          <span>
            <template v-if="risk.type === 'no-fly-zone'">法定標準: 全區禁航</template>
            <template v-else-if="risk.type === 'altitude-violation'">法定上限: 60m AGL</template>
            <template v-else>衝突高度差: {{ risk.altitudeDiffMeters || 0 }}m</template>
          </span>
        </div>
      </div>
    </div>
  </transition-group>
  </div>
</template>

<style scoped>
.custom-scrollbar::-webkit-scrollbar {
  width: 4px;
}
.custom-scrollbar::-webkit-scrollbar-track {
  background: rgba(0, 0, 0, 0.25);
  border-radius: 9999px;
}
.custom-scrollbar::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.35);
  border-radius: 9999px;
}
.custom-scrollbar::-webkit-scrollbar-thumb:hover {
  background: rgba(255, 255, 255, 0.6);
}
</style>

