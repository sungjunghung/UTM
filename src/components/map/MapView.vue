<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { MapManager } from '../../services/map/MapManager'
import type { BaseLayerType } from '../../services/map/types'
import { AircraftManager } from '../../services/aircraft/AircraftManager'
import type { AircraftInfo } from '../../services/aircraft/types'
import MapToolbar from './MapToolbar.vue'
import MapStatusOverlay from './MapStatusOverlay.vue'
import AircraftDetailCard from '../aircraft/AircraftDetailCard.vue'
import AircraftRadarWidget from '../aircraft/AircraftRadarWidget.vue'
import MaterialIcon from '../MaterialIcon.vue'

const mapTarget = ref<HTMLDivElement | null>(null)
let mapManager: MapManager | null = null
let aircraftManager: AircraftManager | null = null

// Reactive state
const activeLayer = ref<BaseLayerType>('osm')
const mouseCoord = ref<[number, number] | null>(null)
const centerCoord = ref<[number, number]>([120.982, 23.838])
const currentZoom = ref(8)
const clickToast = ref<string | null>(null)

// Aircraft state
const aircraftList = ref<AircraftInfo[]>([])
const selectedAircraft = ref<AircraftInfo | null>(null)
const isFollowingFlight = ref(false)
const isAircraftLoading = ref(false)
const aircraftError = ref<string | null>(null)
const showTrails = ref(true)

let unsubPointer: (() => void) | null = null
let unsubClick: (() => void) | null = null
let unsubView: (() => void) | null = null
let resizeObserver: ResizeObserver | null = null

onMounted(() => {
  if (!mapTarget.value) return

  // 1. Instantiate OOP MapManager
  mapManager = new MapManager({
    center: [120.982, 23.838],
    zoom: 8,
    baseLayer: activeLayer.value,
  })

  // Initialize onto target DOM element
  mapManager.initialize(mapTarget.value)

  // 2. Instantiate OOP AircraftManager and attach to OpenLayers map
  const olMap = mapManager.getMap()
  if (olMap) {
    aircraftManager = new AircraftManager({
      centerLat: 23.838,
      centerLon: 120.982,
      radiusNm: 250,
      pollIntervalMs: 5000,
      showTrails: showTrails.value,
    })

    aircraftManager.attachToMap(olMap)

    aircraftManager.onUpdate((list) => {
      aircraftList.value = list
      if (selectedAircraft.value) {
        const updated = list.find((a) => a.hex === selectedAircraft.value?.hex)
        if (updated) selectedAircraft.value = updated
      }
    })

    aircraftManager.onSelect((info) => {
      selectedAircraft.value = info
      if (!info) {
        isFollowingFlight.value = false
        aircraftManager?.setFollowSelected(false)
      }
    })

    aircraftManager.onLoading((loading) => {
      isAircraftLoading.value = loading
    })

    aircraftManager.onError((err) => {
      aircraftError.value = err
    })
  }

  // 3. Listen to Map events
  unsubPointer = mapManager.onPointerMove((coords) => {
    mouseCoord.value = coords
  })

  unsubView = mapManager.onViewChange(({ zoom, center }) => {
    currentZoom.value = zoom
    centerCoord.value = center
  })

  unsubClick = mapManager.onClick((coords) => {
    // If not clicking on an aircraft, can drop standard marker
    if (!selectedAircraft.value && mapManager) {
      mapManager.addMarker({
        coordinate: coords,
        title: `標記 (${coords[0].toFixed(3)}, ${coords[1].toFixed(3)})`,
        color: '#06b6d4',
      })
      showToast(`已在 [${coords[0]}, ${coords[1]}] 建立標記`)
    }
  })

  // Watch container size changes for responsive map
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
  aircraftManager?.destroy()
  mapManager?.destroy()
  aircraftManager = null
  mapManager = null
})

// Aircraft Controls
function handleSelectFlight(hex: string) {
  aircraftManager?.selectAircraft(hex)
}

function handleCloseDetail() {
  aircraftManager?.selectAircraft(null)
  selectedAircraft.value = null
  isFollowingFlight.value = false
  aircraftManager?.setFollowSelected(false)
}

function handleToggleFollow() {
  isFollowingFlight.value = !isFollowingFlight.value
  aircraftManager?.setFollowSelected(isFollowingFlight.value)
  showToast(isFollowingFlight.value ? '已開啟視角鎖定追蹤' : '已關閉視角鎖定')
}

function handleToggleTrails() {
  showTrails.value = !showTrails.value
  aircraftManager?.toggleTrails(showTrails.value)
  showToast(showTrails.value ? '已開啟飛行尾跡' : '已關閉飛行尾跡')
}

function handleRefreshAircraft() {
  aircraftManager?.start()
  showToast('正在重新載入空域航班...')
}

// Map Controls
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

    <!-- Floating Top-Left Radar Status & Search Widget -->
    <aside class="absolute top-20 left-4 z-20">
      <AircraftRadarWidget
        :aircraft-list="aircraftList"
        :is-loading="isAircraftLoading"
        :error="aircraftError"
        :show-trails="showTrails"
        @select-flight="handleSelectFlight"
        @toggle-trails="handleToggleTrails"
        @refresh="handleRefreshAircraft"
      />
    </aside>

    <!-- Floating Top-Right Map Controls Toolbar -->
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

    <!-- Floating Flight Detail Card (Bottom-Right or Center-Right) -->
    <aside v-if="selectedAircraft" class="absolute bottom-16 right-4 sm:bottom-20 sm:right-6 z-30">
      <AircraftDetailCard
        :aircraft="selectedAircraft"
        :is-following="isFollowingFlight"
        @close="handleCloseDetail"
        @toggle-follow="handleToggleFollow"
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
