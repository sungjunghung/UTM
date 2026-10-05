<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import Overlay from 'ol/Overlay'
import { fromLonLat } from 'ol/proj'
import { MapManager } from '../../services/map/MapManager'
import type { BaseLayerType } from '../../services/map/types'
import { AircraftManager } from '../../services/aircraft/AircraftManager'
import type { AircraftInfo } from '../../services/aircraft/types'
import { DroneManager } from '../../services/drone/DroneManager'
import type { DroneInfo } from '../../services/drone/types'
import MapToolbar from './MapToolbar.vue'
import MapStatusOverlay from './MapStatusOverlay.vue'
import AircraftDetailCard from '../aircraft/AircraftDetailCard.vue'
import AircraftRadarWidget from '../aircraft/AircraftRadarWidget.vue'
import DroneDetailCard from '../drone/DroneDetailCard.vue'
import DroneWidget from '../drone/DroneWidget.vue'
import MaterialIcon from '../MaterialIcon.vue'

const mapTarget = ref<HTMLDivElement | null>(null)
const detailOverlayTarget = ref<HTMLDivElement | null>(null)
const droneOverlayTarget = ref<HTMLDivElement | null>(null)
let mapManager: MapManager | null = null
let aircraftManager: AircraftManager | null = null
let droneManager: DroneManager | null = null
let detailOverlay: Overlay | null = null
let droneOverlay: Overlay | null = null

// Reactive state
const activeLayer = ref<BaseLayerType>('osm-dark')
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

// Drone state
const droneList = ref<DroneInfo[]>([])
const selectedDrone = ref<DroneInfo | null>(null)
const isFollowingDrone = ref(false)
const showDrones = ref(true)

// Module display visibility state (Screen & Map display toggles)
const showAircraftModule = ref(true)
const showDroneModule = ref(true)
const isModuleMenuOpen = ref(false)

