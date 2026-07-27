import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useAdminAuthStore } from '../auth'
import axios from 'axios'

vi.mock('axios', () => ({
  default: {
    post: vi.fn(),
    get: vi.fn(),
    defaults: { withCredentials: false },
  },
}))

const mockedAxios = vi.mocked(axios)

describe('admin auth store (session-based)', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    localStorage.clear()
    vi.clearAllMocks()
  })

  describe('login', () => {
    it('login 成功后 role 有值，localStorage 无 admin_token', async () => {
      mockedAxios.post.mockResolvedValueOnce({ data: { role: 'admin' } })
      const store = useAdminAuthStore()
      await store.login('admin888')
      expect(store.role).toBe('admin')
      expect(store.isAuthenticated).toBe(true)
      expect(localStorage.getItem('admin_token')).toBeNull()
    })

    it('login 非 admin 角色抛出错误', async () => {
      mockedAxios.post.mockResolvedValueOnce({ data: { role: 'visitor' } })
      const store = useAdminAuthStore()
      await expect(store.login('visitor666')).rejects.toThrow('需要管理员权限')
    })
  })

  describe('logout', () => {
    it('logout 清除 role 并调用 /auth/logout', async () => {
      mockedAxios.post.mockResolvedValue({ data: { role: 'admin' } })
      const store = useAdminAuthStore()
      await store.login('admin888')

      mockedAxios.post.mockResolvedValueOnce({ data: { success: true } })
      await store.logout()

      expect(store.role).toBeNull()
      expect(store.isAuthenticated).toBe(false)
      expect(store.initialized).toBe(false)
      expect(mockedAxios.post).toHaveBeenCalledWith('/auth/logout', {})
    })
  })

  describe('initSession', () => {
    it('initSession 成功设置 role', async () => {
      mockedAxios.get.mockResolvedValueOnce({ data: { role: 'admin' } })
      const store = useAdminAuthStore()
      await store.initSession()
      expect(store.role).toBe('admin')
      expect(store.initialized).toBe(true)
    })

    it('initSession 失败设置 null', async () => {
      mockedAxios.get.mockRejectedValueOnce({ response: { status: 401 } })
      const store = useAdminAuthStore()
      await store.initSession()
      expect(store.role).toBeNull()
      expect(store.initialized).toBe(true)
    })

    it('initSession 带缓存，不重复请求', async () => {
      mockedAxios.get.mockResolvedValue({ data: { role: 'admin' } })
      const store = useAdminAuthStore()

      await store.initSession()
      await store.initSession()
      await store.initSession()

      expect(mockedAxios.get).toHaveBeenCalledTimes(1)
    })

    it('initSession force=true 强制刷新', async () => {
      mockedAxios.get.mockResolvedValue({ data: { role: 'admin' } })
      const store = useAdminAuthStore()

      await store.initSession()
      await store.initSession(true)

      expect(mockedAxios.get).toHaveBeenCalledTimes(2)
    })
  })
})
