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

const album = { id: '1', year: 2024, title: '2024年的回忆', coverUrl: '/cover.jpg', createdAt: '' }
const pages = [
  { id: 'p1', albumId: '1', order: 1, templateId: 'single', content: { images: ['/img1.jpg'] }, createdAt: '' },
  { id: 'p2', albumId: '1', order: 2, templateId: 'photo-text', content: { images: ['/img2.jpg'], text: '说明文字' }, createdAt: '' },
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
