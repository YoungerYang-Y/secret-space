import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'

// Mock vue-router
vi.mock('vue-router', () => ({
  useRoute: () => ({ params: { id: 'album-1' } }),
}))

// Mock element-plus
const mockElMessage = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }))
vi.mock('element-plus', () => ({
  ElMessage: mockElMessage,
}))

// Mock vuedraggable
vi.mock('vuedraggable', () => ({
  default: { template: '<div><slot name="item" v-for="item in modelValue" :element="item" /></div>', props: ['modelValue', 'itemKey'] },
}))

// Mock compress
vi.mock('../../utils/compress', () => ({
  compressImage: vi.fn((file: File) => Promise.resolve(file)),
}))

// Mock AlbumPreview
vi.mock('../../components/AlbumPreview.vue', () => ({
  default: { template: '<div class="mock-preview" />' },
}))

// Mock axios
const mockAxios = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
  delete: vi.fn(),
}))
vi.mock('axios', () => ({ default: mockAxios }))

import PageEditor from '../PageEditor.vue'

describe('PageEditor image upload flow', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    global.fetch = vi.fn().mockResolvedValue({ ok: true })
    mockAxios.get.mockImplementation((url: string) => {
      if (url.includes('/pages')) {
        return Promise.resolve({
          data: [{ id: 'p1', order: 1, templateId: 'single', content: { images: [''], text: '' } }],
        })
      }
      if (url.includes('/albums')) {
        return Promise.resolve({
          data: [{ id: 'album-1', year: 2024, title: '测试', coverUrl: null }],
        })
      }
      return Promise.resolve({ data: [] })
    })
  })

  it('AC1: 页面图片上传按 presign → PUT → confirm → save 顺序，保存 uploadReceipt', async () => {
    mockAxios.post
      .mockResolvedValueOnce({
        data: { uploadUrl: 'https://r2.example.com/upload-page', key: 'photos/album/page-img.webp', uploadExpiresIn: 600 },
      }) // presign
      .mockResolvedValueOnce({
        data: { uploadReceipt: 'receipt-page-img', readUrl: 'https://r2.example.com/read/page-img.webp?sig=page', readExpiresIn: 300 },
      }) // confirm

    mockAxios.put.mockResolvedValueOnce({ data: { content: { images: ['https://r2.example.com/read/page-img.webp?sig=page'] } } }) // save page

    const wrapper = mount(PageEditor)
    await flushPromises()

    const vm = wrapper.vm as any
    expect(vm.selectedPage).toBeTruthy()

    // Upload image to slot 0
    const file = new File(['page-img'], 'page.webp', { type: 'image/webp' })
    await vm.uploadImage(file, 0)
    await flushPromises()

    // Verify presign
    expect(mockAxios.post).toHaveBeenCalledWith(
      '/albums/presign',
      expect.objectContaining({ contentType: 'image/webp' }),
    )

    // Verify PUT via fetch
    expect(global.fetch).toHaveBeenCalledWith(
      'https://r2.example.com/upload-page',
      expect.objectContaining({ method: 'PUT' }),
    )

    // Verify confirm
    expect(mockAxios.post).toHaveBeenCalledWith(
      '/media/confirm',
      { key: 'photos/album/page-img.webp' },
    )

    // Verify page save uses the opaque receipt, never a media:// reference
    expect(mockAxios.put).toHaveBeenCalledWith(
      '/pages/p1',
      expect.objectContaining({
        content: expect.objectContaining({
          imageReceipts: ['receipt-page-img'],
        }),
      }),
    )
  })

  it('AC2: 预览使用 readUrl，save 使用 receipt，state 不含 publicUrl 或 media://', async () => {
    mockAxios.post
      .mockResolvedValueOnce({
        data: { uploadUrl: 'https://r2.example.com/upload-page2', key: 'photos/album/page-img2.webp', uploadExpiresIn: 600 },
      })
      .mockResolvedValueOnce({
        data: { uploadReceipt: 'receipt-page-img2', readUrl: 'https://r2.example.com/read/page-img2.webp?sig=x', readExpiresIn: 300 },
      })

    mockAxios.put.mockResolvedValueOnce({ data: { content: { images: ['https://r2.example.com/read/page-img2.webp?sig=x'] } } })

    const wrapper = mount(PageEditor)
    await flushPromises()

    const vm = wrapper.vm as any
    const file = new File(['data'], 'img.webp', { type: 'image/webp' })
    await vm.uploadImage(file, 0)
    await flushPromises()

    // The preview URL in the component should be the readUrl
    expect(vm.selectedPage.content.previewUrls[0]).toBe('https://r2.example.com/read/page-img2.webp?sig=x')
    expect(vm.selectedPage.content.imageReceipts[0]).toBeNull()

    // Nothing should contain publicUrl
    const pageStr = JSON.stringify(vm.selectedPage)
    expect(pageStr).not.toContain('publicUrl')
    expect(pageStr).not.toContain('r2://')
    expect(pageStr).not.toContain('media://')
  })

  it('AC3: 确认失败时显示错误且不发出保存请求', async () => {
    mockAxios.post
      .mockResolvedValueOnce({
        data: { uploadUrl: 'https://r2.example.com/upload-fail', key: 'photos/album/fail.webp', uploadExpiresIn: 600 },
      })
      .mockRejectedValueOnce(new Error('confirm failed'))

    const wrapper = mount(PageEditor)
    await flushPromises()

    const vm = wrapper.vm as any
    const file = new File(['data'], 'fail.webp', { type: 'image/webp' })
    await vm.uploadImage(file, 0)
    await flushPromises()

    // Save should NOT be called
    expect(mockAxios.put).not.toHaveBeenCalled()
    expect(mockElMessage.error).toHaveBeenCalledWith('上传失败')
  })

  it('新页面没有完成全部图片上传时不会提交空 receipt', async () => {
    const wrapper = mount(PageEditor)
    await flushPromises()

    const vm = wrapper.vm as any
    await vm.addPage()

    expect(mockAxios.post).not.toHaveBeenCalledWith(
      '/albums/album-1/pages',
      expect.anything(),
    )
    expect(mockElMessage.error).toHaveBeenCalledWith('请先上传全部图片')
  })

  it('拖拽排序成功后同步本地页面序号', async () => {
    mockAxios.put.mockResolvedValueOnce({ data: {} })
    const wrapper = mount(PageEditor)
    await flushPromises()
    const vm = wrapper.vm as any
    vm.pages = [
      { ...vm.pages[0], id: 'p2', order: 2 },
      { ...vm.pages[0], id: 'p1', order: 1 },
    ]

    await vm.handleDragEnd()

    expect(vm.pages.map((page: { order: number }) => page.order)).toEqual([1, 2])
  })
})
