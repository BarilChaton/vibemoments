import { useEffect, useState } from 'react'
import { Capacitor } from '@capacitor/core'
import { Geolocation } from '@capacitor/geolocation'
import { Camera, VibeCamera } from 'vibemoments-camera'
import { FiCamera, FiMapPin, FiPlus, FiVideo, FiX } from 'react-icons/fi'
import { reverseGeocode } from '../services/geocoding.js'
import { publishVibe } from '../services/vibes.js'
import { createInterest, getRandomInterests, getUserInterests } from '../services/interests.js'
import { createImageThumbnail } from '../utils/createImageThumbnail.js'
import useAuthStore from '../stores/useAuthStore.js'

const MAX_INTERESTS = 5
const MAX_VIDEO_DURATION = 30
const VIDEO_DURATION_TOLERANCE = 0.5
const MAX_UPLOAD_SIZE = 50 * 1024 * 1024

// -----------------------------------------------------------------------------
// Video helpers
// -----------------------------------------------------------------------------

const getVideoDuration = (videoUrl) => {
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

const createVideoThumbnail = (videoUrl, seekTime = 0.5, maxWidth = 600, quality = 0.75) => {
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
// Component
// -----------------------------------------------------------------------------

const CreateVibe = ({ onPublished, onCameraOpenChange }) => {
  const { user } = useAuthStore()

  const [cameraOpen, setCameraOpen] = useState(false)
  const [media, setMedia] = useState(null)

  const [caption, setCaption] = useState('')
  const [publishing, setPublishing] = useState(false)
  const [error, setError] = useState('')

  const [userInterests, setUserInterests] = useState([])
  const [otherInterests, setOtherInterests] = useState([])
  const [selectedInterests, setSelectedInterests] = useState([])

  const [customInterest, setCustomInterest] = useState('')
  const [creatingInterest, setCreatingInterest] = useState(false)

  useEffect(() => {
    const html = document.documentElement
    const body = document.body
    const root = document.getElementById('root')

    if (cameraOpen) {
      html.classList.add('vibe-camera-active')
      body.classList.add('vibe-camera-active')
      root?.classList.add('vibe-camera-active')
    } else {
      html.classList.remove('vibe-camera-active')
      body.classList.remove('vibe-camera-active')
      root?.classList.remove('vibe-camera-active')
    }

    return () => {
      html.classList.remove('vibe-camera-active')
      body.classList.remove('vibe-camera-active')
      root?.classList.remove('vibe-camera-active')
    }
  }, [cameraOpen])

  useEffect(() => {
    onCameraOpenChange?.(cameraOpen)

    return () => {
      onCameraOpenChange?.(false)
    }
  }, [cameraOpen, onCameraOpenChange])

  // ---------------------------------------------------------------------------
  // Camera
  // ---------------------------------------------------------------------------

  const openCamera = () => {
    setError('')
    setCameraOpen(true)
  }

  const closeCamera = () => {
    setCameraOpen(false)
  }

  const handleCameraError = (cameraError) => {
    console.error('VibeCamera error:', cameraError)

    setError(cameraError?.message || 'Could not use the camera. Please try again.')
  }

  const handleCameraCapture = async (capture) => {
    setError('')

    try {
      if (!capture?.path) {
        throw new Error('The camera did not return a usable media file.')
      }

      const webPath = Capacitor.convertFileSrc(capture.path)

      if (capture.type === 'photo') {
        setMedia({
          type: 'photo',
          path: capture.path,
          webPath,
          format: 'jpeg',
          mimeType: capture.mimeType || 'image/jpeg',
          lens: capture.lens
        })

        setCameraOpen(false)
        return
      }

      if (capture.type === 'video') {
        let duration = capture.durationMs ? capture.durationMs / 1000 : 0

        if (!duration) {
          duration = await getVideoDuration(webPath)
        }

        if (duration > MAX_VIDEO_DURATION + VIDEO_DURATION_TOLERANCE) {
          throw new Error(`Videos can be a maximum of ${MAX_VIDEO_DURATION} seconds.`)
        }

        const thumbnailFile = await createVideoThumbnail(webPath)
        const thumbnailUrl = URL.createObjectURL(thumbnailFile)

        setMedia({
          type: 'video',
          path: capture.path,
          webPath,
          format: 'mp4',
          mimeType: capture.mimeType || 'video/mp4',
          duration,
          durationMs: capture.durationMs,
          videoBitrate: capture.videoBitrate,
          audioBitrate: capture.audioBitrate,
          lens: capture.lens,
          thumbnailFile,
          thumbnailUrl
        })

        setCameraOpen(false)
        return
      }

      throw new Error(`Unsupported camera media type: ${capture.type}`)
    } catch (captureError) {
      console.error('Failed to process camera capture:', captureError)

      if (capture?.path) {
        try {
          await Camera.deleteCapture(capture.path)
        } catch (cleanupError) {
          console.error('Failed to clean up unusable capture:', cleanupError)
        }
      }

      setError(captureError?.message || 'Could not process the captured media.')
    }
  }

  const removeMedia = async () => {
    if (media?.thumbnailUrl) {
      URL.revokeObjectURL(media.thumbnailUrl)
    }

    if (media?.path) {
      try {
        await Camera.deleteCapture(media.path)
      } catch (cleanupError) {
        console.error('Failed to delete temporary capture:', cleanupError)
      }
    }

    setMedia(null)
    setCaption('')
    setSelectedInterests([])
    setCustomInterest('')
    setError('')
  }

  // ---------------------------------------------------------------------------
  // Media files
  // ---------------------------------------------------------------------------

  const getMediaFile = async () => {
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

  const getThumbnailFile = async () => {
    if (media.type === 'photo') {
      return createImageThumbnail(media.webPath)
    }

    if (media.thumbnailFile) {
      return media.thumbnailFile
    }

    return createVideoThumbnail(media.webPath)
  }

  // ---------------------------------------------------------------------------
  // Interests
  // ---------------------------------------------------------------------------

  const handleCreateInterest = async () => {
    const name = customInterest.trim()

    if (name.length < 2 || creatingInterest) return

    setCreatingInterest(true)
    setError('')

    try {
      const interest = await createInterest(user.id, name)

      setOtherInterests((current) => {
        if (current.some((item) => item.id === interest.id)) return current

        return [interest, ...current]
      })

      setSelectedInterests((current) => {
        if (current.includes(interest.id)) return current
        if (current.length >= MAX_INTERESTS) return current

        return [...current, interest.id]
      })

      setCustomInterest('')
    } catch (interestError) {
      setError(interestError.message)
    } finally {
      setCreatingInterest(false)
    }
  }

  const toggleInterest = (interestId) => {
    setSelectedInterests((current) => {
      if (current.includes(interestId)) {
        return current.filter((id) => id !== interestId)
      }

      if (current.length >= MAX_INTERESTS) {
        return current
      }

      return [...current, interestId]
    })
  }

  // ---------------------------------------------------------------------------
  // Publish
  // ---------------------------------------------------------------------------

  const handlePublish = async () => {
    if (!media || !user || publishing) return

    setPublishing(true)
    setError('')

    try {
      if (media.type === 'video') {
        const duration = media.duration || (await getVideoDuration(media.webPath))

        if (duration > MAX_VIDEO_DURATION + VIDEO_DURATION_TOLERANCE) {
          throw new Error(`Videos can be a maximum of ${MAX_VIDEO_DURATION} seconds.`)
        }
      }

      const file = await getMediaFile()
      const thumbnailFile = await getThumbnailFile()

      const permission = await Geolocation.checkPermissions()

      if (permission.location !== 'granted' && permission.coarseLocation !== 'granted') {
        const requested = await Geolocation.requestPermissions()

        if (requested.location !== 'granted' && requested.coarseLocation !== 'granted') {
          throw new Error('Location permission is required to publish a Vibe.')
        }
      }

      const position = await Geolocation.getCurrentPosition({
        enableHighAccuracy: true,
        timeout: 10000
      })

      const latitude = position.coords.latitude
      const longitude = position.coords.longitude

      let publicLocation = {
        area: null,
        city: null
      }

      try {
        publicLocation = await reverseGeocode(latitude, longitude)
      } catch (locationError) {
        console.error('Failed to determine public Vibe location:', locationError)
      }

      await publishVibe({
        userId: user.id,
        file,
        thumbnailFile,
        mediaType: media.type,
        caption,
        latitude,
        longitude,
        locationArea: publicLocation.area,
        locationCity: publicLocation.city,
        interestIds: selectedInterests
      })

      if (media.thumbnailUrl) {
        URL.revokeObjectURL(media.thumbnailUrl)
      }

      if (media.path) {
        try {
          await Camera.deleteCapture(media.path)
        } catch (cleanupError) {
          console.error('Failed to delete uploaded temporary capture:', cleanupError)
        }
      }

      setMedia(null)
      setCaption('')
      setSelectedInterests([])
      setCustomInterest('')
      setError('')

      onPublished?.()
    } catch (publishError) {
      console.error('Failed to publish Vibe:', publishError)

      setError(publishError?.message || 'Could not publish your Vibe. Please try again.')
    } finally {
      setPublishing(false)
    }
  }

  // ---------------------------------------------------------------------------
  // Interests loading
  // ---------------------------------------------------------------------------

  useEffect(() => {
    if (!user) return

    const loadInterests = async () => {
      try {
        const own = await getUserInterests(user.id)
        const random = await getRandomInterests(15)

        setUserInterests(own)

        setOtherInterests(random.filter((interest) => !own.some((userInterest) => userInterest.id === interest.id)))
      } catch (loadError) {
        console.error('Failed to load interests:', loadError)
      }
    }

    loadInterests()
  }, [user])

  // ---------------------------------------------------------------------------
  // Object URL cleanup
  // -----------------------------------------------------------------------------

  useEffect(() => {
    return () => {
      if (media?.thumbnailUrl) {
        URL.revokeObjectURL(media.thumbnailUrl)
      }
    }
  }, [media])

  // ---------------------------------------------------------------------------
  // Camera screen
  // ---------------------------------------------------------------------------

  if (!media && cameraOpen) {
    return (
      <div className="relative flex flex-1 overflow-hidden bg-transparent">
        <VibeCamera autoStart onCapture={handleCameraCapture} onError={handleCameraError} onClose={closeCamera} />

        {error && (
          <div className="absolute left-4 right-4 top-20 z-30 rounded-2xl bg-red-500/90 px-4 py-3 text-center text-sm font-medium text-white backdrop-blur-md">
            {error}
          </div>
        )}
      </div>
    )
  }

  // ---------------------------------------------------------------------------
  // Capture screen
  // ---------------------------------------------------------------------------

  if (!media) {
    return (
      <div className="flex flex-1 flex-col">
        <header className="safe-top px-6 pb-4 pt-5">
          <p className="text-sm font-semibold text-vibe-apricot-dark">CAPTURE THE MOMENT</p>

          <h1 className="mt-1 text-3xl font-black text-vibe-petrol">Create a Vibe</h1>

          <p className="mt-2 text-sm text-vibe-muted">Share what's happening around you right now.</p>
        </header>

        <div className="flex flex-1 flex-col justify-center px-6">
          <button
            className="flex w-full flex-col items-center justify-center rounded-3xl bg-vibe-surface px-6 py-10 transition active:scale-[0.98]"
            type="button"
            onClick={openCamera}>
            <div className="flex size-20 items-center justify-center rounded-full bg-vibe-petrol/10">
              <FiCamera className="text-4xl text-vibe-petrol" />
            </div>

            <span className="mt-5 text-lg font-bold text-vibe-text">Open Camera</span>

            <span className="mt-1 text-sm text-vibe-muted">Take a photo or record a video</span>

            <div className="mt-5 flex items-center gap-3 text-xs font-semibold text-vibe-muted">
              <span className="flex items-center gap-1.5">
                <FiCamera />
                Photo
              </span>

              <span className="size-1 rounded-full bg-vibe-muted/40" />

              <span className="flex items-center gap-1.5">
                <FiVideo />
                Up to 30 seconds
              </span>
            </div>
          </button>

          <p className="mx-auto mt-6 max-w-xs text-center text-sm leading-6 text-vibe-muted">
            Capture what's happening around you right now and share it with nearby people.
          </p>

          {error && <p className="mt-5 text-center text-sm font-medium text-red-500">{error}</p>}
        </div>
      </div>
    )
  }

  // ---------------------------------------------------------------------------
  // Composer
  // ---------------------------------------------------------------------------

  return (
    <div className="flex flex-1 flex-col">
      <header className="safe-top flex items-center justify-between px-6 pb-4 pt-5">
        <div>
          <p className="text-sm font-semibold text-vibe-apricot-dark">{media.type === 'video' ? 'NEW VIDEO VIBE' : 'NEW VIBE'}</p>

          <h1 className="mt-1 text-3xl font-black text-vibe-petrol">Looking good?</h1>
        </div>

        <button
          className="flex size-10 items-center justify-center rounded-full bg-vibe-surface text-vibe-muted transition active:scale-95"
          type="button"
          disabled={publishing}
          onClick={removeMedia}>
          <FiX className="text-xl" />
        </button>
      </header>

      <div className="flex-1 overflow-y-auto px-6 pb-6">
        <div className="relative overflow-hidden rounded-3xl bg-black">
          {media.type === 'photo' && <img className="aspect-4/5 w-full object-cover" src={media.webPath} alt="Your Vibe" />}

          {media.type === 'video' && (
            <>
              {media.thumbnailUrl && <img className="absolute inset-0 h-full w-full object-cover" src={media.thumbnailUrl} alt="" />}

              <video
                className="relative aspect-4/5 w-full object-cover"
                src={media.webPath}
                poster={media.thumbnailUrl || undefined}
                autoPlay
                muted
                loop
                playsInline
                preload="auto"
              />

              <div className="pointer-events-none absolute right-3 top-3 rounded-full bg-black/50 px-3 py-1.5 text-xs font-semibold text-white backdrop-blur-md">
                {Math.min(media.duration || 0, MAX_VIDEO_DURATION).toFixed(1)}s
              </div>
            </>
          )}
        </div>

        <div className="mt-5">
          <textarea
            className="min-h-24 w-full resize-none rounded-2xl border border-vibe-petrol/10 bg-vibe-surface px-4 py-4 text-vibe-text outline-none transition placeholder:text-vibe-muted/60 focus:border-vibe-petrol/40"
            placeholder="What's happening?"
            value={caption}
            maxLength={280}
            disabled={publishing}
            onChange={(e) => {
              setCaption(e.target.value)
              setError('')
            }}
          />

          <div className="mt-2 flex justify-end">
            <span className="text-xs text-vibe-muted">{caption.length}/280</span>
          </div>
        </div>

        <div className="mt-4 flex items-center gap-3 rounded-2xl bg-vibe-surface px-4 py-4">
          <div className="flex size-10 items-center justify-center rounded-full bg-vibe-lime/20">
            <FiMapPin className="text-lg text-vibe-petrol" />
          </div>

          <div>
            <p className="text-sm font-semibold text-vibe-text">General area only</p>

            <p className="mt-0.5 text-xs text-vibe-muted">Only the district and city are shown. Your exact location remains private.</p>
          </div>
        </div>

        <div className="mt-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-bold text-vibe-text">Add interests</h3>

              <p className="mt-1 text-xs text-vibe-muted">Choose existing interests or create one if it's missing.</p>
            </div>

            <span className="text-xs font-semibold text-vibe-muted">
              {selectedInterests.length}/{MAX_INTERESTS}
            </span>
          </div>

          <div className="mt-5 flex gap-2">
            <input
              className="min-w-0 flex-1 rounded-2xl border border-vibe-petrol/15 bg-vibe-surface px-4 py-3 text-sm text-vibe-text outline-none transition placeholder:text-vibe-muted/60 focus:border-vibe-apricot"
              type="text"
              placeholder="Add another interest..."
              value={customInterest}
              maxLength={40}
              disabled={creatingInterest || selectedInterests.length >= MAX_INTERESTS}
              onChange={(e) => {
                setCustomInterest(e.target.value)
                setError('')
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  handleCreateInterest()
                }
              }}
            />

            <button
              className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-vibe-apricot text-xl text-vibe-text transition active:scale-95 disabled:opacity-30"
              type="button"
              disabled={customInterest.trim().length < 2 || creatingInterest || selectedInterests.length >= MAX_INTERESTS}
              onClick={handleCreateInterest}>
              <FiPlus />
            </button>
          </div>

          {userInterests.length > 0 && (
            <div className="mt-5">
              <p className="mb-3 text-xs font-semibold uppercase tracking-[0.15em] text-vibe-apricot-dark">Your interests</p>

              <div className="flex flex-wrap gap-2">
                {userInterests.map((interest) => {
                  const active = selectedInterests.includes(interest.id)

                  return (
                    <button
                      key={interest.id}
                      className={`rounded-full border px-3 py-2 text-sm font-semibold transition active:scale-95 ${
                        active
                          ? 'border-vibe-petrol bg-vibe-petrol text-vibe-surface'
                          : 'border-vibe-petrol/15 bg-vibe-surface text-vibe-muted hover:border-vibe-petrol/40'
                      }`}
                      type="button"
                      disabled={!active && selectedInterests.length >= MAX_INTERESTS}
                      onClick={() => toggleInterest(interest.id)}>
                      {interest.name}
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {otherInterests.length > 0 && (
            <div className="mt-6">
              <p className="mb-3 text-xs font-semibold uppercase tracking-[0.15em] text-vibe-muted">Discover more</p>

              <div className="flex flex-wrap gap-2">
                {otherInterests.map((interest) => {
                  const active = selectedInterests.includes(interest.id)

                  return (
                    <button
                      key={interest.id}
                      className={`rounded-full border px-3 py-2 text-sm font-semibold transition active:scale-95 ${
                        active
                          ? 'border-vibe-apricot bg-vibe-apricot text-vibe-text'
                          : 'border-vibe-petrol/15 bg-vibe-surface text-vibe-muted hover:border-vibe-apricot/60'
                      }`}
                      type="button"
                      disabled={!active && selectedInterests.length >= MAX_INTERESTS}
                      onClick={() => toggleInterest(interest.id)}>
                      {interest.name}
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {selectedInterests.length >= MAX_INTERESTS && (
            <p className="mt-3 text-xs text-vibe-muted">You can attach up to {MAX_INTERESTS} interests to a Vibe.</p>
          )}
        </div>

        {error && <p className="mt-5 text-sm font-medium text-red-500">{error}</p>}
      </div>

      <div className="border-t border-vibe-petrol/10 bg-vibe-bg px-6 pb-[calc(env(safe-area-inset-bottom)+1rem)] pt-4">
        <button
          className="w-full rounded-2xl bg-vibe-apricot px-5 py-4 font-bold text-vibe-text shadow-lg shadow-vibe-apricot/20 transition active:scale-[0.98] disabled:opacity-50"
          type="button"
          disabled={publishing}
          onClick={handlePublish}>
          {publishing ? 'Sharing Vibe...' : 'Share Vibe'}
        </button>
      </div>
    </div>
  )
}

export default CreateVibe
