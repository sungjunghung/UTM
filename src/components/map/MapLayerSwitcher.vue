<script setup lang="ts">
import { computed } from 'vue'
import type { BaseLayerType, CartoTone } from '../../services/map/types'
import satelliteThumb from '../../assets/map/satellite.jpg'
import mapThumb from '../../assets/map/map.png'

const props = defineProps<{
  currentLayer: BaseLayerType
  tone: CartoTone
}>()

const emit = defineEmits<{
  (e: 'switchLayer', layer: BaseLayerType): void
  (e: 'update:tone', tone: CartoTone): void
}>()

const isSatellite = computed(() => props.currentLayer === 'satellite')

// Slider snaps to these three stops (index = slider value)
const TONE_STOPS: { label: string; value: CartoTone }[] = [
  { label: '淺色', value: 'light' },
  { label: '灰色', value: 'gray' },
  { label: '深色', value: 'dark' },
]

const toneIndex = computed(() => Math.max(0, TONE_STOPS.findIndex((s) => s.value === props.tone)))

function toggleLayer() {
  if (isSatellite.value) {
    emit('switchLayer', 'carto')
  } else {
    emit('switchLayer', 'satellite')
  }
}

function onToneInput(evt: Event) {
  const stop = TONE_STOPS[Number((evt.target as HTMLInputElement).value)]
  if (stop) emit('update:tone', stop.value)
}
</script>

<template>
  <div class="flex items-end gap-2">
    <button
      type="button"
      class="group relative w-15 h-15 shrink-0 rounded-xl overflow-hidden cursor-pointer shadow-2xl border-2 border-white/90 dark:border-base-100 hover:border-primary hover:scale-105 active:scale-95 transition-all duration-200 select-none bg-base-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
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

    <!-- Base map tone slider (淺色 / 灰色 / 深色): only for the standard map, hidden on satellite -->
    <transition
      enter-active-class="transition duration-200 ease-out"
      enter-from-class="opacity-0 -translate-x-2"
      enter-to-class="opacity-100 translate-x-0"
      leave-active-class="transition duration-150 ease-in"
      leave-from-class="opacity-100 translate-x-0"
      leave-to-class="opacity-0 -translate-x-2"
    >
      <div
        v-if="!isSatellite"
        class="tone-panel h-15 w-40 px-1 flex flex-col justify-center gap-1.5"
      >
        <input
          type="range"
          min="0"
          :max="TONE_STOPS.length - 1"
          step="1"
          :value="toneIndex"
          class="tone-range w-full"
          aria-label="底圖色調"
          :aria-valuetext="TONE_STOPS[toneIndex].label"
          @input="onToneInput"
        />
        <div class="flex justify-between text-[11px] leading-none font-semibold">
          <button
            v-for="stop in TONE_STOPS"
            :key="stop.value"
            type="button"
            class="cursor-pointer transition-colors hover:text-primary"
            :class="tone === stop.value ? 'opacity-100' : 'opacity-60'"
            @click="emit('update:tone', stop.value)"
          >
            {{ stop.label }}
          </button>
        </div>
      </div>
    </transition>
  </div>
</template>

<style scoped>
/* No panel background: labels float on the map, so give them a halo to stay legible on any tone */
.tone-panel {
  color: #fff;
  text-shadow:
    0 0 2px rgb(0 0 0 / 0.9),
    0 1px 3px rgb(0 0 0 / 0.6);
}

/* Track previews the tone it controls: light → gray → dark */
.tone-range {
  appearance: none;
  height: 6px;
  border-radius: 9999px;
  background: linear-gradient(90deg, #f5f5f3 0%, #c3c3c1 50%, #22272f 100%);
  box-shadow: inset 0 0 0 1px rgb(0 0 0 / 0.15);
  cursor: pointer;
  outline: none;
}

.tone-range:focus-visible {
  box-shadow:
    inset 0 0 0 1px rgb(0 0 0 / 0.15),
    0 0 0 2px var(--color-primary);
}

.tone-range::-webkit-slider-thumb {
  appearance: none;
  width: 16px;
  height: 16px;
  border-radius: 9999px;
  background: var(--color-primary);
  border: 2px solid #fff;
  box-shadow: 0 1px 4px rgb(0 0 0 / 0.4);
}

.tone-range::-moz-range-thumb {
  width: 16px;
  height: 16px;
  border-radius: 9999px;
  background: var(--color-primary);
  border: 2px solid #fff;
  box-shadow: 0 1px 4px rgb(0 0 0 / 0.4);
}
</style>
