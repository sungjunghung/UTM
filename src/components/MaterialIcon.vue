<script setup lang="ts">
withDefaults(
  defineProps<{
    name: string
    size?: number | string
    fill?: boolean
  }>(),
  {
    fill: false,
  }
)
</script>

<template>
  <span
    class="material-symbols-outlined select-none inline-flex items-center justify-center leading-none"
    :style="{
      fontSize: typeof size === 'number' ? `${size}px` : size,
      fontVariationSettings: fill ? `'FILL' 1` : `'FILL' 0`,
    }"
  >
    {{ name }}
  </span>
</template>
