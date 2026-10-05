<script setup lang="ts">
import { ref, onMounted } from 'vue'
import MapView from './components/map/MapView.vue'
import MaterialIcon from './components/MaterialIcon.vue'

// Theme handling
const themes = [
  'light',
  'dark',
  'cupcake',
  'bumblebee',
  'emerald',
  'corporate',
  'synthwave',
  'retro',
  'cyberpunk',
  'valentine',
  'halloween',
  'garden',
  'forest',
  'aqua',
  'lofi',
  'pastel',
  'fantasy',
  'wireframe',
  'black',
  'luxury',
  'dracula',
  'cmyk',
  'autumn',
  'business',
  'acid',
  'lemonade',
  'night',
  'coffee',
  'winter',
  'dim',
  'nord',
  'sunset',
]

const currentTheme = ref('light')

function setTheme(theme: string) {
  currentTheme.value = theme
  document.documentElement.setAttribute('data-theme', theme)
  localStorage.setItem('utm-theme', theme)
}

onMounted(() => {
  const saved = localStorage.getItem('utm-theme')
  if (saved && themes.includes(saved)) {
    setTheme(saved)
  } else if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
    setTheme('dark')
  } else {
    setTheme('light')
  }
})
</script>

<template>
  <div class="relative w-screen h-screen overflow-hidden flex flex-col bg-base-100 text-base-content">
    <!-- Fullscreen Map Component (Fills 100% of viewport) -->
    <main class="w-full h-full flex-1">
      <MapView>
        <!-- Theme Picker & Action Icons -->
        <template #header-right>
          <div class="dropdown dropdown-end">
            <div
              tabindex="0"
              role="button"
              class="btn btn-sm px-3 rounded-2xl bg-base-100/90 backdrop-blur-md border border-base-300 shadow-xl gap-1.5"
            >
              <MaterialIcon name="palette" :size="16" />
              <span class="capitalize text-xs hidden sm:inline">{{ currentTheme }}</span>
              <MaterialIcon name="expand_more" :size="16" />
            </div>
            <ul
              tabindex="0"
              class="dropdown-content menu p-2 shadow-2xl bg-base-200/95 backdrop-blur-md rounded-2xl w-48 max-h-80 overflow-y-auto z-50 border border-base-300 text-xs"
            >
              <li v-for="t in themes" :key="t">
                <button
                  class="flex justify-between capitalize"
                  :class="{ active: currentTheme === t }"
                  @click="setTheme(t)"
                >
                  <span>{{ t }}</span>
                  <MaterialIcon v-if="currentTheme === t" name="check" :size="14" />
                </button>
              </li>
            </ul>
          </div>
        </template>
      </MapView>
    </main>
  </div>
</template>
