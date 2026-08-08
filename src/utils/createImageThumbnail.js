export const createImageThumbnail = async (imageUrl, maxWidth = 600, quality = 0.75) => {
  const image = new Image()

  await new Promise((resolve, reject) => {
    image.onload = resolve
    image.onerror = reject
    image.src = imageUrl
  })

  const scale = Math.min(1, maxWidth / image.width)

  const width = Math.round(image.width * scale)
  const height = Math.round(image.height * scale)

  const canvas = document.createElement('canvas')

  canvas.width = width
  canvas.height = height

  const context = canvas.getContext('2d')

  context.drawImage(image, 0, 0, width, height)

  const blob = await new Promise((resolve) => {
    canvas.toBlob(resolve, 'image/webp', quality)
  })

  if (!blob) throw new Error('Failed to create image thumbnail.')

  return new File([blob], 'thumbnail.webp', {
    type: 'image/webp'
  })
}