const activeModuleCount = computed(() => {
  return (showAircraftModule.value ? 1 : 0) + (showDroneModule.value ? 1 : 0)
})

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
      centerLat: 24.7887,
      centerLon: 121.0028,
      radiusNm: 120,
      pollIntervalMs: 3000,
      showTrails: showTrails.value,
    })

    aircraftManager.attachToMap(olMap)

    // Mount aircraft detail card overlay to OpenLayers map
    if (detailOverlayTarget.value) {
      detailOverlay = new Overlay({
        element: detailOverlayTarget.value,
        positioning: 'bottom-left',
        offset: [28, -24],
        stopEvent: true,
      })
      olMap.addOverlay(detailOverlay)
    }

    aircraftManager.onUpdate((list) => {
      aircraftList.value = list
      if (selectedAircraft.value) {
        const updated = list.find((a) => a.hex === selectedAircraft.value?.hex)
        if (updated) selectedAircraft.value = updated
      }
    })

    aircraftManager.onSelect((info) => {
      selectedAircraft.value = info
      if (info && detailOverlay) {
        // Clear drone selection to avoid overlay clutter
        handleCloseDroneDetail()
        detailOverlay.setPosition(fromLonLat([info.longitude, info.latitude]))
      } else if (!info && detailOverlay) {
        detailOverlay.setPosition(undefined)
        isFollowingFlight.value = false
        aircraftManager?.setFollowSelected(false)
      }
    })

    // Real-time 60fps tracking: glide card smoothly beside the moving aircraft
    let lastTelemetryTime = 0
    aircraftManager.onSelectedMove((lonLat, info) => {
      if (detailOverlay && selectedAircraft.value) {
        detailOverlay.setPosition(fromLonLat(lonLat))
      }
      const now = performance.now()
      if (now - lastTelemetryTime > 150) {
        lastTelemetryTime = now
        selectedAircraft.value = info
      }
    })

    aircraftManager.onLoading((loading) => {
      isAircraftLoading.value = loading
    })

    aircraftManager.onFollowChange((following) => {
      isFollowingFlight.value = following
    })

    aircraftManager.onError((err) => {
      aircraftError.value = err
    })

    // 3. Instantiate OOP DroneManager for Airspace Real-time Drones (UTM)
    droneManager = new DroneManager({
      centerLat: 24.7887,
      centerLon: 121.0028,
      showTrails: true,
      showMissionPaths: true,
    })

    droneManager.attachToMap(olMap)

    // Mount drone detail card overlay
    if (droneOverlayTarget.value) {
      droneOverlay = new Overlay({
        element: droneOverlayTarget.value,
        positioning: 'bottom-left',
        offset: [28, -24],
        stopEvent: true,
      })
      olMap.addOverlay(droneOverlay)
    }

    droneManager.onUpdate((list) => {
      droneList.value = list
      if (selectedDrone.value) {
        const updated = list.find((d) => d.id === selectedDrone.value?.id)
        if (updated) selectedDrone.value = updated
      }
    })

    droneManager.onSelect((info) => {
      selectedDrone.value = info
      if (info && droneOverlay) {
        // Clear aircraft selection to avoid overlap
        handleCloseDetail()
        droneOverlay.setPosition(fromLonLat([info.longitude, info.latitude]))
      } else if (!info && droneOverlay) {
        droneOverlay.setPosition(undefined)
        isFollowingDrone.value = false
        droneManager?.setFollowSelected(false)
      }
    })

    droneManager.onSelectedMove((lonLat, info) => {
      if (droneOverlay && selectedDrone.value) {
        droneOverlay.setPosition(fromLonLat(lonLat))
      }
      selectedDrone.value = info
    })

    droneManager.onFollowChange((following) => {
      isFollowingDrone.value = following
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
  if (detailOverlay && mapManager) {
    mapManager.getMap()?.removeOverlay(detailOverlay)
    detailOverlay = null
  }
  if (droneOverlay && mapManager) {
    mapManager.getMap()?.removeOverlay(droneOverlay)
    droneOverlay = null
  }
  droneManager?.destroy()
  aircraftManager?.destroy()
  mapManager?.destroy()
  droneManager = null
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
  detailOverlay?.setPosition(undefined)
}

function handleToggleFollow() {
  const next = !isFollowingFlight.value
  isFollowingFlight.value = next
  aircraftManager?.setFollowSelected(next)
  showToast(next ? '已開啟視角鎖定追蹤（可隨時滾輪縮放）' : '已關閉視角鎖定')
}

function handleToggleTrails() {
  showTrails.value = !showTrails.value
  aircraftManager?.toggleTrails(showTrails.value)
  showToast(showTrails.value ? '已開啟飛行尾跡' : '已關閉飛行尾跡')
}

// Drone Controls
function handleSelectDrone(id: string) {
  droneManager?.selectDrone(id)
}

function handleCloseDroneDetail() {
  droneManager?.selectDrone(null)
  selectedDrone.value = null
  isFollowingDrone.value = false
  droneManager?.setFollowSelected(false)
  droneOverlay?.setPosition(undefined)
}

function handleToggleFollowDrone() {
  const next = !isFollowingDrone.value
  isFollowingDrone.value = next
  droneManager?.setFollowSelected(next)
  showToast(next ? '已開啟無人機鏡頭鎖定追蹤' : '已關閉鏡頭鎖定')
}

function handleToggleDrones() {
  showDrones.value = !showDrones.value
  droneManager?.toggleLayer(showDrones.value)
  showToast(showDrones.value ? '已開啟無人機圖層' : '已隱藏無人機圖層')
}

function handleFocusDroneZone() {
  mapManager?.flyTo([121.0028, 24.7887], 13.5)
  showToast('已聚焦新竹國網中心無人機空域')
}

// Module Display Controls (Show / Hide entire modules on screen & map)
function handleToggleAircraftModule() {
  aircraftManager?.toggleLayer(showAircraftModule.value)
  if (!showAircraftModule.value) {
    handleCloseDetail()
    showToast('已隱藏空域即時航班模組（可從頂部【模組】隨時開啟）')
  } else {
    showToast('已顯示空域即時航班模組')
  }
}

function handleToggleDroneModule() {
  droneManager?.toggleLayer(showDroneModule.value)
  if (!showDroneModule.value) {
    handleCloseDroneDetail()
    showToast('已隱藏空域即時無人機模組（可從頂部【模組】隨時開啟）')
  } else {
    showToast('已顯示空域即時無人機模組')
  }
}

function handleSetAllModules(show: boolean) {
  showAircraftModule.value = show
  showDroneModule.value = show
  aircraftManager?.toggleLayer(show)
  droneManager?.toggleLayer(show)
  if (!show) {
    handleCloseDetail()
    handleCloseDroneDetail()
    showToast('已隱藏所有空域監控模組')
  } else {
    showToast('已顯示所有空域監控模組')
  }
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
      class="absolute inset-0 w-full h-full cursor-default focus:outline-none bg-[#12161f]"
      tabindex="0"
    ></div>

    <!-- Floating Top Navigation Bar with UTM Title & Radar Tracking Widget -->
    <header class="absolute top-4 left-4 right-4 z-30 pointer-events-none">
      <div class="flex items-start justify-between">
        <!-- Brand Title & Radar/Drone Widgets: Pure Borderless Glass UTM Text + Aircraft & Drone tracking -->
        <div class="pointer-events-auto flex items-start gap-2.5 flex-wrap">
          <div class="pt-1.5 select-none pl-2">
            <span class="glass-brand-text cursor-default" title="Universal Transverse Mercator">
              UTM
            </span>
          </div>

          <!-- Module Display Switcher Dropdown (Controls on-screen display of Aircraft & Drone modules) -->
          <div class="relative pt-0.5">
            <button
              class="btn btn-xs rounded-2xl bg-base-100/90 backdrop-blur-xl border border-base-300 shadow-md flex items-center gap-1.5 px-2.5 py-1 text-xs hover:border-primary/50 transition-all cursor-pointer"
              :class="{ 'border-primary text-primary': isModuleMenuOpen }"
              title="管理空域監控模組顯示與隱藏"
              @click="isModuleMenuOpen = !isModuleMenuOpen"
            >
              <MaterialIcon name="tune" :size="15" />
              <span>模組 ({{ activeModuleCount }}/2)</span>
              <MaterialIcon :name="isModuleMenuOpen ? 'expand_less' : 'expand_more'" :size="14" />
            </button>

            <!-- Dropdown Popover -->
            <div
              v-if="isModuleMenuOpen"
              class="absolute top-9 left-0 w-64 rounded-2xl bg-base-100/95 backdrop-blur-xl border border-base-300 shadow-2xl p-3 space-y-2.5 z-50 text-xs animate-in fade-in zoom-in-95 duration-150"
            >
              <div class="flex items-center justify-between pb-1.5 border-b border-base-300">
                <span class="font-bold flex items-center gap-1.5 text-base-content">
                  <MaterialIcon name="layers" :size="16" class="text-primary" />
                  空域監控模組開關
                </span>
                <button class="btn btn-ghost btn-circle btn-xs" @click="isModuleMenuOpen = false">
                  <MaterialIcon name="close" :size="14" />
                </button>
              </div>

              <!-- Module 1: Aircraft -->
              <label class="flex items-center justify-between p-2 rounded-xl bg-base-200/50 hover:bg-base-200 transition-colors cursor-pointer">
                <div class="flex items-center gap-2">
                  <div class="w-6 h-6 rounded-lg bg-primary/20 text-primary flex items-center justify-center">
                    <MaterialIcon name="flight" :size="15" />
                  </div>
                  <div>
                    <div class="font-bold">空域即時航班</div>
                    <div class="text-[10px] text-base-content/60">民航機 ADS-B</div>
                  </div>
                </div>
                <input
                  type="checkbox"
                  class="toggle toggle-primary toggle-xs"
                  v-model="showAircraftModule"
                  @change="handleToggleAircraftModule"
                />
              </label>

              <!-- Module 2: Drone -->
              <label class="flex items-center justify-between p-2 rounded-xl bg-base-200/50 hover:bg-base-200 transition-colors cursor-pointer">
                <div class="flex items-center gap-2">
                  <div class="w-6 h-6 rounded-lg bg-cyan-500/20 text-cyan-400 flex items-center justify-center">
                    <MaterialIcon name="toys" :size="15" />
                  </div>
                  <div>
                    <div class="font-bold">空域即時無人機</div>
                    <div class="text-[10px] text-base-content/60">UTM 低空任務</div>
                  </div>
                </div>
                <input
                  type="checkbox"
                  class="toggle toggle-accent toggle-xs"
                  v-model="showDroneModule"
                  @change="handleToggleDroneModule"
                />
              </label>

              <!-- Quick Bulk Action Buttons -->
              <div class="flex gap-1.5 pt-1 border-t border-base-300">
                <button
                  class="btn btn-xs flex-1 btn-outline"
                  @click="handleSetAllModules(true)"
                >
                  全部顯示
                </button>
                <button
                  class="btn btn-xs flex-1 btn-ghost text-base-content/60"
                  @click="handleSetAllModules(false)"
                >
                  全部隱藏
                </button>
              </div>
            </div>
          </div>

          <!-- Module 1 Widget: Airspace Live Flights (Civil Aircraft) -->
          <AircraftRadarWidget
            v-if="showAircraftModule"
            :aircraft-list="aircraftList"
            :is-loading="isAircraftLoading"
            :error="aircraftError"
            :show-trails="showTrails"
            @select-flight="handleSelectFlight"
            @toggle-trails="handleToggleTrails"
            @refresh="handleRefreshAircraft"
            @close-module="
              showAircraftModule = false;
              handleToggleAircraftModule();
            "
          />

          <!-- Module 2 Widget: Airspace Real-time Drones (UAV) -->
          <DroneWidget
            v-if="showDroneModule"
            :drone-list="droneList"
            :show-drones="showDrones"
            @select-drone="handleSelectDrone"
            @toggle-drones="handleToggleDrones"
            @focus-drone-zone="handleFocusDroneZone"
            @close-module="
              showDroneModule = false;
              handleToggleDroneModule();
            "
          />
        </div>

        <!-- Right Header Action Slot (Theme Picker, etc.) -->
        <div class="pointer-events-auto flex items-center gap-2">
          <slot name="header-right" />
        </div>
      </div>
    </header>

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

    <!-- OpenLayers Map Overlay: Aircraft Detail HUD directly tethered to the plane -->
    <div ref="detailOverlayTarget" class="pointer-events-auto select-none">
      <AircraftDetailCard
        v-if="selectedAircraft"
        :aircraft="selectedAircraft"
        :is-following="isFollowingFlight"
        @close="handleCloseDetail"
        @toggle-follow="handleToggleFollow"
      />
    </div>

    <!-- OpenLayers Map Overlay: Drone Detail HUD directly tethered to the drone -->
    <div ref="droneOverlayTarget" class="pointer-events-auto select-none">
      <DroneDetailCard
        v-if="selectedDrone"
        :drone="selectedDrone"
        :is-following="isFollowingDrone"
        @close="handleCloseDroneDetail"
        @toggle-follow="handleToggleFollowDrone"
      />
    </div>

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
