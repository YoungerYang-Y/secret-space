<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { useSceneStore } from '../stores/scene'
import { apiFetch } from '../utils/apiFetch'

const sceneStore = useSceneStore()
const tip = ref('正在打开果果的房间...')
const progress = ref(0)
let timer: ReturnType<typeof setInterval> | null = null

onMounted(async () => {
  // Fetch a random tip
  try {
    const res = await apiFetch('/api/tips/random')
    if (res.ok) {
      const data = await res.json()
      tip.value = data.text
    }
  } catch {}

  // Simulate loading progress (real asset loading would drive this)
  timer = setInterval(() => {
    progress.value += Math.random() * 15
    if (progress.value >= 100) {
      progress.value = 100
      clearInterval(timer!)
      setTimeout(() => { sceneStore.currentView = 'scene' }, 500)
    }
  }, 200)
})

onUnmounted(() => {
  if (timer) clearInterval(timer)
})
</script>

<template>
  <div class="loading-page">
    <div class="content">
      <div class="door-peek">🐱</div>
      <p class="tip">{{ tip }}</p>
      <div class="progress-bar">
        <div class="progress-fill" :style="{ width: progress + '%' }"></div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.loading-page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #1a1a2e;
  color: white;
}
.content { text-align: center; max-width: 300px; }
.door-peek { font-size: 64px; animation: peek 1.5s ease-in-out infinite; }
@keyframes peek {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-8px); }
}
.tip { font-size: 14px; color: #aaa; margin: 24px 0; }
.progress-bar {
  width: 100%;
  height: 4px;
  background: #333;
  border-radius: 2px;
  overflow: hidden;
}
.progress-fill {
  height: 100%;
  background: #f48fb1;
  transition: width 0.2s;
}
</style>
