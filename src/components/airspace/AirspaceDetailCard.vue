<script setup lang="ts">
import MaterialIcon from '../MaterialIcon.vue'
import type { AirspaceZoneInfo } from '../../services/airspace/types'

defineProps<{
  zone: AirspaceZoneInfo
}>()

const emit = defineEmits<{
  (e: 'close'): void
}>()
</script>

<template>
  <div
    class="w-80 sm:w-92 rounded-md bg-slate-900/95 backdrop-blur-xl border shadow-2xl overflow-hidden text-slate-100 transition-all duration-150 select-none"
    :class="zone.zoneType === 'red' ? 'border-rose-500/60 shadow-rose-950/60' : 'border-amber-500/60 shadow-amber-950/60'"
  >
    <!-- Header -->
    <div
      class="px-4 py-3 flex items-center justify-between text-white relative overflow-hidden border-b"
      :class="
        zone.zoneType === 'red'
          ? 'bg-gradient-to-r from-rose-900 to-slate-900 border-rose-500/40'
          : 'bg-gradient-to-r from-amber-900 to-slate-900 border-amber-500/40'
      "
    >
      <div class="flex items-center gap-2.5 min-w-0">
        <div
          class="w-8 h-8 rounded-sm flex items-center justify-center shrink-0 border"
          :class="zone.zoneType === 'red' ? 'bg-rose-500/30 border-rose-400/40 text-rose-200' : 'bg-amber-500/30 border-amber-400/40 text-amber-200'"
        >
          <MaterialIcon :name="zone.zoneType === 'red' ? 'gpp_bad' : 'warning'" :size="19" />
        </div>
        <div class="min-w-0">
          <div class="flex items-center gap-2">
            <h3 class="font-extrabold text-lg tracking-wider leading-none truncate text-white">
              {{ zone.name }}
            </h3>
            <span
              class="badge badge-sm rounded-sm font-bold text-xs shrink-0 border"
              :class="
                zone.zoneType === 'red'
                  ? 'bg-rose-500/30 text-rose-200 border-rose-400/40'
                  : 'bg-amber-500/30 text-amber-200 border-amber-400/40'
              "
            >
              {{ zone.zoneType === 'red' ? '禁航區' : '限航區' }}
            </span>
          </div>
          <p class="text-sm text-slate-300 mt-1 truncate font-mono">
            {{ zone.authority }} · 交通部民航局法定圖資
          </p>
        </div>
      </div>

      <button
        class="btn btn-sm btn-square rounded-sm btn-ghost text-white/80 hover:text-white hover:bg-white/20 shrink-0 ml-1"
        title="關閉"
        @click="emit('close')"
      >
        <MaterialIcon name="close" :size="18" />
      </button>
    </div>

    <!-- Body Information -->
    <div class="p-4 space-y-3 text-sm bg-slate-900/80">
      <!-- Legal Regulation Notice -->
      <div class="p-3 rounded-sm bg-slate-800/80 border border-slate-700/70 space-y-1.5">
        <div class="flex items-center gap-2 text-sm font-bold" :class="zone.zoneType === 'red' ? 'text-rose-400' : 'text-amber-400'">
          <MaterialIcon name="policy" :size="18" />
          <span>{{ zone.zoneType === 'red' ? '禁止操作無人機' : '限制操作無人機 (依規定申請)' }}</span>
        </div>
        <p class="text-sm text-slate-200 leading-relaxed mt-1">
          {{ zone.description }}
        </p>
      </div>

      <!-- Legal Penalties -->
      <div v-if="zone.penalty" class="p-3 rounded-sm bg-rose-950/30 border border-rose-900/40 text-sm text-rose-200/90 leading-normal">
        <div class="font-bold mb-1.5 flex items-center gap-2 text-rose-400">
          <MaterialIcon name="gavel" :size="16" />
          <span>罰則規定</span>
        </div>
        {{ zone.penalty }}
      </div>

      <!-- Footer Metadata -->
      <div class="flex items-center justify-between text-xs font-mono text-slate-400 pt-1">
        <span>圖資層: 民航局 UAV_fs_ryg (第0層)</span>
        <span class="text-emerald-400 flex items-center gap-1.5 font-semibold">
          <span class="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
          即時圖資
        </span>
      </div>
    </div>
  </div>
</template>
