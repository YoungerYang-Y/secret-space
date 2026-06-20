<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'
import { initPixiScene, destroyPixiScene } from './pixiScene'
import OverlayPanel from './components/OverlayPanel.vue'
import SwipeNav from './components/SwipeNav.vue'
import RiveDebugPanel from './components/RiveDebugPanel.vue'

const canvasRef = ref<HTMLCanvasElement>()
const error = ref('')

onMounted(async () => {
  try {
    if (canvasRef.value) await initPixiScene(canvasRef.value)
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'PixiJS 初始化失败'
  }
})

onUnmounted(() => {
  destroyPixiScene()
})
</script>

<template>
  <div v-if="error" class="error">⚠️ {{ error }}</div>
  <canvas ref="canvasRef" />
  <OverlayPanel />
  <SwipeNav />
  <RiveDebugPanel />
</template>

<style>
* { margin: 0; padding: 0; box-sizing: border-box; }
html, body { overflow: hidden; width: 100%; height: 100%; }
canvas { display: block; }
.error {
  position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%);
  background: #fff; padding: 24px; border-radius: 12px; color: #d32f2f;
  box-shadow: 0 4px 16px rgba(0,0,0,0.1); z-index: 999;
}
</style>
