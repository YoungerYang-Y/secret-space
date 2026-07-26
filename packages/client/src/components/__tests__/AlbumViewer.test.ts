import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import AlbumViewer from '../AlbumViewer.vue'

// Mock page-flip since it requires DOM measurements
vi.mock('page-flip', () => ({
  PageFlip: vi.fn().mockImplementation(() => ({
    loadFromHTML: vi.fn(),
    on: vi.fn(),
    flipNext: vi.fn(),
    flipPrev: vi.fn(),
    destroy: vi.fn(),
  })),
}))

// Mock shared theme color
vi.mock('@secret-space/shared', () => ({
  useThemeColor: () => ({
    extractFromImage: vi.fn(),
    applyToElement: vi.fn(),
  }),
}))

// All URLs from API are short-lived signed URLs (not public URLs)
const album = {
  id: '1',
  year: 2024,
  title: '2024年的回忆',
  coverUrl: 'https://r2.example.com/read/albums/cover-1.webp?X-Amz-Expires=300&sig=cover-abc',
  createdAt: '',
}

const pages = [
  { id: 'p1', albumId: '1', order: 1, templateId: 'single', content: { images: ['https://r2.example.com/read/albums/img1.webp?X-Amz-Expires=300&sig=img1'] }, createdAt: '' },
  { id: 'p2', albumId: '1', order: 2, templateId: 'photo-text', content: { images: ['https://r2.example.com/read/albums/img2.webp?X-Amz-Expires=300&sig=img2'], text: '说明文字' }, createdAt: '' },
]

describe('AlbumViewer', () => {
  beforeEach(() => setActivePinia(createPinia()))

  it('renders cover page with album title', () => {
    const wrapper = mount(AlbumViewer, { props: { album, pages: [] } })
    expect(wrapper.text()).toContain('2024年的回忆')
    expect(wrapper.text()).toContain('2024')
  })

  it('renders correct template for each page', () => {
    const wrapper = mount(AlbumViewer, { props: { album, pages } })
    expect(wrapper.find('.template-single').exists()).toBe(true)
    expect(wrapper.find('.template-photo-text').exists()).toBe(true)
  })

  it('renders photo-text content correctly', () => {
    const wrapper = mount(AlbumViewer, { props: { album, pages } })
    expect(wrapper.text()).toContain('说明文字')
  })

  it('AC4: coverUrl 签名 URL 直接传给封面图片元素', () => {
    const wrapper = mount(AlbumViewer, { props: { album, pages } })
    // The cover page should use the signed coverUrl directly
    const html = wrapper.html()
    expect(html).toContain('https://r2.example.com/read/albums/cover-1.webp?X-Amz-Expires=300&amp;sig=cover-abc')
  })

  it('AC4: 页面图片使用 API 返回的签名 URL 作为 src，不自行生成 URL', () => {
    const wrapper = mount(AlbumViewer, { props: { album, pages } })
    const html = wrapper.html()
    // Page images should be the signed URLs from the API
    expect(html).toContain('https://r2.example.com/read/albums/img1.webp?X-Amz-Expires=300&amp;sig=img1')
    expect(html).toContain('https://r2.example.com/read/albums/img2.webp?X-Amz-Expires=300&amp;sig=img2')
    // Must NOT contain publicUrl or r2:// references
    expect(html).not.toContain('publicUrl')
    expect(html).not.toContain('r2://')
  })

  it('emits close on close button click', async () => {
    const wrapper = mount(AlbumViewer, { props: { album, pages: [] } })
    await wrapper.find('.album-close-btn').trigger('click')
    expect(wrapper.emitted('close')).toBeTruthy()
  })

  it('shows page indicator', () => {
    const wrapper = mount(AlbumViewer, { props: { album, pages } })
    // cover + 2 pages + back = 4
    expect(wrapper.text()).toContain('1 / 4')
  })
})
