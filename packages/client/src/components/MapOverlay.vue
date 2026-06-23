<script setup lang="ts">
import { onMounted, ref, watch, nextTick } from 'vue'
import { useMapStore } from '../stores/map'
import chinaSvg from '../assets/china-map.svg?raw'

defineProps<{
  visible: boolean
}>()

const emit = defineEmits<{
  'province-click': [code: string]
}>()

const mapStore = useMapStore()
const svgContainer = ref<HTMLDivElement>()

onMounted(async () => {
  if (mapStore.provinces.length === 0) {
    await mapStore.fetchProvinces()
  }
  applyVisitedClasses()
})

watch(() => mapStore.provinces, () => {
  nextTick(() => applyVisitedClasses())
}, { deep: true })

function applyVisitedClasses() {
  if (!svgContainer.value) return
  const paths = svgContainer.value.querySelectorAll('[data-code]')
  paths.forEach((el) => {
    const code = el.getAttribute('data-code')!
    el.classList.toggle('visited', mapStore.provinces.some((p) => p.code === code && p.visited))
  })
}

function handleClick(e: MouseEvent) {
  const target = (e.target as SVGElement).closest('[data-code]')
  if (!target) return
  const code = target.getAttribute('data-code')!
  if (target.classList.contains('visited')) {
    emit('province-click', code)
  }
}
</script>

<template>
  <div
    v-show="visible"
    class="map-overlay"
    @click="handleClick"
  >
    <div
      ref="svgContainer"
      class="map-svg"
      v-html="chinaSvg"
    />
    <div class="map-header">
      <span class="map-title">我们的足迹</span>
      <span class="map-count">{{ mapStore.visitedCount }}/34</span>
    </div>
  </div>
</template>

<style scoped>
.map-overlay {
  position: absolute;
  inset: 0;
  z-index: 10;
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: auto;
  background: rgba(255, 255, 255, 0.92);
}

.map-header {
  position: absolute;
  top: 16px;
  left: 16px;
}

.map-title {
  font-size: 18px;
  font-weight: bold;
  color: #333;
}

.map-count {
  margin-left: 8px;
  font-size: 14px;
  color: #666;
}

.map-svg {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.map-svg :deep(svg) {
  max-width: 100%;
  max-height: 100vh;
  object-fit: contain;
}

.map-svg :deep(path[data-code]) {
  fill: #e0e0e0;
  transition: fill 0.2s;
  cursor: default;
}

.map-svg :deep(path[data-code].visited) {
  fill: #ff9a76;
  cursor: pointer;
}

.map-svg :deep(path[data-code].visited:hover) {
  fill: #ff6f3c;
}
</style>
