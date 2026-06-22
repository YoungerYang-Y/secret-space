import { ref } from 'vue'
import { defineStore } from 'pinia'

export const useSceneStore = defineStore('scene', () => {
  const isReady = ref(false)
  const currentView = ref<'password' | 'loading' | 'scene'>('password')
  return { isReady, currentView }
})
