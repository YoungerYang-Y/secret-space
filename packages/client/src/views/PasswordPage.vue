<script setup lang="ts">
import { ref } from 'vue'
import { useAuthStore } from '../stores/auth'
import { useSceneStore } from '../stores/scene'

const authStore = useAuthStore()
const sceneStore = useSceneStore()
const password = ref('')
const error = ref('')
const loading = ref(false)

async function submit() {
  if (!password.value) return
  loading.value = true
  error.value = ''
  const result = await authStore.verify(password.value)
  loading.value = false
  if (result.success) {
    sceneStore.currentView = 'loading'
  } else {
    error.value = result.message || '密码不对哦'
    password.value = ''
  }
}
</script>

<template>
  <div class="password-page">
    <div class="card">
      <h1>🏠 果果的秘密空间</h1>
      <p class="subtitle">输入密码进入果果的小屋</p>
      <form @submit.prevent="submit">
        <input
          v-model="password"
          type="password"
          placeholder="请输入密码"
          autofocus
          :disabled="loading"
        />
        <button type="submit" :disabled="loading || !password">
          {{ loading ? '验证中...' : '开门' }}
        </button>
      </form>
      <p v-if="error" class="error">{{ error }}</p>
    </div>
  </div>
</template>

<style scoped>
.password-page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #fce4ec, #f3e5f5);
}
.card {
  background: white;
  border-radius: 24px;
  padding: 48px 40px;
  text-align: center;
  box-shadow: 0 8px 32px rgba(0,0,0,0.1);
  max-width: 360px;
  width: 90%;
}
h1 { font-size: 24px; margin: 0 0 8px; }
.subtitle { color: #888; margin: 0 0 24px; font-size: 14px; }
input {
  width: 100%;
  padding: 12px 16px;
  border: 2px solid #eee;
  border-radius: 12px;
  font-size: 16px;
  outline: none;
  transition: border-color 0.2s;
  box-sizing: border-box;
}
input:focus { border-color: #f48fb1; }
button {
  width: 100%;
  margin-top: 16px;
  padding: 12px;
  border: none;
  border-radius: 12px;
  background: #f48fb1;
  color: white;
  font-size: 16px;
  cursor: pointer;
  transition: opacity 0.2s;
}
button:disabled { opacity: 0.5; cursor: not-allowed; }
button:hover:not(:disabled) { opacity: 0.9; }
.error { color: #e53935; margin-top: 12px; font-size: 14px; }
</style>
