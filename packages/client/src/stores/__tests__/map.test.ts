import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useMapStore } from '../map'

const mockProvinces = Array.from({ length: 34 }, (_, i) => ({
  code: `province${i}`,
  name: `省份${i}`,
  visited: i < 4,
  photoCount: i < 4 ? 3 : 0,
}))

global.fetch = vi.fn().mockResolvedValue({
  json: () => Promise.resolve(mockProvinces),
}) as any

describe('mapStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('fetchProvinces 填充 state', async () => {
    const store = useMapStore()
    await store.fetchProvinces()
    expect(store.provinces).toHaveLength(34)
  })

  it('visitedCount 计算正确', () => {
    const store = useMapStore()
    store.provinces = [
      { code: 'hunan', name: '湖南', visited: true, photoCount: 3 },
      { code: 'beijing', name: '北京', visited: false, photoCount: 0 },
    ]
    expect(store.visitedCount).toBe(1)
  })
})
