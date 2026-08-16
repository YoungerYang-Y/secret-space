import { ref, computed } from 'vue'
import { defineStore } from 'pinia'

export const useAuthStore = defineStore('auth', () => {
  const role = ref<'owner' | 'visitor' | null>(null)
  const isAuthenticated = computed(() => role.value !== null)
  let operationVersion = 0

  async function initSession(): Promise<boolean> {
    const version = ++operationVersion
    localStorage.removeItem('token')
    try {
      const res = await fetch('/api/auth/me', { credentials: 'same-origin' })
      if (version !== operationVersion) return false
      if (!res.ok) {
        role.value = null
        return false
      }
      const data = await res.json()
      if (version !== operationVersion) return false
      if (data.role !== 'owner' && data.role !== 'visitor') {
        role.value = null
        return false
      }
      role.value = data.role
      return true
    } catch {
      if (version !== operationVersion) return false
      role.value = null
      return false
    }
  }

  async function verify(password: string): Promise<{ success: boolean; message?: string; retryAfter?: number }> {
    const version = ++operationVersion
    localStorage.removeItem('token')
    try {
      const res = await fetch('/api/auth/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
        credentials: 'same-origin',
      })
      if (res.ok) {
        const data = await res.json()
        if (version !== operationVersion) return { success: false, message: '认证请求已失效' }
        if (data.role !== 'owner' && data.role !== 'visitor') {
          return { success: false, message: data.role === 'admin' ? '请使用管理后台登录' : '认证响应无效' }
        }
        role.value = data.role
        return { success: true }
      }
      const err = await res.json()
      if (res.status === 429) {
        return { success: false, message: err.message, retryAfter: err.retryAfter }
      }
      return { success: false, message: err.message }
    } catch {
      return { success: false, message: '网络异常' }
    }
  }

  async function logout(): Promise<void> {
    const version = ++operationVersion
    localStorage.removeItem('token')
    role.value = null
    try {
      await fetch('/api/auth/logout', { method: 'POST', credentials: 'same-origin' })
    } finally {
      if (version === operationVersion) {
        localStorage.removeItem('token')
        role.value = null
      }
    }
  }

  return { role, isAuthenticated, initSession, verify, logout }
})
