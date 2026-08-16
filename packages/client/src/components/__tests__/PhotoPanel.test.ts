import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import PhotoPanel from '../PhotoPanel.vue'

// The API returns short-lived signed URLs (not public URLs)
const mockPhotos = [
  { id: 1, url: 'https://r2.example.com/read/photos/hunan/1.webp?X-Amz-Expires=300&sig=abc123', annotation: '橘子洲', order: 1 },
  { id: 2, url: 'https://r2.example.com/read/photos/hunan/2.webp?X-Amz-Expires=300&sig=def456', annotation: null, order: 2 },
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

  it('AC4: 图片元素直接使用 API 返回的短期签名 URL 作为 src', async () => {
    const wrapper = mount(PhotoPanel, { props: { provinceCode: 'hunan', originRect: null } })
    await flushPromises()
    const imgs = wrapper.findAll('img')
    expect(imgs[0].attributes('src')).toBe('https://r2.example.com/read/photos/hunan/1.webp?X-Amz-Expires=300&sig=abc123')
    expect(imgs[1].attributes('src')).toBe('https://r2.example.com/read/photos/hunan/2.webp?X-Amz-Expires=300&sig=def456')
  })

  it('AC4: 组件不生成或修改 URL，不持久化 URL', async () => {
    const wrapper = mount(PhotoPanel, { props: { provinceCode: 'hunan', originRect: null } })
    await flushPromises()
    // The component simply passes through the url from the API response
    // It should NOT contain any publicUrl or r2:// references
    const html = wrapper.html()
    expect(html).not.toContain('publicUrl')
    expect(html).not.toContain('r2://')
    // URLs must be the exact signed ones from the API
    expect(html).toContain('X-Amz-Expires=300')
  })

  it('空照片显示提示文案', async () => {
    const wrapper = mount(PhotoPanel, { props: { provinceCode: 'guangxi', originRect: null } })
    await flushPromises()
    expect(wrapper.text()).toContain('还没有照片')
  })

  it('展示当前省份标题', async () => {
    const wrapper = mount(PhotoPanel, {
      props: { provinceCode: 'hunan', provinceName: '湖南', originRect: null },
    })
    await flushPromises()
    expect(wrapper.text()).toContain('湖南')
  })

  it('请求失败时显示错误状态而不是空状态', async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce({ ok: false, json: () => Promise.resolve({}) } as Response)
    const wrapper = mount(PhotoPanel, { props: { provinceCode: 'hunan', originRect: null } })
    await flushPromises()
    expect(wrapper.text()).toContain('照片加载失败')
    expect(wrapper.text()).not.toContain('还没有照片')
  })

  it('省份切换后忽略先前请求的延迟响应', async () => {
    let resolveHunan!: (response: Response) => void
    vi.mocked(global.fetch)
      .mockImplementationOnce(() => new Promise<Response>((resolve) => { resolveHunan = resolve }))
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve([{ id: 3, url: 'guangxi.jpg', annotation: null, order: 1 }]),
      } as Response)
    const wrapper = mount(PhotoPanel, { props: { provinceCode: 'hunan', originRect: null } })
    await wrapper.setProps({ provinceCode: 'guangxi' })
    await flushPromises()
    resolveHunan({ ok: true, json: () => Promise.resolve(mockPhotos) } as Response)
    await flushPromises()

    expect(wrapper.findAll('img')).toHaveLength(1)
    expect(wrapper.find('img').attributes('src')).toBe('guangxi.jpg')
  })

  it('旧请求结束时不会关闭当前省份的加载状态', async () => {
    let resolveHunan!: (response: Response) => void
    let resolveGuangxi!: (response: Response) => void
    vi.mocked(global.fetch)
      .mockImplementationOnce(() => new Promise<Response>((resolve) => { resolveHunan = resolve }))
      .mockImplementationOnce(() => new Promise<Response>((resolve) => { resolveGuangxi = resolve }))

    const wrapper = mount(PhotoPanel, { props: { provinceCode: 'hunan', originRect: null } })
    await wrapper.setProps({ provinceCode: 'guangxi' })
    resolveHunan({ ok: true, json: () => Promise.resolve(mockPhotos) } as Response)
    await flushPromises()

    expect(wrapper.text()).toContain('正在加载照片')

    resolveGuangxi({ ok: true, json: () => Promise.resolve([]) } as Response)
    await flushPromises()

    expect(wrapper.text()).toContain('还没有照片')
    expect(wrapper.text()).not.toContain('正在加载照片')
  })

  it('点击关闭按钮触发 close', async () => {
    const wrapper = mount(PhotoPanel, { props: { provinceCode: 'hunan', originRect: null } })
    await flushPromises()
    await wrapper.find('.photo-panel-close').trigger('click')
    expect(wrapper.emitted('close')).toBeTruthy()
  })
})
