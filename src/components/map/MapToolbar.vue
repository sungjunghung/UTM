<script setup lang="ts">
import { ref } from 'vue'
import MaterialIcon from '../MaterialIcon.vue'
import type { BaseLayerType } from '../../services/map/types'

const props = defineProps<{
  activeLayer: BaseLayerType
}>()

const emit = defineEmits<{
  (e: 'zoomIn'): void
  (e: 'zoomOut'): void
  (e: 'resetView'): void
  (e: 'switchLayer', layer: BaseLayerType): void
  (e: 'flyTo', coords: [number, number], zoom: number): void
  (e: 'addMarkerAtCenter'): void
  (e: 'clearMarkers'): void
}>()

const isFullscreen = ref(false)

function toggleFullscreen() {
  if (!document.fullscreenElement) {
    document.documentElement.requestFullscreen().catch(() => {})
    isFullscreen.value = true
  } else {
    document.exitFullscreen().catch(() => {})
    isFullscreen.value = false
  }
}

const presets = [
  { name: '國網中心 (NCHC 新竹)', coords: [121.0028, 24.7887] as [number, number], zoom: 16 },
  { name: '台北 101', coords: [121.5645, 25.0339] as [number, number], zoom: 16 },
  { name: '台中歌劇院', coords: [120.6404, 24.1629] as [number, number], zoom: 16 },
  { name: '高雄流行音樂中心', coords: [120.2885, 22.6186] as [number, number], zoom: 16 },
  { name: '全台俯瞰', coords: [120.982, 23.838] as [number, number], zoom: 8 },
]

const layerOptions: { type: BaseLayerType; label: string; icon: string }[] = [
  { type: 'osm-dark', label: '開源暗夜雷達 (預設, 零商業依賴)', icon: 'radar' },
  { type: 'nlsc-gray', label: '臺灣電子地圖灰階 (內政部官方)', icon: 'domain' },
  { type: 'carto-dark', label: 'Carto 暗夜 (免Key)', icon: 'dark_mode' },
  { type: 'carto-light', label: 'Carto 極簡灰 (免Key)', icon: 'light_mode' },
  { type: 'opentopo', label: '等高地形圖 (Topo)', icon: 'terrain' },
  { type: 'osm', label: '標準街道圖 (OSM)', icon: 'map' },
]
</script>

<template>
  <div class="flex flex-col gap-1.5">
    <!-- Zoom Controls -->
    <div class="join join-vertical shadow-lg bg-base-100/95 backdrop-blur-md border border-base-300 rounded-md overflow-hidden">
      <button
        class="btn btn-sm btn-ghost join-item p-2 hover:bg-primary hover:text-primary-content transition-colors"
        title="放大 (Zoom In)"
        @click="emit('zoomIn')"
      >
        <MaterialIcon name="add" :size="18" />
      </button>
      <button
        class="btn btn-sm btn-ghost join-item p-2 hover:bg-primary hover:text-primary-content transition-colors"
        title="縮小 (Zoom Out)"
        @click="emit('zoomOut')"
      >
        <MaterialIcon name="remove" :size="18" />
      </button>
      <button
        class="btn btn-sm btn-ghost join-item p-2 hover:bg-primary hover:text-primary-content transition-colors"
        title="重設視角 (Reset View)"
        @click="emit('resetView')"
      >
        <MaterialIcon name="my_location" :size="18" />
      </button>
    </div>

    <!-- Quick Actions -->
    <div class="join join-vertical shadow-lg bg-base-100/95 backdrop-blur-md border border-base-300 rounded-md overflow-hidden">
      <!-- Layer Switcher Dropdown -->
      <div class="dropdown dropdown-left">
        <div tabindex="0" role="button" class="btn btn-sm btn-ghost join-item p-2 hover:bg-primary hover:text-primary-content transition-colors" title="切換底圖 (Base Layers)">
          <MaterialIcon name="layers" :size="18" />
        </div>
        <ul tabindex="0" class="dropdown-content menu p-2 shadow-2xl bg-base-200/95 backdrop-blur-md rounded-md w-52 border border-base-300 text-sm space-y-1 z-50">
          <li class="menu-title text-sm uppercase tracking-wider text-base-content/80 font-bold px-2 py-1.5">
            底圖圖層 (Layers)
          </li>
          <li v-for="layer in layerOptions" :key="layer.type">
            <button
              class="rounded-sm py-2 text-sm"
              :class="{ 'active font-bold': props.activeLayer === layer.type }"
              @click="emit('switchLayer', layer.type)"
            >
              <MaterialIcon :name="layer.icon" :size="18" />
              <span>{{ layer.label }}</span>
            </button>
          </li>
        </ul>
      </div>

      <!-- Presets Location Dropdown -->
      <div class="dropdown dropdown-left">
        <div tabindex="0" role="button" class="btn btn-sm btn-ghost join-item p-2 hover:bg-primary hover:text-primary-content transition-colors" title="快速導航 (Presets)">
          <MaterialIcon name="explore" :size="18" />
        </div>
        <ul tabindex="0" class="dropdown-content menu p-2 shadow-2xl bg-base-200/95 backdrop-blur-md rounded-md w-56 border border-base-300 text-sm space-y-1 z-50">
          <li class="menu-title text-sm uppercase tracking-wider text-base-content/80 font-bold px-2 py-1.5">
            常用地點 (Presets)
          </li>
          <li v-for="loc in presets" :key="loc.name">
            <button class="rounded-sm py-2 text-sm" @click="emit('flyTo', loc.coords, loc.zoom)">
              <MaterialIcon name="pin_drop" :size="18" class="text-primary" />
              <span>{{ loc.name }}</span>
            </button>
          </li>
        </ul>
      </div>

      <!-- Marker Tools -->
      <button
        class="btn btn-sm btn-ghost join-item p-2 hover:bg-primary hover:text-primary-content transition-colors"
        title="在當前中心新增標記"
        @click="emit('addMarkerAtCenter')"
      >
        <MaterialIcon name="add_location_alt" :size="20" />
      </button>

      <button
        class="btn btn-sm btn-ghost join-item p-2 hover:bg-error hover:text-error-content transition-colors"
        title="清除所有標記"
        @click="emit('clearMarkers')"
      >
        <MaterialIcon name="delete_sweep" :size="20" />
      </button>

      <!-- Fullscreen Toggle -->
      <button
        class="btn btn-sm btn-ghost join-item p-2 hover:bg-primary hover:text-primary-content transition-colors"
        :title="isFullscreen ? '結束全螢幕' : '全螢幕檢視'"
        @click="toggleFullscreen"
      >
        <MaterialIcon :name="isFullscreen ? 'fullscreen_exit' : 'fullscreen'" :size="20" />
      </button>
    </div>
  </div>
</template>
