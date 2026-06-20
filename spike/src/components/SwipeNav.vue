<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { swipeToZone, zones } from '../pixiScene'
import { bus } from '../eventBus'

const isPortrait = ref(window.innerHeight > window.innerWidth)
const currentZone = ref(0)
const isZoomed = ref(false)
const panelOpen = ref(false)

let touchStartX = 0

function onResize() { isPortrait.value = window.innerHeight > window.innerWidth }
function onTouchStart(e: TouchEvent) { touchStartX = e.touches[0].clientX }
function onTouchEnd(e: TouchEvent) {
  if (!isZoomed.value || panelOpen.value) return
  const dx = e.changedTouches[0].clientX - touchStartX
  if (Math.abs(dx) > 50) swipeToZone(dx < 0 ? 'right' : 'left')
}

function onHotspotClick() { isZoomed.value = true; panelOpen.value = true }
function onPanelClose() { panelOpen.value = false }
function onCameraZoomIn({ zoneIndex }: { zoneIndex: number }) { currentZone.value = zoneIndex }

onMounted(() => {
  bus.on('hotspot:click', onHotspotClick)
  bus.on('panel:close', onPanelClose)
  bus.on('camera:zoomIn', onCameraZoomIn)
  window.addEventListener('resize', onResize)
  window.addEventListener('touchstart', onTouchStart)
  window.addEventListener('touchend', onTouchEnd)
})

onUnmounted(() => {
  bus.off('hotspot:click', onHotspotClick)
  bus.off('panel:close', onPanelClose)
  bus.off('camera:zoomIn', onCameraZoomIn)
  window.removeEventListener('resize', onResize)
  window.removeEventListener('touchstart', onTouchStart)
  window.removeEventListener('touchend', onTouchEnd)
})
</script>

<template>
  <div v-if="isPortrait && isZoomed" class="swipe-nav">
    <span v-for="(zone, i) in zones" :key="zone.id" :class="['dot', { active: i === currentZone }]" />
  </div>
  <div v-if="isPortrait" class="orientation-hint">
    📱 竖屏模式 — 点击物品 zoom-in 后左右滑动切换区域
  </div>
</template>

<style scoped>
.swipe-nav {
  position: fixed; bottom: 24px; left: 50%; transform: translateX(-50%);
  display: flex; gap: 8px; z-index: 50;
}
.dot {
  width: 10px; height: 10px; border-radius: 50%;
  background: rgba(255, 255, 255, 0.5); transition: background 0.3s;
}
.dot.active { background: #e91e63; }
.orientation-hint {
  position: fixed; top: 8px; left: 50%; transform: translateX(-50%);
  background: rgba(0, 0, 0, 0.6); color: #fff;
  padding: 6px 16px; border-radius: 20px; font-size: 12px; z-index: 50;
}
</style>
