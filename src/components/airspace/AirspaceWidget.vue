<script setup lang="ts">
import { ref } from 'vue'
import MaterialIcon from '../MaterialIcon.vue'

const props = defineProps<{
  showAirspace: boolean
  isLoading?: boolean
}>()

const emit = defineEmits<{
  (e: 'toggleAirspace'): void
}>()

const isLegendOpen = ref(false)
</script>

<template>
  <div class="flex items-center gap-1.5 select-none">
    <!-- Main Status Capsule -->
    <div
      class="flex items-center gap-1.5 p-1 pl-2.5 pr-1.5 rounded-md bg-base-100/95 backdrop-blur-md border shadow-lg transition-all"
      :class="showAirspace ? 'border-rose-500/50 shadow-rose-950/20' : 'border-base-300 opacity-60'"
    >
      <!-- Red/Amber Pulsing Dot Indicator -->
      <div class="relative flex items-center justify-center w-3 h-3">
        <span
          v-if="showAirspace"
          class="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 bg-rose-400"
        ></span>
        <span
          class="relative inline-flex rounded-full h-2 w-2"
          :class="showAirspace ? 'bg-rose-500' : 'bg-base-content/40'"
        ></span>
      </div>

      <!-- Airspace Title & Toggle Button -->
      <button
        class="flex items-center gap-1.5 text-xs font-bold transition-colors cursor-pointer"
        :class="showAirspace ? 'text-rose-400 hover:text-rose-300' : 'text-base-content/60 hover:text-base-content'"
        title="點擊開關民航局禁限航區圖層"
        @click="emit('toggleAirspace')"
      >
        <MaterialIcon name="gpp_bad" :size="16" class="text-rose-400" />
        <span class="tracking-wide">民航局禁限航區</span>
        <span
          class="badge badge-xs rounded-sm font-mono text-[9px] border"
          :class="showAirspace ? 'badge-error text-white border-rose-400/50' : 'badge-ghost opacity-60'"
        >
          {{ showAirspace ? '開啟' : '關閉' }}
        </span>
      </button>

      <!-- Loading Spinner Indicator when fetching tiles -->
      <div v-if="isLoading" class="flex items-center gap-1 px-1 text-[10px] text-amber-400 animate-pulse">
        <MaterialIcon name="sync" :size="12" class="animate-spin" />
        <span class="hidden sm:inline font-mono">載入中</span>
      </div>

      <div class="w-px h-3.5 bg-base-content/20 mx-0.5"></div>

      <!-- Airspace Legend / Details Popover Trigger -->
      <div class="relative">
        <button
          class="btn btn-xs btn-ghost btn-square rounded-sm text-base-content/70 hover:text-base-content"
          :class="{ 'bg-base-300 text-base-content': isLegendOpen }"
          title="空域圖例與法規說明"
          @click="isLegendOpen = !isLegendOpen"
        >
          <MaterialIcon name="info" :size="14" />
        </button>

        <!-- Airspace Legend Dropdown Panel -->
        <div
          v-if="isLegendOpen"
          class="absolute left-0 sm:left-auto sm:right-0 top-full mt-2 w-72 rounded-md shadow-2xl bg-base-200/98 backdrop-blur-xl border border-base-300 p-3 z-50 text-xs text-base-content space-y-2.5"
        >
          <div class="flex items-center justify-between border-b border-base-content/10 pb-1.5">
            <div class="flex items-center gap-1.5 font-bold text-xs text-rose-400">
              <MaterialIcon name="shield" :size="16" />
              <span>無人機管制空域圖例</span>
            </div>
            <button
              class="btn btn-ghost btn-xs btn-square rounded-sm"
              @click="isLegendOpen = false"
            >
              <MaterialIcon name="close" :size="14" />
            </button>
          </div>

          <!-- Red Zone Description -->
          <div class="flex items-start gap-2 p-2 rounded-sm bg-rose-950/20 border border-rose-500/30">
            <span class="w-3 h-3 rounded-xs bg-rose-500/40 border border-rose-500 shrink-0 mt-0.5"></span>
            <div>
              <div class="font-bold text-rose-400 text-[11px]">🔴 紅區（禁航區）</div>
              <p class="text-[10px] text-base-content/70 leading-relaxed mt-0.5">
                全日禁止遙控無人機飛航活動。涵蓋機場四周、軍事管制區、高鐵/台鐵沿線及中央政府機關。
              </p>
            </div>
          </div>

          <!-- Yellow Zone Description -->
          <div class="flex items-start gap-2 p-2 rounded-sm bg-amber-950/20 border border-amber-500/30">
            <span class="w-3 h-3 rounded-xs bg-amber-500/30 border border-amber-500 border-dashed shrink-0 mt-0.5"></span>
            <div>
              <div class="font-bold text-amber-400 text-[11px]">🟠 黃區（限航區）</div>
              <p class="text-[10px] text-base-content/70 leading-relaxed mt-0.5">
                限制遙控無人機飛航活動。限制飛行高度 200 呎（約 60 公尺）以下，或須依民航法事前申請核准。
              </p>
            </div>
          </div>

          <!-- Metadata & Rules -->
          <div class="text-[9px] font-mono text-base-content/50 pt-1 border-t border-base-content/10 space-y-0.5">
            <div>資料來源: 交通部民用航空局 (UAV_fs_ryg)</div>
            <div>法規依據: 民用航空法第 99 條之 13 及第 118 條之 2</div>
            <div>更新頻率: 依視野動態查詢 + 官方即時同步</div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
