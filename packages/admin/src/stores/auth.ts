import { ref, computed } from 'vue'
import { defineStore } from 'pinia'
import axios from 'axios'

export const useAdminAuthStore = defineStore('admin-auth', () => {
  const role = ref<string | null>(null)
  const initialized = ref(false)

  const isAuthenticated = computed(() => !!role.value)

  async function login(password: string) {
    const res = await axios.post('/auth/verify', { password })
    if (res.data.role !== 'admin') {
      throw new Error('需要管理员权限')
    }
    role.value = res.data.role
    initialized.value = true
  }

  async function logout() {
    await axios.post('/auth/logout', {})
    role.value = null
    initialized.value = false
  }

  async function initSession(force = false) {
    if (!force && initialized.value) {
      return
    }

    try {
      const res = await axios.get('/auth/me')
      role.value = res.data.role
    } catch {
      role.value = null
    } finally {
      initialized.value = true
    }
  }

  return { role, initialized, isAuthenticated, login, logout, initSession }
})
