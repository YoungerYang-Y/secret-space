import { ref, computed } from 'vue'
import { defineStore } from 'pinia'
import axios from 'axios'

export const useAdminAuthStore = defineStore('admin-auth', () => {
  const token = ref<string | null>(localStorage.getItem('admin_token'))
  const isAuthenticated = computed(() => !!token.value)

  async function login(password: string) {
    const res = await axios.post('/auth/verify', { password })
    if (res.data.role !== 'admin') {
      throw new Error('需要管理员权限')
    }
    token.value = res.data.token
    localStorage.setItem('admin_token', res.data.token)
  }

  function logout() {
    token.value = null
    localStorage.removeItem('admin_token')
  }

  return { token, isAuthenticated, login, logout }
})
