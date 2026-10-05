<script setup lang="ts">
import { ref, onMounted } from 'vue'
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

// Counter demo
const count = ref(0)

import { computed } from 'vue'

// Material symbols filter demo
const searchQuery = ref('')
const sampleIcons = [
  'rocket_launch',
  'speed',
  'palette',
  'category',
  'deployed_code',
  'settings',
  'favorite',
  'bolt',
  'check_circle',
  'terminal',
  'widgets',
  'light_mode',
  'dark_mode',
  'dashboard',
  'tune',
  'search',
  'star',
  'notifications',
  'shopping_cart',
  'visibility',
  'sync',
  'layers',
  'code',
  'verified',
]

const copiedIcon = ref<string | null>(null)
function copyIconName(name: string) {
  navigator.clipboard?.writeText(name)
  copiedIcon.value = name
  setTimeout(() => {
    if (copiedIcon.value === name) copiedIcon.value = null
  }, 1800)
}

const filteredIcons = computed(() => {
  const query = searchQuery.value.trim().toLowerCase()
  if (!query) return sampleIcons
  return sampleIcons.filter((icon) => icon.toLowerCase().includes(query))
})
</script>

<template>
  <div class="min-h-screen flex flex-col bg-base-100 text-base-content transition-colors duration-200">
    <!-- Navbar -->
    <header class="navbar bg-base-200/80 backdrop-blur sticky top-0 z-50 px-4 lg:px-8 border-b border-base-300">
      <div class="flex-1 items-center gap-2">
        <div class="w-10 h-10 rounded-xl bg-primary text-primary-content flex items-center justify-center font-black shadow-md">
          <MaterialIcon name="deployed_code" :size="24" />
        </div>
        <div>
          <span class="font-extrabold text-xl tracking-tight bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
            UTM Frontend
          </span>
          <span class="hidden sm:inline-block badge badge-sm badge-outline ml-2 font-mono">v1.0.0</span>
        </div>
      </div>

      <div class="flex-none gap-2 items-center">
        <!-- Theme Dropdown -->
        <div class="dropdown dropdown-end">
          <div tabindex="0" role="button" class="btn btn-sm btn-ghost gap-1.5 border border-base-300">
            <MaterialIcon name="palette" :size="18" />
            <span class="capitalize hidden md:inline">{{ currentTheme }}</span>
            <MaterialIcon name="expand_more" :size="18" />
          </div>
          <ul
            tabindex="0"
            class="dropdown-content menu p-2 shadow-2xl bg-base-200 rounded-box w-52 max-h-96 overflow-y-auto z-[1] border border-base-300"
          >
            <li v-for="t in themes" :key="t">
              <button
                class="flex justify-between capitalize text-sm"
                :class="{ active: currentTheme === t }"
                @click="setTheme(t)"
              >
                <span>{{ t }}</span>
                <MaterialIcon v-if="currentTheme === t" name="check" :size="16" />
              </button>
            </li>
          </ul>
        </div>

        <a
          href="https://github.com"
          target="_blank"
          rel="noreferrer"
          class="btn btn-sm btn-circle btn-ghost"
          aria-label="GitHub"
        >
          <MaterialIcon name="code" :size="20" />
        </a>
      </div>
    </header>

    <!-- Main Content -->
    <main class="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 space-y-10">
      <!-- Hero -->
      <section class="hero bg-base-200 rounded-3xl p-6 sm:p-12 border border-base-300 relative overflow-hidden shadow-sm">
        <div class="hero-content flex-col lg:flex-row-reverse gap-8 lg:gap-16 w-full justify-between">
          <!-- Hero badge visual -->
          <div class="flex flex-col items-center justify-center p-6 bg-base-100 rounded-2xl border border-base-300 shadow-xl w-full lg:w-96 text-center space-y-4">
            <div class="w-20 h-20 rounded-2xl bg-gradient-to-tr from-primary to-accent flex items-center justify-center text-primary-content shadow-lg shadow-primary/20">
              <MaterialIcon name="rocket_launch" :size="44" />
            </div>
            <h3 class="font-bold text-lg">環境已就緒</h3>
            <p class="text-xs text-base-content/70">
              已成功配置 Vite, Vue 3, Tailwind CSS v4, daisyUI v5 與 Material Symbols！
            </p>
            <div class="flex items-center gap-2 w-full pt-2">
              <button class="btn btn-primary btn-sm flex-1 gap-1" @click="count++">
                <MaterialIcon name="add" :size="18" />
                點擊計數: {{ count }}
              </button>
              <button class="btn btn-outline btn-sm" @click="count = 0" title="重設">
                <MaterialIcon name="restart_alt" :size="18" />
              </button>
            </div>
          </div>

          <div class="space-y-4 text-center lg:text-left">
            <div class="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-semibold border border-primary/20">
              <MaterialIcon name="bolt" :size="16" />
              Next-Gen Frontend Stack
            </div>
            <h1 class="text-4xl sm:text-5xl font-extrabold tracking-tight leading-tight">
              打造極速現代化 <br class="hidden sm:inline" />
              <span class="bg-gradient-to-r from-primary via-secondary to-accent bg-clip-text text-transparent">
                Vue 3 前端專案
              </span>
            </h1>
            <p class="text-base-content/80 text-sm sm:text-base max-w-xl">
              以 Vite 驅動的高效能開發架構，結合 Tailwind CSS v4 的極速原生樣式引擎、daisyUI 的豐富語意化組件，以及 Google Material Symbols 精美圖標庫。
            </p>
            <div class="flex flex-wrap gap-3 justify-center lg:justify-start pt-2">
              <a href="#components" class="btn btn-primary gap-2">
                <MaterialIcon name="widgets" :size="20" />
                瀏覽組件範例
              </a>
              <a href="#icons" class="btn btn-neutral gap-2">
                <MaterialIcon name="category" :size="20" />
                圖標庫速查
              </a>
            </div>
          </div>
        </div>
      </section>

      <!-- Tech Stack Badges / Stats -->
      <section class="grid grid-cols-2 md:grid-cols-5 gap-3">
        <div class="stat bg-base-200 rounded-2xl border border-base-300 p-4">
          <div class="stat-figure text-primary">
            <MaterialIcon name="speed" :size="28" />
          </div>
          <div class="stat-title text-xs">Bundler</div>
          <div class="stat-value text-xl font-bold">Vite</div>
          <div class="stat-desc text-xs text-success flex items-center gap-1 mt-1">
            <MaterialIcon name="check_circle" :size="14" /> Ready
          </div>
        </div>

        <div class="stat bg-base-200 rounded-2xl border border-base-300 p-4">
          <div class="stat-figure text-secondary">
            <MaterialIcon name="deployed_code" :size="28" />
          </div>
          <div class="stat-title text-xs">Framework</div>
          <div class="stat-value text-xl font-bold">Vue 3</div>
          <div class="stat-desc text-xs text-success flex items-center gap-1 mt-1">
            <MaterialIcon name="check_circle" :size="14" /> Composition API
          </div>
        </div>

        <div class="stat bg-base-200 rounded-2xl border border-base-300 p-4">
          <div class="stat-figure text-accent">
            <MaterialIcon name="brush" :size="28" />
          </div>
          <div class="stat-title text-xs">Engine</div>
          <div class="stat-value text-xl font-bold">Tailwind v4</div>
          <div class="stat-desc text-xs text-success flex items-center gap-1 mt-1">
            <MaterialIcon name="check_circle" :size="14" /> CSS-First
          </div>
        </div>

        <div class="stat bg-base-200 rounded-2xl border border-base-300 p-4">
          <div class="stat-figure text-warning">
            <MaterialIcon name="palette" :size="28" />
          </div>
          <div class="stat-title text-xs">UI Library</div>
          <div class="stat-value text-xl font-bold">daisyUI v5</div>
          <div class="stat-desc text-xs text-success flex items-center gap-1 mt-1">
            <MaterialIcon name="check_circle" :size="14" /> 32+ Themes
          </div>
        </div>

        <div class="stat bg-base-200 rounded-2xl border border-base-300 p-4 col-span-2 md:col-span-1">
          <div class="stat-figure text-info">
            <MaterialIcon name="star" :size="28" />
          </div>
          <div class="stat-title text-xs">Icons</div>
          <div class="stat-value text-xl font-bold">Symbols</div>
          <div class="stat-desc text-xs text-success flex items-center gap-1 mt-1">
            <MaterialIcon name="check_circle" :size="14" /> Outlined WOFF2
          </div>
        </div>
      </section>

      <!-- daisyUI Component Gallery -->
      <section id="components" class="space-y-4">
        <div class="flex items-center justify-between">
          <div>
            <h2 class="text-2xl font-bold flex items-center gap-2">
              <MaterialIcon name="widgets" :size="26" class="text-primary" />
              daisyUI 常用組件範例
            </h2>
            <p class="text-xs sm:text-sm text-base-content/70">
              透過簡潔語意化 class 即刻使用按鈕、徽章、提示框與卡片
            </p>
          </div>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <!-- Buttons & Badges -->
          <div class="card bg-base-200 border border-base-300 shadow-sm">
            <div class="card-body space-y-3">
              <h3 class="card-title text-base font-bold flex items-center gap-2">
                <MaterialIcon name="smart_button" :size="20" class="text-primary" />
                Buttons & Badges
              </h3>
              <div class="flex flex-wrap gap-2">
                <button class="btn btn-primary btn-sm">Primary</button>
                <button class="btn btn-secondary btn-sm">Secondary</button>
                <button class="btn btn-accent btn-sm">Accent</button>
                <button class="btn btn-outline btn-sm">Outline</button>
                <button class="btn btn-ghost btn-sm">Ghost</button>
              </div>
              <div class="divider my-1"></div>
              <div class="flex flex-wrap gap-2">
                <span class="badge badge-primary">Primary</span>
                <span class="badge badge-secondary">Secondary</span>
                <span class="badge badge-accent">Accent</span>
                <span class="badge badge-info">Info</span>
                <span class="badge badge-success">Success</span>
                <span class="badge badge-warning">Warning</span>
                <span class="badge badge-error">Error</span>
              </div>
            </div>
          </div>

          <!-- Alert & Notification -->
          <div class="card bg-base-200 border border-base-300 shadow-sm">
            <div class="card-body space-y-3">
              <h3 class="card-title text-base font-bold flex items-center gap-2">
                <MaterialIcon name="notifications" :size="20" class="text-secondary" />
                Alerts & Feedback
              </h3>
              <div class="alert alert-info py-2 px-3 text-xs">
                <MaterialIcon name="info" :size="18" />
                <span>daisyUI 5 輕量且零依賴。</span>
              </div>
              <div class="alert alert-success py-2 px-3 text-xs">
                <MaterialIcon name="check_circle" :size="18" />
                <span>Tailwind CSS v4 整合運作順暢！</span>
              </div>
            </div>
          </div>

          <!-- Form Controls -->
          <div class="card bg-base-200 border border-base-300 shadow-sm">
            <div class="card-body space-y-3">
              <h3 class="card-title text-base font-bold flex items-center gap-2">
                <MaterialIcon name="tune" :size="20" class="text-accent" />
                Form & Controls
              </h3>
              <div class="flex items-center justify-between">
                <span class="text-sm">切換開關 (Toggle)</span>
                <input type="checkbox" class="toggle toggle-primary" checked />
              </div>
              <div class="flex items-center justify-between">
                <span class="text-sm">核取方塊 (Checkbox)</span>
                <input type="checkbox" class="checkbox checkbox-secondary checkbox-sm" checked />
              </div>
              <div>
                <input type="range" min="0" max="100" value="40" class="range range-accent range-xs" />
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- Material Symbols Showcase -->
      <section id="icons" class="space-y-4">
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h2 class="text-2xl font-bold flex items-center gap-2">
              <MaterialIcon name="category" :size="26" class="text-warning" />
              Material Symbols Outlined 圖標展示
            </h2>
            <p class="text-xs sm:text-sm text-base-content/70">
              點擊任意圖標即可複製名稱，或在專案中使用 &lt;MaterialIcon name="..." /&gt;
            </p>
          </div>
          <div v-if="copiedIcon" class="badge badge-success gap-1 text-xs py-3 px-3 animate-bounce">
            <MaterialIcon name="check" :size="16" />
            已複製: {{ copiedIcon }}
          </div>
        </div>

        <!-- Search bar -->
        <div class="flex items-center gap-2">
          <label class="input input-sm input-bordered flex items-center gap-2 w-full max-w-xs bg-base-100">
            <MaterialIcon name="search" :size="18" class="text-base-content/50" />
            <input
              v-model="searchQuery"
              type="text"
              class="grow placeholder:text-base-content/40"
              placeholder="搜尋圖標名稱 (例如: rocket)..."
            />
            <button
              v-if="searchQuery"
              class="btn btn-ghost btn-circle btn-xs"
              @click="searchQuery = ''"
            >
              <MaterialIcon name="close" :size="14" />
            </button>
          </label>
          <span class="text-xs text-base-content/60 font-mono">共 {{ filteredIcons.length }} 個</span>
        </div>

        <div class="bg-base-200 rounded-3xl p-6 border border-base-300">
          <div v-if="filteredIcons.length > 0" class="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-3">
            <button
              v-for="icon in filteredIcons"
              :key="icon"
              class="flex flex-col items-center justify-center p-3 rounded-xl bg-base-100 hover:bg-base-300 border border-base-300 transition-all hover:scale-105 active:scale-95 group text-center cursor-pointer"
              @click="copyIconName(icon)"
            >
              <MaterialIcon :name="icon" :size="28" class="text-primary group-hover:text-secondary transition-colors" />
              <span class="text-[11px] font-mono mt-2 truncate w-full text-base-content/80 group-hover:text-base-content">
                {{ icon }}
              </span>
            </button>
          </div>
          <div v-else class="text-center py-8 text-base-content/60 space-y-2">
            <MaterialIcon name="search_off" :size="36" />
            <p class="text-sm">找不到符合 "{{ searchQuery }}" 的圖標</p>
          </div>

          <!-- Code Snippet Usage -->
          <div class="mt-6 p-4 bg-base-300 rounded-2xl space-y-2">
            <div class="flex items-center gap-2 text-xs font-mono font-bold text-base-content/70">
              <MaterialIcon name="code" :size="16" />
              使用方式 (Usage Examples)
            </div>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs font-mono">
              <div class="bg-base-100 p-3 rounded-xl border border-base-content/10">
                <div class="text-base-content/60 mb-1">// 1. 使用封裝組件</div>
                <span class="text-primary">&lt;MaterialIcon</span> <span class="text-secondary">name=</span><span class="text-accent">"rocket_launch"</span> <span class="text-secondary">:size=</span><span class="text-accent">"24"</span> <span class="text-primary">/&gt;</span>
              </div>
              <div class="bg-base-100 p-3 rounded-xl border border-base-content/10">
                <div class="text-base-content/60 mb-1">// 2. 原生 HTML + class</div>
                <span class="text-primary">&lt;span</span> <span class="text-secondary">class=</span><span class="text-accent">"material-symbols-outlined"</span><span class="text-primary">&gt;</span>rocket_launch<span class="text-primary">&lt;/span&gt;</span>
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>

    <!-- Footer -->
    <footer class="footer footer-center p-6 bg-base-200 text-base-content/70 border-t border-base-300 text-xs mt-12">
      <div class="flex flex-col sm:flex-row items-center justify-between w-full max-w-7xl px-4 gap-4">
        <p class="flex items-center gap-1">
          <MaterialIcon name="favorite" :size="16" class="text-error" />
          UTM Project · Built with Vite + Vue + Tailwind CSS + daisyUI + Material Symbols
        </p>
        <div class="flex items-center gap-3">
          <span class="badge badge-sm badge-success gap-1">
            <MaterialIcon name="check" :size="12" /> Everything Ready
          </span>
        </div>
      </div>
    </footer>
  </div>
</template>
