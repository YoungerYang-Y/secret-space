export const MEDIA_STORAGE: unique symbol = Symbol('MEDIA_STORAGE')

export type ImageExtension = '.jpg' | '.jpeg' | '.png' | '.webp'

export type ImageContentType = 'image/jpeg' | 'image/png' | 'image/webp'

export interface UploadGrant {
  uploadUrl: string
  key: string
  mediaRef: string
}

export interface ConfirmedUpload {
  mediaRef: string
  size: number
}

export interface MediaStorage {
  presignPhotoUpload(
    provinceCode: string,
    ext: ImageExtension,
    contentType: ImageContentType,
  ): Promise<UploadGrant>

  presignAlbumUpload(
    ext: ImageExtension,
    contentType: ImageContentType,
  ): Promise<UploadGrant>

  confirmUpload(key: string): Promise<ConfirmedUpload>

  presignRead(key: string): Promise<string>

  delete(key: string): Promise<void>
}
