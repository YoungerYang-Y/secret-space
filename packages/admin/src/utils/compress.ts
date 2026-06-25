export async function compressImage(
  file: File,
  maxWidth = 1200,
  quality = 0.85,
): Promise<Blob> {
  const bitmap = await createImageBitmap(file)
  const maxDim = Math.max(bitmap.width, bitmap.height)
  const ratio = Math.min(1, maxWidth / maxDim)
  const width = Math.round(bitmap.width * ratio)
  const height = Math.round(bitmap.height * ratio)

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')!
  ctx.drawImage(bitmap, 0, 0, width, height)
  bitmap.close()

  return new Promise((resolve) => {
    canvas.toBlob(
      (blob) => {
        if (blob) {
          resolve(blob)
        } else {
          // Fallback to JPEG if WebP not supported
          canvas.toBlob((jpegBlob) => resolve(jpegBlob!), 'image/jpeg', quality)
        }
      },
      'image/webp',
      quality,
    )
  })
}
