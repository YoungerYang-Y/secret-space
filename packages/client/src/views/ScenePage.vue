<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { SceneManager } from '../pixi/SceneManager'
import { useSceneStore } from '../stores/scene'

const sceneStore = useSceneStore()
const canvasRef = ref<HTMLCanvasElement>()
const sm = new SceneManager()

onMounted(async () => {
  if (canvasRef.value) {
    try {
      await sm.init(canvasRef.value)
      sceneStore.isReady = true
    } catch (e) {
      console.warn('WebGL not available:', e)
    }
  }
})

onUnmounted(() => { sm.destroy() })
</script>

<template>
  <div class="scene-page">
    <canvas ref="canvasRef"></canvas>
    <div v-if="!sceneStore.isReady" class="fallback">
      <p>需要支持 WebGL 的现代浏览器才能查看果果的小屋 🏠</p>
    </div>
  </div>
</template>

<style scoped>
.scene-page {
  width: 100vw;
  height: 100vh;
  overflow: hidden;
  background: #000;
}
canvas {
  display: block;
  width: 100%;
  height: 100%;
}
.fallback {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-size: 16px;
}
</style>
