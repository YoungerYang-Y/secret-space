export const MEDIA_STORAGE: unique symbol = Symbol('MEDIA_STORAGE')

export type ImageExtension = '.jpg' | '.jpeg' | '.png' | '.webp'

export type ImageContentType = 'image/jpeg' | 'image/png' | 'image/webp'

export interface UploadGrant {
  uploadUrl: string
  key: string
}

export interface ConfirmedUpload {
  mediaRef: string
  size: number
}

export interface MediaStorage {
  /**
   * 生成上传签名。返回的 key/uploadUrl 指向 tmp/ staging 前缀；
   * mediaRef 为 confirm 成功后的最终引用（不含 tmp/）。
   * 未确认的 staging 对象由桶级 lifecycle 规则清除。
   */
  presignPhotoUpload(
    provinceCode: string,
    ext: ImageExtension,
    contentType: ImageContentType,
  ): Promise<UploadGrant>

  presignAlbumUpload(
    ext: ImageExtension,
    contentType: ImageContentType,
  ): Promise<UploadGrant>

  /**
   * 确认上传：只接受 tmp/photos/ 前缀的 staging key；
   * 校验（存在、≤10 MiB、类型、magic bytes）通过后将对象晋级到最终 key
   * 并删除 staging 对象，返回最终 mediaRef。
   */
  confirmUpload(key: string): Promise<ConfirmedUpload>

  presignRead(key: string): Promise<string>

  delete(key: string): Promise<void>
}
