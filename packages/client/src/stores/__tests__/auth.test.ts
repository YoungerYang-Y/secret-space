import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useAuthStore } from '../auth'

describe('AuthStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    localStorage.clear()
    vi.restoreAllMocks()
  })

  it('initially not authenticated', () => {
    const store = useAuthStore()
    expect(store.isAuthenticated).toBe(false)
    expect(store.role).toBeNull()
  })

  it('restores the session through the HttpOnly cookie rather than localStorage', async () => {
    localStorage.setItem('token', 'legacy-jwt')
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({ role: 'owner' }), { status: 200 }),
    )
    const store = useAuthStore()
    await expect(store.initSession()).resolves.toBe(true)
    expect(store.isAuthenticated).toBe(true)
    expect(store.role).toBe('owner')
    expect(fetchMock).toHaveBeenCalledWith('/api/auth/me', { credentials: 'same-origin' })
    expect(localStorage.getItem('token')).toBeNull()
  })

  it('does not authenticate when the server rejects the session cookie', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(new Response(null, { status: 401 }))
    const store = useAuthStore()
    await expect(store.initSession()).resolves.toBe(false)
    expect(store.isAuthenticated).toBe(false)
  })

  it('uses the role returned by cookie-backed login without storing a token', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({ role: 'visitor' }), { status: 200 }),
    )
    const store = useAuthStore()
    await expect(store.verify('guoguo123')).resolves.toEqual({ success: true })
    expect(store.isAuthenticated).toBe(true)
    expect(store.role).toBe('visitor')
    expect(fetchMock).toHaveBeenCalledWith('/api/auth/verify', expect.objectContaining({
      credentials: 'same-origin',
      body: JSON.stringify({ password: 'guoguo123' }),
    }))
    expect(localStorage.getItem('token')).toBeNull()
  })

  it('does not let a stale session restore overwrite a newer login', async () => {
    let resolveSession!: (response: Response) => void
    const fetchMock = vi.spyOn(globalThis, 'fetch')
      .mockImplementationOnce(() => new Promise<Response>((resolve) => { resolveSession = resolve }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ role: 'owner' }), { status: 200 }))
    const store = useAuthStore()

    const restoring = store.initSession()
    await expect(store.verify('guoguo123')).resolves.toEqual({ success: true })
    resolveSession(new Response(null, { status: 401 }))

    await expect(restoring).resolves.toBe(false)
    expect(store.role).toBe('owner')
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('does not let a rejected stale session restore overwrite a newer login', async () => {
    let rejectSession!: (error: Error) => void
    vi.spyOn(globalThis, 'fetch')
      .mockImplementationOnce(() => new Promise<Response>((_resolve, reject) => { rejectSession = reject }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ role: 'owner' }), { status: 200 }))
    const store = useAuthStore()

    const restoring = store.initSession()
    await expect(store.verify('guoguo123')).resolves.toEqual({ success: true })
    rejectSession(new Error('network failed'))

    await expect(restoring).resolves.toBe(false)
    expect(store.role).toBe('owner')
  })

  it('does not let a stale session restore re-authenticate after logout', async () => {
    let resolveSession!: (response: Response) => void
    vi.spyOn(globalThis, 'fetch')
      .mockImplementationOnce(() => new Promise<Response>((resolve) => { resolveSession = resolve }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ success: true }), { status: 200 }))
    const store = useAuthStore()

    const restoring = store.initSession()
    await store.logout()
    resolveSession(new Response(JSON.stringify({ role: 'owner' }), { status: 200 }))

    await expect(restoring).resolves.toBe(false)
    expect(store.role).toBeNull()
  })
})
