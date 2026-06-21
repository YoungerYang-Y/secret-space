import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useAuthStore } from '../auth'

function createMockJwt(payload: Record<string, unknown>): string {
  const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
  const body = btoa(JSON.stringify(payload))
  return `${header}.${body}.mock-signature`
}

describe('AuthStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    localStorage.clear()
  })

  it('initially not authenticated', () => {
    const store = useAuthStore()
    expect(store.isAuthenticated).toBe(false)
    expect(store.token).toBeNull()
  })

  it('checkExisting returns true for valid token', () => {
    const token = createMockJwt({ role: 'owner', exp: Date.now() / 1000 + 86400 })
    localStorage.setItem('token', token)
    const store = useAuthStore()
    expect(store.checkExisting()).toBe(true)
    expect(store.isAuthenticated).toBe(true)
    expect(store.role).toBe('owner')
  })

  it('checkExisting clears expired token', () => {
    const token = createMockJwt({ role: 'owner', exp: Date.now() / 1000 - 100 })
    localStorage.setItem('token', token)
    const store = useAuthStore()
    expect(store.checkExisting()).toBe(false)
    expect(localStorage.getItem('token')).toBeNull()
  })

  it('logout clears state and localStorage', () => {
    const token = createMockJwt({ role: 'owner', exp: Date.now() / 1000 + 86400 })
    localStorage.setItem('token', token)
    const store = useAuthStore()
    store.checkExisting()
    store.logout()
    expect(store.isAuthenticated).toBe(false)
    expect(store.token).toBeNull()
    expect(localStorage.getItem('token')).toBeNull()
  })
})
