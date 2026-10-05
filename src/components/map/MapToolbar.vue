<script setup lang="ts">
import { ref } from 'vue'
import MaterialIcon from '../MaterialIcon.vue'

const emit = defineEmits<{
  (e: 'zoomIn'): void
  (e: 'zoomOut'): void
  (e: 'resetView'): void
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
</script>

<template>
  <div class="flex items-center select-none">
    <!-- Map Navigation & Zoom Controls (Horizontal join group) -->
    <div class="join join-horizontal shadow-xl bg-base-100/90 backdrop-blur-md border border-base-300 rounded-md overflow-hidden">
      <button
        class="btn btn-sm btn-ghost join-item px-2.5 h-9 min-h-0 hover:bg-primary hover:text-primary-content transition-colors"
        title="放大 (Zoom In)"
        @click="emit('zoomIn')"
      >
        <MaterialIcon name="add" :size="18" />
      </button>
      <button
        class="btn btn-sm btn-ghost join-item px-2.5 h-9 min-h-0 hover:bg-primary hover:text-primary-content transition-colors"
        title="縮小 (Zoom Out)"
        @click="emit('zoomOut')"
      >
        <MaterialIcon name="remove" :size="18" />
      </button>
      <button
        class="btn btn-sm btn-ghost join-item px-2.5 h-9 min-h-0 hover:bg-primary hover:text-primary-content transition-colors"
        title="重設視角 (Reset View)"
        @click="emit('resetView')"
      >
        <MaterialIcon name="my_location" :size="18" />
      </button>
      <button
        class="btn btn-sm btn-ghost join-item px-2.5 h-9 min-h-0 hover:bg-primary hover:text-primary-content transition-colors"
        :title="isFullscreen ? '結束全螢幕' : '全螢幕檢視'"
        @click="toggleFullscreen"
      >
        <MaterialIcon :name="isFullscreen ? 'fullscreen_exit' : 'fullscreen'" :size="18" />
      </button>
    </div>
  </div>
</template>
