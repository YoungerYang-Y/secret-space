<script setup lang="ts">
import { onMounted } from 'vue'
import { useAuthStore } from './stores/auth'
import { useSceneStore } from './stores/scene'
import { audioManager } from './audio/AudioManager'
import PasswordPage from './views/PasswordPage.vue'
import LoadingPage from './views/LoadingPage.vue'
import ScenePage from './views/ScenePage.vue'

const authStore = useAuthStore()
const sceneStore = useSceneStore()

onMounted(() => {
  if (authStore.checkExisting()) {
    sceneStore.currentView = 'loading'
  }

  // 首次用户交互时解锁 AudioContext（浏览器自动播放策略要求）
  const events = ['click', 'touchstart', 'keydown'] as const
  function unlockOnce() {
    audioManager.unlock()
    events.forEach(e => document.removeEventListener(e, unlockOnce))
  }
  events.forEach(e => document.addEventListener(e, unlockOnce, { once: true }))
})
</script>

<template>
  <PasswordPage v-if="sceneStore.currentView === 'password'" />
  <LoadingPage v-else-if="sceneStore.currentView === 'loading'" />
  <ScenePage v-else />
</template>

<style>
* { margin: 0; padding: 0; box-sizing: border-box; }
body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; }
</style>
