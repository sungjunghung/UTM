<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  pitchDeg: number // -90 to +90 (degrees, nose down is negative, nose up is positive)
  rollDeg: number // -180 to +180 (degrees, bank angle)
  yawDeg?: number
  size?: number
}>()

const indicatorSize = computed(() => props.size || 140)

// Pitch displacement: 1 degree pitch = ~1.3 pixels movement of the horizon line
const pitchOffset = computed(() => {
  // Constrain pitch display within visual circle bounds
  const clamped = Math.max(-45, Math.min(45, props.pitchDeg))
  return clamped * 1.3
})
</script>

<template>
  <div
    class="relative rounded-full overflow-hidden select-none bg-slate-950 border-2 border-slate-700/80 shadow-inner shrink-0"
    :style="{
      width: `${indicatorSize}px`,
      height: `${indicatorSize}px`,
    }"
    :title="`姿態儀 (ADI / Horizon): 俯仰 Pitch ${pitchDeg.toFixed(1)}°, 橫滾 Roll ${rollDeg.toFixed(1)}°`"
  >
    <!-- Rotating Horizon Sphere Container (Rotates by Roll) -->
    <div
      class="absolute inset-0 w-full h-full transition-transform duration-75 ease-linear pointer-events-none"
      :style="{
        transform: `rotate(${-rollDeg}deg)`,
        transformOrigin: '50% 50%',
      }"
    >
      <!-- Pitch Translation Container (Translates by Pitch offset) -->
      <div
        class="absolute -top-[100%] -left-[100%] w-[300%] h-[300%] transition-transform duration-75 ease-linear flex flex-col"
        :style="{
          transform: `translateY(${pitchOffset}px)`,
          transformOrigin: '50% 50%',
        }"
      >
        <!-- Sky Half (High-tech Blue / Sky) -->
        <div
          class="w-full h-1/2 relative"
          style="background: linear-gradient(to top, #0284c7, #0369a1)"
        >
          <!-- Sky Pitch Ladder Marks (5°, 10°, 15°, 20°) -->
          <div class="absolute bottom-0 w-full flex flex-col items-center gap-[13px] pb-[13px]">
            <!-- 20 deg pitch line -->
            <div class="flex items-center gap-1.5 opacity-90">
              <span class="text-[8px] font-mono text-white font-bold">20</span>
              <div class="w-8 h-[1.5px] bg-white"></div>
              <span class="text-[8px] font-mono text-white font-bold">20</span>
            </div>
            <!-- 10 deg pitch line -->
            <div class="flex items-center gap-1.5 opacity-90">
              <span class="text-[8px] font-mono text-white font-bold">10</span>
              <div class="w-12 h-[1.5px] bg-white"></div>
              <span class="text-[8px] font-mono text-white font-bold">10</span>
            </div>
          </div>
        </div>

        <!-- Ground Half (Earth Brown / Charcoal Dark) -->
        <div
          class="w-full h-1/2 relative border-t-2 border-white shadow-[0_0_8px_rgba(255,255,255,0.8)]"
          style="background: linear-gradient(to bottom, #92400e, #78350f)"
        >
          <!-- Ground Pitch Ladder Marks (-10°, -20°) -->
          <div class="absolute top-0 w-full flex flex-col items-center gap-[13px] pt-[13px]">
            <!-- -10 deg pitch line -->
            <div class="flex items-center gap-1.5 opacity-90">
              <span class="text-[8px] font-mono text-white/90 font-bold">10</span>
              <div class="w-12 h-[1.5px] bg-white/90 border-t border-dashed"></div>
              <span class="text-[8px] font-mono text-white/90 font-bold">10</span>
            </div>
            <!-- -20 deg pitch line -->
            <div class="flex items-center gap-1.5 opacity-90">
              <span class="text-[8px] font-mono text-white/90 font-bold">20</span>
              <div class="w-8 h-[1.5px] bg-white/90 border-t border-dashed"></div>
              <span class="text-[8px] font-mono text-white/90 font-bold">20</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Fixed Glass Bezel Overlay: Bank Angle Index Marks (0°, ±10°, ±20°, ±30°, ±45°, ±60°) -->
    <svg class="absolute inset-0 w-full h-full pointer-events-none z-10" viewBox="0 0 140 140">
      <!-- Top Center Triangle (0° Roll Index) -->
      <polygon points="70,10 66,16 74,16" fill="#fbbf24" stroke="#000" stroke-width="0.5" />

      <!-- Fixed Bank Tick Marks at 10, 20, 30, 45, 60 deg -->
      <line x1="70" y1="4" x2="70" y2="10" stroke="#facc15" stroke-width="2" />
      <line x1="70" y1="4" x2="70" y2="9" stroke="#ffffff" stroke-width="1.2" transform="rotate(10 70 70)" />
      <line x1="70" y1="4" x2="70" y2="9" stroke="#ffffff" stroke-width="1.2" transform="rotate(-10 70 70)" />
      <line x1="70" y1="4" x2="70" y2="10" stroke="#ffffff" stroke-width="1.5" transform="rotate(20 70 70)" />
      <line x1="70" y1="4" x2="70" y2="10" stroke="#ffffff" stroke-width="1.5" transform="rotate(-20 70 70)" />
      <line x1="70" y1="4" x2="70" y2="11" stroke="#facc15" stroke-width="1.8" transform="rotate(30 70 70)" />
      <line x1="70" y1="4" x2="70" y2="11" stroke="#facc15" stroke-width="1.8" transform="rotate(-30 70 70)" />
      <line x1="70" y1="4" x2="70" y2="12" stroke="#ffffff" stroke-width="1.8" transform="rotate(45 70 70)" />
      <line x1="70" y1="4" x2="70" y2="12" stroke="#ffffff" stroke-width="1.8" transform="rotate(-45 70 70)" />
    </svg>

    <!-- Fixed Center Aircraft Symbol (Yellow Crosshair / Wings) -->
    <div class="absolute inset-0 flex items-center justify-center pointer-events-none z-20">
      <svg width="70" height="30" viewBox="0 0 70 30" class="drop-shadow-md">
        <!-- Left Wing -->
        <path d="M 5 15 L 25 15 L 25 18 L 5 18 Z" fill="#fbbf24" stroke="#000000" stroke-width="0.8" />
        <!-- Right Wing -->
        <path d="M 45 15 L 65 15 L 65 18 L 45 18 Z" fill="#fbbf24" stroke="#000000" stroke-width="0.8" />
        <!-- Center Reticle Pip -->
        <circle cx="35" cy="15" r="2.5" fill="#fbbf24" stroke="#000000" stroke-width="0.8" />
      </svg>
    </div>

    <!-- HUD Real-time Pitch & Roll Values (Bottom & Corner readout) -->
    <div class="absolute bottom-1 left-0 right-0 flex items-center justify-between px-2 text-xs font-mono font-bold text-white/90 z-30 drop-shadow">
      <span class="bg-black/60 px-1.5 py-0.5 rounded">P: {{ pitchDeg > 0 ? '+' : '' }}{{ pitchDeg.toFixed(1) }}°</span>
      <span class="bg-black/60 px-1.5 py-0.5 rounded">R: {{ rollDeg > 0 ? '+' : '' }}{{ rollDeg.toFixed(1) }}°</span>
    </div>
  </div>
</template>
