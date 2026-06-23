<script setup lang="ts">
import { ref, onMounted, onUnmounted, reactive } from 'vue'
import { SceneManager } from '../pixi/SceneManager'
import { CameraController } from '../pixi/CameraController'
import { useSceneStore } from '../stores/scene'
import MapOverlay from '../components/MapOverlay.vue'
import PhotoPanel from '../components/PhotoPanel.vue'

const sceneStore = useSceneStore()
const canvasRef = ref<HTMLCanvasElement>()
const sm = new SceneManager()
let camera: CameraController | null = null

const mapVisible = ref(false)
const selectedProvince = ref<string | null>(null)

onMounted(async () => {
  if (canvasRef.value) {
    try {
      await sm.init(canvasRef.value)
      camera = new CameraController(sm.world, {
        viewportWidth: window.innerWidth,
        viewportHeight: window.innerHeight,
      })
      sceneStore.isReady = true
    } catch (e) {
      console.warn('WebGL not available:', e)
    }
  }
})

onUnmounted(() => { sm.destroy() })

function handleZoomInWall() {
  if (!camera) return
  camera.zoomIn('wall')
  mapVisible.value = true
}

function handleZoomOut() {
  if (!camera) return
  camera.zoomOut()
  mapVisible.value = false
  selectedProvince.value = null
}

function handleProvinceClick(code: string) {
  selectedProvince.value = code
}

function handlePanelClose() {
  selectedProvince.value = null
}
</script>

<template>
  <div class="scene-page">
    <canvas ref="canvasRef" @dblclick="handleZoomInWall"></canvas>
    <div v-if="!sceneStore.isReady" class="fallback">
      <p>需要支持 WebGL 的现代浏览器才能查看果果的小屋 🏠</p>
    </div>
    <MapOverlay :visible="mapVisible" @province-click="handleProvinceClick" />
    <PhotoPanel
      v-if="selectedProvince"
      :province-code="selectedProvince"
      :origin-rect="null"
      @close="handlePanelClose"
    />
    <button v-if="mapVisible && !selectedProvince" class="back-btn" @click="handleZoomOut">← 返回</button>
  </div>
</template>

<style scoped>
.scene-page {
  position: relative;
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
.back-btn {
  position: absolute;
  top: 16px;
  left: 16px;
  z-index: 25;
  background: rgba(255,255,255,0.9);
  border: none;
  border-radius: 20px;
  padding: 8px 16px;
  font-size: 14px;
  cursor: pointer;
}
</style>
