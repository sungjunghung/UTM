<script setup lang="ts">
import MaterialIcon from '../MaterialIcon.vue'

defineProps<{
  mouseCoord: [number, number] | null
  centerCoord: [number, number]
  zoom: number
}>()
</script>

<template>
  <div class="inline-flex items-center gap-3.5 px-3.5 h-9 rounded-md bg-base-100/90 backdrop-blur-md border border-base-300 shadow-xl text-sm font-mono text-base-content/90 select-none">
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

    <!-- Zoom -->
    <div class="flex items-center gap-1">
      <span class="text-base-content/50">Zoom:</span>
      <span class="font-bold text-primary">{{ zoom }}</span>
    </div>
  </div>
</template>
