import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useAlbumStore } from '../album'

const mockAlbums = [
  { id: '1', year: 2023, title: null, coverUrl: null, createdAt: '2024-01-01' },
  { id: '2', year: 2024, title: '2024年的回忆', coverUrl: '/cover.jpg', createdAt: '2024-06-01' },
]

global.fetch = vi.fn().mockResolvedValue({
  ok: true,
  json: () => Promise.resolve(mockAlbums),
}) as any

describe('albumStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.mocked(fetch).mockResolvedValue({ ok: true, json: () => Promise.resolve(mockAlbums) } as any)
  })

  it('fetchAlbums populates state', async () => {
    const store = useAlbumStore()
    await store.fetchAlbums()
    expect(store.albums).toHaveLength(2)
    expect(store.albums[0].year).toBe(2023)
  })

  it('getSpineColor returns consistent color for same year', () => {
    const store = useAlbumStore()
    const c1 = store.getSpineColor(2024)
    const c2 = store.getSpineColor(2024)
    expect(c1).toBe(c2)
  })

  it('getSpineColor returns different colors for adjacent years', () => {
    const store = useAlbumStore()
    const c1 = store.getSpineColor(2024)
    const c2 = store.getSpineColor(2025)
    expect(c1).not.toBe(c2)
  })

  it('fetchPages parses JSON content', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve([
        { id: 'p1', albumId: '1', order: 1, templateId: 'single', content: '{"images":["a.jpg"]}', createdAt: '' },
      ]),
    } as any)
    const store = useAlbumStore()
    await store.fetchPages('1')
    expect(store.currentPages[0].content.images).toEqual(['a.jpg'])
  })
})
