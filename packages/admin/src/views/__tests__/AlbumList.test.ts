import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'

// Mock vue-router
vi.mock('vue-router', () => ({
  useRouter: () => ({ push: vi.fn() }),
}))

// Mock element-plus
const mockElMessage = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }))
vi.mock('element-plus', () => ({
  ElMessage: mockElMessage,
  ElMessageBox: { confirm: vi.fn().mockResolvedValue(undefined) },
}))

// Mock compress util
vi.mock('../../utils/compress', () => ({
  compressImage: vi.fn((file: File) => Promise.resolve(file)),
}))

// Mock axios
const mockAxios = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
  delete: vi.fn(),
}))
vi.mock('axios', () => ({ default: mockAxios }))

import AlbumList from '../AlbumList.vue'

describe('AlbumList cover upload flow', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    mockAxios.get.mockResolvedValue({ data: [] })
    global.fetch = vi.fn().mockResolvedValue({ ok: true })
  })

  const mountOptions = {
    global: {
      stubs: {
        'el-table': { template: '<div class="el-table-stub"></div>', props: ['data'] },
        'el-table-column': true,
        'el-button': { template: '<button><slot /></button>' },
        'el-dialog': { template: '<div><slot /><slot name="footer" /></div>' },
        'el-form': { template: '<div><slot /></div>' },
        'el-form-item': { template: '<div><slot /></div>' },
        'el-input': { template: '<input />' },
        'el-input-number': { template: '<input type="number" />' },
        'el-image': { template: '<img />' },
        'el-upload': { template: '<div><slot /></div>' },
      },
    },
  }

  it('AC1: 封面上传按 presign → PUT → confirm 顺序，预览使用 readUrl', async () => {
    mockAxios.post
      .mockResolvedValueOnce({
        data: { uploadUrl: 'https://r2.example.com/upload-cover', key: 'albums/cover-123.webp', uploadExpiresIn: 600 },
      }) // presign
      .mockResolvedValueOnce({
        data: { mediaRef: 'media://albums/cover-123.webp', readUrl: 'https://r2.example.com/read/cover-123.webp?sig=def', readExpiresIn: 300 },
      }) // confirm

    const wrapper = mount(AlbumList, mountOptions)
    await flushPromises()

    // Simulate the cover upload by calling the exposed handler
    const file = new File(['cover-data'], 'cover.webp', { type: 'image/webp' })
    const vm = wrapper.vm as any
    await vm.handleCoverUpload(file)
    await flushPromises()

    // Verify presign called
    expect(mockAxios.post).toHaveBeenCalledWith(
      '/albums/presign',
      expect.objectContaining({ contentType: 'image/webp' }),
      expect.objectContaining({ headers: expect.any(Object) }),
    )

    // Verify PUT upload via fetch
    expect(global.fetch).toHaveBeenCalledWith(
      'https://r2.example.com/upload-cover',
      expect.objectContaining({ method: 'PUT', body: expect.anything() }),
    )

    // Verify confirm called with key
    expect(mockAxios.post).toHaveBeenCalledWith(
      '/media/confirm',
      { key: 'albums/cover-123.webp' },
      expect.objectContaining({ headers: expect.any(Object) }),
    )

    // AC2: Preview uses readUrl, form stores coverRef
    expect(vm.form.coverPreviewUrl).toBe('https://r2.example.com/read/cover-123.webp?sig=def')
    expect(vm.form.coverRef).toBe('media://albums/cover-123.webp')
  })

  it('AC2: submit 时发送 coverRef 而非 publicUrl/coverUrl', async () => {
    mockAxios.post.mockResolvedValue({ data: { id: 'album-1' } })

    const wrapper = mount(AlbumList, mountOptions)
    await flushPromises()

    const vm = wrapper.vm as any
    vm.openCreate()
    vm.form.year = 2024
    vm.form.title = '测试相册'
    vm.form.coverRef = 'media://albums/cover-test.webp'
    vm.form.coverPreviewUrl = 'https://r2.example.com/read/cover-test.webp?sig=abc'
    await vm.handleSubmit()
    await flushPromises()

    // Find the create post call
    const albumCalls = mockAxios.post.mock.calls.filter(([url]: [string]) => url === '/albums')
    expect(albumCalls.length).toBeGreaterThan(0)
    const payload = albumCalls[0][1]
    expect(payload).toHaveProperty('coverRef', 'media://albums/cover-test.webp')
    expect(payload).not.toHaveProperty('coverUrl')
    expect(payload).not.toHaveProperty('publicUrl')
  })

  it('AC3: 确认失败时显示错误且不更新表单状态', async () => {
    mockAxios.post
      .mockResolvedValueOnce({
        data: { uploadUrl: 'https://r2.example.com/upload-cover', key: 'albums/cover-fail.webp', uploadExpiresIn: 600 },
      })
      .mockRejectedValueOnce(new Error('confirm error'))

    const wrapper = mount(AlbumList, mountOptions)
    await flushPromises()

    const vm = wrapper.vm as any
    vm.openCreate()
    await vm.handleCoverUpload(new File(['data'], 'fail.webp', { type: 'image/webp' }))
    await flushPromises()

    expect(mockElMessage.error).toHaveBeenCalledWith('封面上传失败')
    expect(vm.form.coverRef).toBeFalsy()
  })
})
