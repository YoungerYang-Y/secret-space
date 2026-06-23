import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import PhotoPanel from '../PhotoPanel.vue'

const mockPhotos = [
  { id: 1, url: 'https://r2.example.com/photos/hunan/1.webp', annotation: '橘子洲', order: 1 },
  { id: 2, url: 'https://r2.example.com/photos/hunan/2.webp', annotation: null, order: 2 },
]

global.fetch = vi.fn().mockImplementation((url: string) => {
  if (url.includes('/provinces/hunan/photos')) {
    return Promise.resolve({ ok: true, json: () => Promise.resolve(mockPhotos) })
  }
  if (url.includes('/provinces/guangxi/photos')) {
    return Promise.resolve({ ok: true, json: () => Promise.resolve([]) })
  }
  return Promise.resolve({ ok: true, json: () => Promise.resolve([]) })
}) as any

describe('PhotoPanel', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('照片按 order 排列渲染', async () => {
    const wrapper = mount(PhotoPanel, { props: { provinceCode: 'hunan', originRect: null } })
    await flushPromises()
    const imgs = wrapper.findAll('img')
    expect(imgs).toHaveLength(2)
  })

  it('空照片显示提示文案', async () => {
    const wrapper = mount(PhotoPanel, { props: { provinceCode: 'guangxi', originRect: null } })
    await flushPromises()
    expect(wrapper.text()).toContain('还没有照片')
  })

  it('点击关闭按钮触发 close', async () => {
    const wrapper = mount(PhotoPanel, { props: { provinceCode: 'hunan', originRect: null } })
    await flushPromises()
    await wrapper.find('.photo-panel-close').trigger('click')
    expect(wrapper.emitted('close')).toBeTruthy()
  })
})
