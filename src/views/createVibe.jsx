import { useEffect, useState } from 'react'
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera'
import { Geolocation } from '@capacitor/geolocation'
import { FiCamera, FiMapPin, FiPlus, FiVideo, FiX } from 'react-icons/fi'
import { reverseGeocode } from '../services/geocoding.js'
import { publishVibe } from '../services/vibes.js'
import { createInterest, getRandomInterests, getUserInterests } from '../services/interests.js'
import { createImageThumbnail } from '../utils/createImageThumbnail.js'
import useAuthStore from '../stores/useAuthStore.js'

const MAX_INTERESTS = 5
const MAX_VIDEO_DURATION = 10
const VIDEO_DURATION_TOLERANCE = 0.5

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

const CreateVibe = ({ onPublished }) => {
  const { user } = useAuthStore()

  const [media, setMedia] = useState(null)
  const [caption, setCaption] = useState('')
  const [publishing, setPublishing] = useState(false)
  const [error, setError] = useState('')

  const [userInterests, setUserInterests] = useState([])
  const [otherInterests, setOtherInterests] = useState([])
  const [selectedInterests, setSelectedInterests] = useState([])

  const [customInterest, setCustomInterest] = useState('')
  const [creatingInterest, setCreatingInterest] = useState(false)

  // ---------------------------------------------------------------------------
  // Capture
  // ---------------------------------------------------------------------------

  const takePhoto = async () => {
    setError('')

    try {
      const image = await Camera.getPhoto({
        quality: 85,
        allowEditing: false,
        resultType: CameraResultType.Uri,
        source: CameraSource.Camera,
        correctOrientation: true
      })

      if (!image.webPath) throw new Error('The camera did not return an image.')

      setMedia({
        type: 'photo',
        webPath: image.webPath,
        format: image.format || 'jpeg'
      })
    } catch (error) {
      if (error?.message?.toLowerCase().includes('cancel')) return

      console.error('Failed to take photo:', error)
      setError('Could not take the photo. Please try again.')
    }
  }

  const recordVideo = async () => {
    setError('')

    try {
      const video = await Camera.recordVideo({
        saveToGallery: false,
        isPersistent: true,
        includeMetadata: true,
        duration: MAX_VIDEO_DURATION
      })

      console.log('Recorded video:', video)

      if (!video.webPath) throw new Error('The camera did not return a usable video.')

      const duration = video.metadata?.duration || (await getVideoDuration(video.webPath))
      const format = video.metadata?.format || 'mp4'

      if (duration > MAX_VIDEO_DURATION + VIDEO_DURATION_TOLERANCE) {
        throw new Error(`Videos can be a maximum of ${MAX_VIDEO_DURATION} seconds.`)
      }

      const thumbnailFile = await createVideoThumbnail(video.webPath)
      const thumbnailUrl = URL.createObjectURL(thumbnailFile)

      setMedia({
        type: 'video',
        webPath: video.webPath,
        uri: video.uri,
        format,
        duration,
        thumbnailFile,
        thumbnailUrl
      })
    } catch (error) {
      if (error?.message?.toLowerCase().includes('cancel')) return

      console.error('Failed to record video:', error)
      setError(error?.message || 'Could not record the video. Please try again.')
    }
  }

  const removeMedia = () => {
    if (media?.thumbnailUrl) URL.revokeObjectURL(media.thumbnailUrl)

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
    const response = await fetch(media.webPath)

    if (!response.ok) throw new Error('Could not read the captured media.')

    const blob = await response.blob()
    const fallbackType = media.type === 'video' ? 'video/mp4' : `image/${media.format}`

    return new File([blob], `vibe-${Date.now()}.${media.format}`, {
      type: blob.type || fallbackType
    })
  }

  const getThumbnailFile = async () => {
    if (media.type === 'photo') return createImageThumbnail(media.webPath)

    if (media.thumbnailFile) return media.thumbnailFile

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
    } catch (error) {
      setError(error.message)
    } finally {
      setCreatingInterest(false)
    }
  }

  const toggleInterest = (interestId) => {
    setSelectedInterests((current) => {
      if (current.includes(interestId)) return current.filter((id) => id !== interestId)
      if (current.length >= MAX_INTERESTS) return current

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
      } catch (error) {
        console.error('Failed to determine public Vibe location:', error)
      }

      const file = await getMediaFile()
      const thumbnailFile = await getThumbnailFile()

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

      if (media.thumbnailUrl) URL.revokeObjectURL(media.thumbnailUrl)

      setMedia(null)
      setCaption('')
      setSelectedInterests([])
      setCustomInterest('')

      onPublished?.()
    } catch (error) {
      console.error('Failed to publish Vibe:', error)
      setError(error?.message || 'Could not publish your Vibe. Please try again.')
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
      } catch (error) {
        console.error('Failed to load interests:', error)
      }
    }

    loadInterests()
  }, [user])

  // ---------------------------------------------------------------------------
  // Object URL cleanup
  // ---------------------------------------------------------------------------

  useEffect(() => {
    return () => {
      if (media?.thumbnailUrl) URL.revokeObjectURL(media.thumbnailUrl)
    }
  }, [media])

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
          <div className="flex gap-4">
            <button
              className="flex flex-1 flex-col items-center justify-center rounded-3xl bg-vibe-surface px-4 py-8 transition active:scale-[0.98]"
              type="button"
              onClick={takePhoto}>
              <div className="flex size-16 items-center justify-center rounded-full bg-vibe-petrol/10">
                <FiCamera className="text-3xl text-vibe-petrol" />
              </div>

              <span className="mt-4 font-bold text-vibe-text">Photo</span>
              <span className="mt-1 text-xs text-vibe-muted">Capture a moment</span>
            </button>

            <button
              className="flex flex-1 flex-col items-center justify-center rounded-3xl bg-vibe-apricot px-4 py-8 transition active:scale-[0.98]"
              type="button"
              onClick={recordVideo}>
              <div className="flex size-16 items-center justify-center rounded-full bg-white/25">
                <FiVideo className="text-3xl text-vibe-text" />
              </div>

              <span className="mt-4 font-bold text-vibe-text">Video</span>
              <span className="mt-1 text-xs text-vibe-text/60">Up to 10 seconds</span>
            </button>
          </div>

          <p className="mx-auto mt-6 max-w-xs text-center text-sm leading-6 text-vibe-muted">
            Post a photo or a short video of what's happening around you.
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
