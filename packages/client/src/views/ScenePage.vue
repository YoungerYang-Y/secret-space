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
    <canvas ref="canvasRef"></canvas>
    <div v-if="!sceneStore.isReady" class="fallback">
      <p>需要支持 WebGL 的现代浏览器才能查看果果的小屋 🏠</p>
    </div>
    <MapOverlay :visible="mapVisible" @province-click="handleProvinceClick" />
    <div v-if="!mapVisible && sceneStore.isReady" class="map-entry" @click="handleZoomInWall">
      <img src="../assets/china-map.svg" alt="地图" class="map-entry-icon" />
      <span class="map-entry-label">足迹地图</span>
    </div>
    <PhotoPanel
      v-if="selectedProvince"
      :province-code="selectedProvince"
      :origin-rect="null"
      @close="handlePanelClose"
    />
    <button v-if="mapVisible && !selectedProvince" class="close-btn" @click="handleZoomOut">✕</button>
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
.map-entry {
  position: absolute;
  top: 15%;
  left: 12%;
  z-index: 5;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  transition: opacity 0.2s, transform 0.2s;
  /* 等距视角左墙倾斜 */
  transform: rotateX(10deg) rotateY(25deg) skewY(-15deg);
}
.map-entry:hover {
  opacity: 1;
  transform: rotateX(10deg) rotateY(25deg) skewY(-15deg) scale(1.05);
}
.map-entry-icon {
  width: 160px;
  height: 134px;
  filter: drop-shadow(0 2px 6px rgba(0,0,0,0.3));
  background: rgba(255,255,255,0.7);
  border-radius: 4px;
  padding: 8px;
}
.map-entry-label {
  font-size: 12px;
  color: #fff;
  text-shadow: 0 1px 3px rgba(0,0,0,0.6);
}
.close-btn {
  position: absolute;
  top: 16px;
  right: 16px;
  z-index: 25;
  background: rgba(255,255,255,0.9);
  border: none;
  border-radius: 50%;
  width: 36px;
  height: 36px;
  font-size: 18px;
  cursor: pointer;
  line-height: 36px;
  text-align: center;
}
</style>
