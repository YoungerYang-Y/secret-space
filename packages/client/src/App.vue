<script setup lang="ts">
import { onMounted } from 'vue'
import { useAuthStore } from './stores/auth'
import { useSceneStore } from './stores/scene'
import PasswordPage from './views/PasswordPage.vue'
import LoadingPage from './views/LoadingPage.vue'
import ScenePage from './views/ScenePage.vue'

const authStore = useAuthStore()
const sceneStore = useSceneStore()

onMounted(() => {
  if (authStore.checkExisting()) {
    sceneStore.currentView = 'loading'
  }
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
