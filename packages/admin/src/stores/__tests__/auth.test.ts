import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useAdminAuthStore } from '../auth'

vi.mock('axios', () => ({
  default: {
    post: vi.fn().mockResolvedValue({ data: { token: 'mock-token', role: 'admin' } }),
  },
}))

describe('admin auth store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    localStorage.clear()
  })

  it('login 成功存储 token', async () => {
    const store = useAdminAuthStore()
    await store.login('admin888')
    expect(store.token).toBe('mock-token')
    expect(store.isAuthenticated).toBe(true)
    expect(localStorage.getItem('admin_token')).toBe('mock-token')
  })

  it('logout 清除 token', async () => {
    const store = useAdminAuthStore()
    await store.login('admin888')
    store.logout()
    expect(store.token).toBeNull()
    expect(store.isAuthenticated).toBe(false)
  })
})
