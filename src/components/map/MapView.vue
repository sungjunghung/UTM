<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { MapManager } from '../../services/map/MapManager'
import type { BaseLayerType } from '../../services/map/types'
import MapToolbar from './MapToolbar.vue'
import MapStatusOverlay from './MapStatusOverlay.vue'
import MaterialIcon from '../MaterialIcon.vue'

const mapTarget = ref<HTMLDivElement | null>(null)
let mapManager: MapManager | null = null

// Reactive state
const activeLayer = ref<BaseLayerType>('osm')
const mouseCoord = ref<[number, number] | null>(null)
const centerCoord = ref<[number, number]>([120.982, 23.838])
const currentZoom = ref(8)
const clickToast = ref<string | null>(null)

let unsubPointer: (() => void) | null = null
let unsubClick: (() => void) | null = null
let unsubView: (() => void) | null = null
let resizeObserver: ResizeObserver | null = null

onMounted(() => {
  if (!mapTarget.value) return

  // Instantiate OOP MapManager
  mapManager = new MapManager({
    center: [120.982, 23.838],
    zoom: 8,
    baseLayer: activeLayer.value,
  })

  // Initialize onto target DOM element
  mapManager.initialize(mapTarget.value)

  // Listen to OOP events
  unsubPointer = mapManager.onPointerMove((coords) => {
    mouseCoord.value = coords
  })

  unsubView = mapManager.onViewChange(({ zoom, center }) => {
    currentZoom.value = zoom
    centerCoord.value = center
  })

  unsubClick = mapManager.onClick((coords) => {
    if (!mapManager) return
    mapManager.addMarker({
      coordinate: coords,
      title: `標記 (${coords[0].toFixed(3)}, ${coords[1].toFixed(3)})`,
      color: '#06b6d4',
    })
    showToast(`已在 [${coords[0]}, ${coords[1]}] 建立標記`)
  })

  // Watch container size changes for perfect responsive map
  resizeObserver = new ResizeObserver(() => {
    mapManager?.updateSize()
  })
  resizeObserver.observe(mapTarget.value)

  // Add initial sample marker at NCHC (新竹國網中心)
  mapManager.addMarker({
    coordinate: [121.0028, 24.7887],
    title: 'NCHC 國研院國網中心',
    description: '國家高速網路與計算中心',
    color: '#3b82f6',
  })
})

onUnmounted(() => {
  unsubPointer?.()
  unsubClick?.()
  unsubView?.()
  resizeObserver?.disconnect()
  mapManager?.destroy()
  mapManager = null
})

function handleZoomIn() {
  mapManager?.zoomIn()
}

function handleZoomOut() {
  mapManager?.zoomOut()
}

function handleResetView() {
  mapManager?.resetView()
  showToast('已重設視角至全台中心')
}

function handleSwitchLayer(layer: BaseLayerType) {
  activeLayer.value = layer
  mapManager?.switchBaseLayer(layer)
  showToast(`已切換底圖為: ${layer}`)
}

function handleFlyTo(coords: [number, number], zoom: number) {
  mapManager?.flyTo(coords, zoom)
}

function handleAddMarkerAtCenter() {
  if (!mapManager) return
  mapManager.addMarker({
    coordinate: centerCoord.value,
    title: `中心標記 (${centerCoord.value[0].toFixed(3)}, ${centerCoord.value[1].toFixed(3)})`,
    color: '#f59e0b',
  })
  showToast(`已在畫面中心點建立標記`)
}

function handleClearMarkers() {
  mapManager?.clearMarkers()
  showToast('已清除所有標記')
}

let toastTimer: ReturnType<typeof setTimeout> | null = null
function showToast(msg: string) {
  clickToast.value = msg
  if (toastTimer) clearTimeout(toastTimer)
  toastTimer = setTimeout(() => {
    clickToast.value = null
  }, 2500)
}
</script>

<template>
  <div class="relative w-full h-full min-h-screen overflow-hidden select-none">
    <!-- OpenLayers Map Viewport (Matches Window 100% W & H) -->
    <div
      ref="mapTarget"
      class="absolute inset-0 w-full h-full cursor-crosshair focus:outline-none"
      tabindex="0"
    ></div>

    <!-- Floating Top-Right Map Toolbar -->
    <aside class="absolute top-20 right-4 z-20">
      <MapToolbar
        :active-layer="activeLayer"
        @zoom-in="handleZoomIn"
        @zoom-out="handleZoomOut"
        @reset-view="handleResetView"
        @switch-layer="handleSwitchLayer"
        @fly-to="handleFlyTo"
        @add-marker-at-center="handleAddMarkerAtCenter"
        @clear-markers="handleClearMarkers"
      />
    </aside>

    <!-- Floating Bottom Status Bar (Coordinates & UTM Zone) -->
    <div class="absolute bottom-4 left-36 z-20 hidden md:block">
      <MapStatusOverlay
        :mouse-coord="mouseCoord"
        :center-coord="centerCoord"
        :zoom="currentZoom"
      />
    </div>

    <!-- Floating Helper Tip -->
    <div class="absolute top-20 left-4 z-20 pointer-events-none hidden sm:block">
      <div class="px-3 py-1.5 rounded-xl bg-base-100/80 backdrop-blur-md border border-base-300 shadow-md text-xs text-base-content/80 flex items-center gap-2">
        <MaterialIcon name="mouse" :size="16" class="text-primary" />
        <span>點擊地圖任意位置可新增地標</span>
      </div>
    </div>

    <!-- Notification Toast -->
    <transition
      enter-active-class="transition duration-200 ease-out"
      enter-from-class="opacity-0 translate-y-2"
      enter-to-class="opacity-100 translate-y-0"
      leave-active-class="transition duration-150 ease-in"
      leave-from-class="opacity-100 translate-y-0"
      leave-to-class="opacity-0 translate-y-2"
    >
      <div v-if="clickToast" class="toast toast-top toast-center z-50">
        <div class="alert alert-info py-2 px-4 shadow-2xl text-xs flex items-center gap-2 border border-info/30">
          <MaterialIcon name="info" :size="18" />
          <span>{{ clickToast }}</span>
        </div>
      </div>
    </transition>
  </div>
</template>
