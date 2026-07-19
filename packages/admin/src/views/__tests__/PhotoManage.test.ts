import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'

// Mock vue-router
vi.mock('vue-router', () => ({
  useRoute: () => ({ params: { code: 'hunan' } }),
  useRouter: () => ({ push: vi.fn() }),
}))

// Mock element-plus
const mockElMessage = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }))
vi.mock('element-plus', () => ({
  ElMessage: mockElMessage,
  ElMessageBox: { prompt: vi.fn(), confirm: vi.fn() },
}))

// Mock vuedraggable
vi.mock('vuedraggable', () => ({
  default: { template: '<div><slot name="item" v-for="item in modelValue" :element="item" /></div>', props: ['modelValue', 'itemKey'] },
}))

// Mock axios with vi.hoisted so factory can access it
const mockAxios = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
  delete: vi.fn(),
}))
vi.mock('axios', () => ({ default: mockAxios }))

import PhotoManage from '../PhotoManage.vue'

describe('PhotoManage upload flow', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    mockAxios.get.mockResolvedValue({ data: [] })
  })

  it('AC1: 上传按 presign → PUT → confirm → save 顺序，并只保存 mediaRef', async () => {
    mockAxios.post
      .mockResolvedValueOnce({
        data: { uploadUrl: 'https://r2.example.com/upload?token=abc', key: 'photos/hunan/123.webp', uploadExpiresIn: 600 },
      }) // presign
      .mockResolvedValueOnce({
        data: { mediaRef: 'media://photos/hunan/123.webp', readUrl: 'https://r2.example.com/read/123.webp?sig=xyz', readExpiresIn: 300 },
      }) // confirm
      .mockResolvedValueOnce({ data: { id: 1 } }) // save photo

    mockAxios.put.mockResolvedValueOnce({}) // PUT upload

    const wrapper = mount(PhotoManage)
    await flushPromises()

    // Simulate file upload
    const file = new File(['img-data'], 'test.jpg', { type: 'image/jpeg' })
    const input = wrapper.find('input[type="file"]')
    Object.defineProperty(input.element, 'files', { value: [file] })
    await input.trigger('change')
    await flushPromises()

    // Verify presign was called
    expect(mockAxios.post).toHaveBeenCalledWith(
      '/photos/presign',
      expect.objectContaining({ provinceCode: 'hunan', filename: 'test.jpg', contentType: 'image/jpeg' }),
      expect.objectContaining({ headers: expect.any(Object) }),
    )

    // Verify PUT to uploadUrl
    expect(mockAxios.put).toHaveBeenCalledWith(
      'https://r2.example.com/upload?token=abc',
      file,
      expect.objectContaining({ headers: { 'Content-Type': 'image/jpeg' } }),
    )

    // Verify confirm was called with key
    expect(mockAxios.post).toHaveBeenCalledWith(
      '/media/confirm',
      { key: 'photos/hunan/123.webp' },
      expect.objectContaining({ headers: expect.any(Object) }),
    )

    // Verify save uses mediaRef (not publicUrl)
    expect(mockAxios.post).toHaveBeenCalledWith(
      '/photos',
      expect.objectContaining({ provinceCode: 'hunan', mediaRef: 'media://photos/hunan/123.webp', order: 0 }),
      expect.objectContaining({ headers: expect.any(Object) }),
    )
  })

  it('AC2: 请求体不包含 publicUrl', async () => {
    mockAxios.post
      .mockResolvedValueOnce({
        data: { uploadUrl: 'https://r2.example.com/upload', key: 'photos/hunan/456.webp', uploadExpiresIn: 600 },
      })
      .mockResolvedValueOnce({
        data: { mediaRef: 'media://photos/hunan/456.webp', readUrl: 'https://r2.example.com/read/456.webp?sig=abc', readExpiresIn: 300 },
      })
      .mockResolvedValueOnce({ data: { id: 2 } })

    mockAxios.put.mockResolvedValueOnce({})

    const wrapper = mount(PhotoManage)
    await flushPromises()

    const file = new File(['img-data'], 'photo.jpg', { type: 'image/jpeg' })
    const input = wrapper.find('input[type="file"]')
    Object.defineProperty(input.element, 'files', { value: [file] })
    await input.trigger('change')
    await flushPromises()

    // The save call (3rd post call) must NOT contain publicUrl
    const saveCalls = mockAxios.post.mock.calls.filter(([url]: [string]) => url === '/photos')
    expect(saveCalls).toHaveLength(1)
    const savePayload = saveCalls[0][1]
    expect(savePayload).not.toHaveProperty('publicUrl')
    expect(savePayload).not.toHaveProperty('url')
    expect(savePayload).toHaveProperty('mediaRef')
  })

  it('AC3: 确认失败时显示错误且不发出保存请求', async () => {
    mockAxios.post
      .mockResolvedValueOnce({
        data: { uploadUrl: 'https://r2.example.com/upload', key: 'photos/hunan/789.webp', uploadExpiresIn: 600 },
      })
      .mockRejectedValueOnce(new Error('confirm failed')) // confirm fails

    mockAxios.put.mockResolvedValueOnce({})

    const wrapper = mount(PhotoManage)
    await flushPromises()

    const file = new File(['img-data'], 'bad.jpg', { type: 'image/jpeg' })
    const input = wrapper.find('input[type="file"]')
    Object.defineProperty(input.element, 'files', { value: [file] })
    await input.trigger('change')
    await flushPromises()

    // Should NOT have called /photos save
    const saveCalls = mockAxios.post.mock.calls.filter(([url]: [string]) => url === '/photos')
    expect(saveCalls).toHaveLength(0)

    // Should display error
    expect(mockElMessage.error).toHaveBeenCalledWith('上传失败')
  })
})
