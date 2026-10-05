<script setup lang="ts">
import { ref } from 'vue'
import MaterialIcon from '../MaterialIcon.vue'
import type { AirspaceFilterOptions } from '../../services/airspace/types'

const props = defineProps<{
  showAirspace: boolean
  isLoading?: boolean
  filterOptions: AirspaceFilterOptions
}>()

const emit = defineEmits<{
  (e: 'toggleAirspace'): void
  (e: 'updateFilter', options: Partial<AirspaceFilterOptions>): void
}>()

const isSettingsOpen = ref(false)
const activeTab = ref<'filters' | 'legend'>('filters')

function toggleRed() {
  emit('updateFilter', { showRedZones: !props.filterOptions.showRedZones })
}

function toggleYellow() {
  emit('updateFilter', { showYellowZones: !props.filterOptions.showYellowZones })
}

function toggleLabels() {
  emit('updateFilter', { showLabels: !props.filterOptions.showLabels })
}

function toggleCategory(cat: 'airport' | 'government' | 'fir') {
  emit('updateFilter', {
    categories: {
      ...props.filterOptions.categories,
      [cat]: !props.filterOptions.categories[cat],
    },
  })
}

function resetAllFilters() {
  emit('updateFilter', {
    showRedZones: true,
    showYellowZones: true,
    showLabels: true,
    categories: { airport: true, government: true, fir: true },
  })
}
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

      <!-- Airspace Title & Main Layer Toggle Button -->
      <button
        class="flex items-center gap-2 text-sm font-bold transition-colors cursor-pointer"
        :class="showAirspace ? 'text-rose-400 hover:text-rose-300' : 'text-base-content/70 hover:text-base-content'"
        title="點擊開關民航局禁限航區圖層"
        @click="emit('toggleAirspace')"
      >
        <MaterialIcon name="gpp_bad" :size="18" class="text-rose-400" />
        <span class="tracking-wide">民航局禁限航區</span>
        <span
          class="badge badge-sm rounded-sm font-mono font-bold text-xs border"
          :class="showAirspace ? 'badge-error text-white border-rose-400/50' : 'badge-ghost opacity-60'"
        >
          {{ showAirspace ? '開啟' : '關閉' }}
        </span>
      </button>

      <!-- Loading Spinner Indicator when fetching tiles -->
      <div v-if="isLoading" class="flex items-center gap-1.5 px-1 text-sm text-amber-400 animate-pulse">
        <MaterialIcon name="sync" :size="15" class="animate-spin" />
        <span class="hidden sm:inline font-mono">載入中</span>
      </div>

      <div class="w-px h-4 bg-base-content/20 mx-0.5"></div>

      <!-- Airspace Settings & Category Filter Popover Trigger -->
      <div class="relative">
        <button
          class="btn btn-sm btn-ghost btn-square rounded-sm text-base-content/70 hover:text-base-content"
          :class="{ 'bg-base-300 text-base-content': isSettingsOpen }"
          title="空域圖層篩選與名稱顯示控制"
          @click="isSettingsOpen = !isSettingsOpen"
        >
          <MaterialIcon name="tune" :size="18" />
        </button>

        <!-- Airspace Settings & Filter Dropdown Panel -->
        <div
          v-if="isSettingsOpen"
          class="absolute left-0 sm:left-auto sm:right-0 top-full mt-2 w-96 rounded-md shadow-2xl bg-base-200/98 backdrop-blur-xl border border-base-300 p-4 z-50 text-sm text-base-content space-y-3.5"
        >
          <!-- Header with Tab Switcher -->
          <div class="flex items-center justify-between border-b border-base-content/10 pb-2.5">
            <div class="flex items-center gap-2">
              <button
                class="btn btn-sm rounded-sm px-3 font-semibold text-sm"
                :class="activeTab === 'filters' ? 'btn-primary' : 'btn-ghost text-base-content/70'"
                @click="activeTab = 'filters'"
              >
                <MaterialIcon name="tune" :size="16" />
                <span>顯示過濾</span>
              </button>
              <button
                class="btn btn-sm rounded-sm px-3 font-semibold text-sm"
                :class="activeTab === 'legend' ? 'btn-primary' : 'btn-ghost text-base-content/70'"
                @click="activeTab = 'legend'"
              >
                <MaterialIcon name="info" :size="16" />
                <span>法規圖例</span>
              </button>
            </div>

            <button
              class="btn btn-ghost btn-sm btn-square rounded-sm"
              @click="isSettingsOpen = false"
            >
              <MaterialIcon name="close" :size="18" />
            </button>
          </div>

          <!-- TAB 1: Filter & Name Display Controls -->
          <div v-if="activeTab === 'filters'" class="space-y-3.5">
            <!-- 1. Airspace Name / Label Display Control -->
            <div class="p-3 rounded-sm bg-base-100 border border-base-content/10 space-y-1.5">
              <div class="flex items-center justify-between">
                <div class="flex items-center gap-2 font-bold text-sm text-base-content">
                  <MaterialIcon name="subtitles" :size="18" class="text-cyan-400" />
                  <span>空域名稱標籤顯示</span>
                </div>
                <input
                  type="checkbox"
                  class="toggle toggle-sm toggle-primary"
                  :checked="filterOptions.showLabels"
                  @change="toggleLabels"
                />
              </div>
              <p class="text-sm text-base-content/70 leading-relaxed">
                {{ filterOptions.showLabels ? '地圖多邊形將標註空域法定名稱與管制類別' : '已關閉地圖名稱文字，僅保留邊界幾何多邊形' }}
              </p>
            </div>

            <!-- 2. Zone Types Filter (Red / Yellow) -->
            <div class="space-y-2">
              <div class="text-sm font-bold text-base-content/80 tracking-wide">
                空域管制級別
              </div>

              <!-- Red Zone Toggle -->
              <label class="flex items-center justify-between p-3 rounded-sm bg-rose-950/20 border border-rose-500/30 cursor-pointer hover:bg-rose-950/30 transition-colors">
                <div class="flex items-center gap-2.5">
                  <span class="w-3.5 h-3.5 rounded-xs bg-rose-500 border border-rose-400 shrink-0"></span>
                  <div class="leading-snug">
                    <span class="font-bold text-rose-400 text-sm">🔴 禁航區（紅區）</span>
                    <div class="text-sm text-base-content/70 mt-0.5">全日嚴禁任何無人機活動</div>
                  </div>
                </div>
                <input
                  type="checkbox"
                  class="checkbox checkbox-sm checkbox-error rounded-sm"
                  :checked="filterOptions.showRedZones"
                  @change="toggleRed"
                />
              </label>

              <!-- Yellow Zone Toggle -->
              <label class="flex items-center justify-between p-3 rounded-sm bg-amber-950/20 border border-amber-500/30 cursor-pointer hover:bg-amber-950/30 transition-colors">
                <div class="flex items-center gap-2.5">
                  <span class="w-3.5 h-3.5 rounded-xs bg-amber-500/30 border border-amber-500 border-dashed shrink-0"></span>
                  <div class="leading-snug">
                    <span class="font-bold text-amber-400 text-sm">🟠 限航區（黃區）</span>
                    <div class="text-sm text-base-content/70 mt-0.5">限高 200 呎 / 依規定申請</div>
                  </div>
                </div>
                <input
                  type="checkbox"
                  class="checkbox checkbox-sm checkbox-warning rounded-sm"
                  :checked="filterOptions.showYellowZones"
                  @change="toggleYellow"
                />
              </label>
            </div>

            <!-- 3. Sub-Category Filter -->
            <div class="space-y-2 pt-2.5 border-t border-base-content/10">
              <div class="text-sm font-bold text-base-content/80 tracking-wide">
                空域細項類別
              </div>

              <!-- Airport & Corridor -->
              <label class="flex items-center justify-between px-3 py-2.5 rounded-sm bg-base-100 border border-base-content/10 cursor-pointer hover:bg-base-300/40">
                <div class="flex items-center gap-2.5 text-sm font-medium">
                  <MaterialIcon name="flight_takeoff" :size="18" class="text-sky-400" />
                  <span>機場與航道四周管制範圍</span>
                </div>
                <input
                  type="checkbox"
                  class="checkbox checkbox-sm rounded-sm"
                  :checked="filterOptions.categories.airport"
                  @change="toggleCategory('airport')"
                />
              </label>

              <!-- Municipal & Critical Infrastructure -->
              <label class="flex items-center justify-between px-3 py-2.5 rounded-sm bg-base-100 border border-base-content/10 cursor-pointer hover:bg-base-300/40">
                <div class="flex items-center gap-2.5 text-sm font-medium">
                  <MaterialIcon name="account_balance" :size="18" class="text-amber-400" />
                  <span>縣市機關與高鐵/電網設施</span>
                </div>
                <input
                  type="checkbox"
                  class="checkbox checkbox-sm rounded-sm"
                  :checked="filterOptions.categories.government"
                  @change="toggleCategory('government')"
                />
              </label>

              <!-- FIR Flight Information Region -->
              <label class="flex items-center justify-between px-3 py-2.5 rounded-sm bg-base-100 border border-base-content/10 cursor-pointer hover:bg-base-300/40">
                <div class="flex items-center gap-2.5 text-sm font-medium">
                  <MaterialIcon name="public" :size="18" class="text-emerald-400" />
                  <span>飛航情報限航區範圍</span>
                </div>
                <input
                  type="checkbox"
                  class="checkbox checkbox-sm rounded-sm"
                  :checked="filterOptions.categories.fir"
                  @change="toggleCategory('fir')"
                />
              </label>
            </div>

            <!-- Quick Action: Reset to Defaults -->
            <div class="pt-1 flex justify-end">
              <button
                class="btn btn-sm btn-ghost text-sm text-base-content/70 hover:text-base-content gap-1.5"
                @click="resetAllFilters"
              >
                <MaterialIcon name="restart_alt" :size="16" />
                <span>重設所有篩選</span>
              </button>
            </div>
          </div>

          <!-- TAB 2: Legal Rules & Legend -->
          <div v-else-if="activeTab === 'legend'" class="space-y-3.5">
            <!-- Red Zone Description -->
            <div class="flex items-start gap-3 p-3 rounded-sm bg-rose-950/20 border border-rose-500/30">
              <span class="w-4 h-4 rounded-xs bg-rose-500/40 border border-rose-500 shrink-0 mt-0.5"></span>
              <div>
                <div class="font-bold text-rose-400 text-sm">🔴 紅區（禁航區）</div>
                <p class="text-sm text-base-content/80 leading-relaxed mt-1">
                  全日禁止遙控無人機飛航活動。涵蓋機場四周、軍事管制區、高鐵/台鐵沿線及中央政府機關。
                </p>
              </div>
            </div>

            <!-- Yellow Zone Description -->
            <div class="flex items-start gap-3 p-3 rounded-sm bg-amber-950/20 border border-amber-500/30">
              <span class="w-4 h-4 rounded-xs bg-amber-500/30 border border-amber-500 border-dashed shrink-0 mt-0.5"></span>
              <div>
                <div class="font-bold text-amber-400 text-sm">🟠 黃區（限航區）</div>
                <p class="text-sm text-base-content/80 leading-relaxed mt-1">
                  限制遙控無人機飛航活動。限制飛行高度 200 呎（約 60 公尺）以下，或須依民航法事前申請核准。
                </p>
              </div>
            </div>

            <!-- Metadata & Rules -->
            <div class="text-xs font-mono text-base-content/60 pt-2.5 border-t border-base-content/10 space-y-1">
              <div>資料來源: 交通部民用航空局 (UAV_fs_ryg)</div>
              <div>法規依據: 民用航空法第 99 條之 13 及第 118 條之 2</div>
              <div>更新頻率: 依視野動態查詢 + 官方即時同步</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
