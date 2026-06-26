import { ref, computed } from 'vue'
import { defineStore } from 'pinia'
import type { AuthVerifyResponse } from '@secret-space/shared'
import { AuthRole } from '@secret-space/shared'

export const useAuthStore = defineStore('auth', () => {
  const token = ref<string | null>(null)
  const role = ref<'owner' | 'visitor' | null>(null)
  const isAuthenticated = computed(() => token.value !== null)

  function checkExisting(): boolean {
    const stored = localStorage.getItem('token')
    if (!stored) return false
    try {
      const payload = JSON.parse(atob(stored.split('.')[1]))
      if (payload.exp && payload.exp < Date.now() / 1000) {
        localStorage.removeItem('token')
        return false
      }
      token.value = stored
      role.value = payload.role
      return true
    } catch {
      localStorage.removeItem('token')
      return false
    }
  }

  async function verify(password: string): Promise<{ success: boolean; message?: string; retryAfter?: number }> {
    try {
      const res = await fetch('/api/auth/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      })
      if (res.ok) {
        const data = await res.json()
        token.value = data.token
        role.value = data.role
        localStorage.setItem('token', data.token)
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

  function logout(): void {
    token.value = null
    role.value = null
    localStorage.removeItem('token')
  }

  return { token, role, isAuthenticated, checkExisting, verify, logout }
})
