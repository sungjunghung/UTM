<script setup lang="ts">
import { computed } from 'vue'
import type { BaseLayerType } from '../../services/map/types'
import satelliteThumb from '../../assets/map/satellite.jpg'
import mapThumb from '../../assets/map/map.png'

const props = defineProps<{
  currentLayer: BaseLayerType
}>()

const emit = defineEmits<{
  (e: 'switchLayer', layer: BaseLayerType): void
}>()

const isSatellite = computed(() => props.currentLayer === 'satellite')

function toggleLayer() {
  if (isSatellite.value) {
    emit('switchLayer', 'osm-dark')
  } else {
    emit('switchLayer', 'satellite')
  }
}
</script>

<template>
  <button
    type="button"
    class="group relative w-15 h-15 rounded-xl overflow-hidden cursor-pointer shadow-2xl border-2 border-white/90 dark:border-base-100 hover:border-primary hover:scale-105 active:scale-95 transition-all duration-200 select-none bg-base-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
    :title="isSatellite ? '切換為標準地圖' : '切換為衛星空照圖'"
    @click="toggleLayer"
  >
    <!-- Thumbnail Preview (Google Maps style: shows the target layer to switch to) -->
    <img
      :src="isSatellite ? mapThumb : satelliteThumb"
      :alt="isSatellite ? '地圖預覽' : '空照圖預覽'"
      class="w-full h-full object-cover transition-transform duration-300 group-hover:scale-110"
    />

    <!-- Semi-transparent bottom label -->
    <div
      class="absolute bottom-0 inset-x-0 py-0.5 bg-black/65 backdrop-blur-xs text-white text-[11px] font-semibold text-center tracking-wide group-hover:bg-primary group-hover:text-primary-content transition-colors"
    >
      {{ isSatellite ? '地圖' : '空照圖' }}
    </div>

    <!-- Active Indicator Corner Glow -->
    <div
      v-if="isSatellite"
      class="absolute top-1 right-1 w-2 h-2 rounded-full bg-cyan-400 ring-2 ring-black/40 shadow-sm"
    ></div>
  </button>
</template>
