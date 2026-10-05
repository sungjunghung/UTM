<script setup lang="ts">
import { computed } from 'vue'
import MaterialIcon from '../MaterialIcon.vue'

const props = defineProps<{
  mouseCoord: [number, number] | null
  centerCoord: [number, number]
  zoom: number
}>()

// Calculate UTM Zone from Longitude
const utmZone = computed(() => {
  const lon = props.mouseCoord ? props.mouseCoord[0] : props.centerCoord[0]
  const zone = Math.floor((lon + 180) / 6) + 1
  const lat = props.mouseCoord ? props.mouseCoord[1] : props.centerCoord[1]
  const hemisphere = lat >= 0 ? 'N' : 'S'
  return `${zone}${hemisphere}`
})
</script>

<template>
  <div class="inline-flex items-center gap-3.5 px-3.5 py-2 rounded-md bg-base-100/90 backdrop-blur-md border border-base-300 shadow-xl text-sm font-mono text-base-content/90 select-none">
    <!-- Coordinates -->
    <div class="flex items-center gap-2">
      <MaterialIcon name="explore" :size="18" class="text-primary" />
      <span v-if="mouseCoord">
        <span class="text-base-content/60">Lon:</span> {{ mouseCoord[0].toFixed(5) }}°
        <span class="text-base-content/60 ml-1.5">Lat:</span> {{ mouseCoord[1].toFixed(5) }}°
      </span>
      <span v-else>
        <span class="text-base-content/60">Center:</span> {{ centerCoord[0].toFixed(4) }}°, {{ centerCoord[1].toFixed(4) }}°
      </span>
    </div>

    <div class="w-px h-3.5 bg-base-content/20"></div>

    <!-- UTM Zone -->
    <div class="hidden sm:flex items-center gap-1.5">
      <span class="badge badge-sm rounded-sm badge-primary font-bold">UTM</span>
      <span>Zone {{ utmZone }}</span>
    </div>

    <div class="w-px h-3 bg-base-content/20 hidden sm:block"></div>

    <!-- Zoom -->
    <div class="flex items-center gap-1">
      <span class="text-base-content/50">Zoom:</span>
      <span class="font-bold text-primary">{{ zoom }}</span>
    </div>
  </div>
</template>
