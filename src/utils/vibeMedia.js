import { createImageThumbnail } from './createImageThumbnail.js'

export const MAX_VIDEO_DURATION = 30
export const VIDEO_DURATION_TOLERANCE = 0.5
export const MAX_UPLOAD_SIZE = 50 * 1024 * 1024

// -----------------------------------------------------------------------------
// Video duration
// -----------------------------------------------------------------------------

export const getVideoDuration = (videoUrl) => {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video')

    video.preload = 'metadata'
    video.muted = true
    video.playsInline = true

    video.onloadedmetadata = () => {
      const duration = video.duration

      video.remove()
      resolve(duration)
    }

    video.onerror = () => {
      video.remove()
      reject(new Error('Could not read the video duration.'))
    }

    video.src = videoUrl
  })
}

// -----------------------------------------------------------------------------
// Video thumbnail
// -----------------------------------------------------------------------------

export const createVideoThumbnail = (videoUrl, seekTime = 0.5, maxWidth = 600, quality = 0.75) => {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video')

    video.preload = 'metadata'
    video.muted = true
    video.playsInline = true

    video.onloadedmetadata = () => {
      video.currentTime = Math.min(seekTime, Math.max(0, video.duration - 0.1))
    }

    video.onseeked = () => {
      const scale = Math.min(1, maxWidth / video.videoWidth)
      const width = Math.round(video.videoWidth * scale)
      const height = Math.round(video.videoHeight * scale)

      const canvas = document.createElement('canvas')

      canvas.width = width
      canvas.height = height

      const context = canvas.getContext('2d')

      if (!context) {
        video.remove()
        reject(new Error('Could not create the video thumbnail.'))
        return
      }

      context.drawImage(video, 0, 0, width, height)

      canvas.toBlob(
        (blob) => {
          video.remove()

          if (!blob) {
            reject(new Error('Could not create the video thumbnail.'))
            return
          }

          resolve(
            new File([blob], 'thumbnail.webp', {
              type: 'image/webp'
            })
          )
        },
        'image/webp',
        quality
      )
    }

    video.onerror = () => {
      video.remove()
      reject(new Error('Could not load the video for thumbnail generation.'))
    }

    video.src = videoUrl
  })
}

// -----------------------------------------------------------------------------
// Media file
// -----------------------------------------------------------------------------

export const createMediaFile = async (media) => {
  if (!media?.webPath) {
    throw new Error('Captured media is unavailable.')
  }

  const response = await fetch(media.webPath)

  if (!response.ok) {
    throw new Error('Could not read the captured media.')
  }

  const blob = await response.blob()

  const fallbackType = media.type === 'video' ? 'video/mp4' : `image/${media.format}`
  const extension = media.type === 'video' ? 'mp4' : media.format || 'jpeg'

  const file = new File([blob], `vibe-${Date.now()}.${extension}`, {
    type: blob.type || media.mimeType || fallbackType
  })

  if (file.size > MAX_UPLOAD_SIZE) {
    throw new Error('Vibes can be a maximum of 50 MB.')
  }

  return file
}

// -----------------------------------------------------------------------------
// Thumbnail file
// -----------------------------------------------------------------------------

export const createMediaThumbnail = async (media) => {
  if (media.type === 'photo') {
    return createImageThumbnail(media.webPath)
  }

  if (media.thumbnailFile) {
    return media.thumbnailFile
  }

  return createVideoThumbnail(media.webPath)
}
