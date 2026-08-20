import { registerCaptureDevice } from '../services/captureSecurity.js'
import { supabase } from '../services/supabase.js'
import { useEffect, useState } from 'react'
import { Capacitor } from '@capacitor/core'
import { Geolocation } from '@capacitor/geolocation'
import { Camera } from '@barilchaton/vibemoments-camera'
import { reverseGeocode } from '../services/geocoding.js'
import { publishVibe } from '../services/vibes.js'
import { createInterest, getRandomInterests, getUserInterests } from '../services/interests.js'
import {
  createMediaFile,
  createMediaThumbnail,
  createVideoThumbnail,
  getVideoDuration,
  MAX_VIDEO_DURATION,
  VIDEO_DURATION_TOLERANCE
} from '../utils/vibeMedia.js'
import useAuthStore from '../stores/useAuthStore.js'
import VibeCameraScreen from '../components/createVibe/vibeCameraScreen.jsx'
import VibeCaptureScreen from '../components/createVibe/vibeCaptureScreen.jsx'
import VibeComposer from '../components/createVibe/vibeComposer.jsx'

const MAX_INTERESTS = 5

const CreateVibe = ({ onPublished, onCameraOpenChange }) => {
  const { user } = useAuthStore()

  const [cameraOpen, setCameraOpen] = useState(false)
  const [captureSession, setCaptureSession] = useState(null)
  const [captureMode, setCaptureMode] = useState('photo')
  const [openingCamera, setOpeningCamera] = useState(false)
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
  // Camera layout state
  // ---------------------------------------------------------------------------

  useEffect(() => {
    const html = document.documentElement
    const body = document.body
    const root = document.getElementById('root')

    const elements = [html, body, root].filter(Boolean)

    elements.forEach((element) => {
      element.classList.toggle('vibe-camera-active', cameraOpen)
    })

    return () => {
      elements.forEach((element) => {
        element.classList.remove('vibe-camera-active')
      })
    }
  }, [cameraOpen])

  useEffect(() => {
    onCameraOpenChange?.(cameraOpen)

    return () => {
      onCameraOpenChange?.(false)
    }
  }, [cameraOpen, onCameraOpenChange])

  // ---------------------------------------------------------------------------
  // Capture session
  // ---------------------------------------------------------------------------

  const createCaptureSession = async (mediaType, deviceId) => {
    const { data, error } = await supabase.functions.invoke('create-capture-session', {
      body: {
        mediaType,
        deviceId
      }
    })

    if (error) {
      throw error
    }

    if (!data?.captureSessionId || !data?.nonce) {
      throw new Error('Capture session was not created correctly.')
    }

    return data
  }

  // ---------------------------------------------------------------------------
  // Camera
  // ---------------------------------------------------------------------------

  const openCamera = async () => {
    const mediaType = 'photo'

    if (openingCamera) return

    setOpeningCamera(true)
    setError('')

    try {
      console.log('[VibeMoments] Ensuring capture device is registered...')

      const { identity } = await registerCaptureDevice()

      console.log('[VibeMoments] Capture device ready:', identity.deviceId)

      console.log('[VibeMoments] Creating capture session:', mediaType)

      const session = await createCaptureSession(mediaType, identity.deviceId)

      console.log('[VibeMoments] Capture session created:', JSON.stringify(session, null, 2))

      setCaptureSession(session)
      setCaptureMode(mediaType)
      setCameraOpen(true)
    } catch (captureError) {
      console.error('Failed to prepare secure camera:', captureError)

      setCaptureSession(null)
      setError(captureError?.message || 'Could not prepare the camera. Please try again.')
    } finally {
      setOpeningCamera(false)
    }
  }

  const closeCamera = () => {
    setCameraOpen(false)
    setCaptureSession(null)
  }

  const handleCameraError = (cameraError) => {
    console.error('VibeCamera error:', cameraError)

    setError(cameraError?.message || 'Could not use the camera. Please try again.')
  }

  const handleCameraCapture = async (capture) => {
    setError('')

    try {
      console.log('[VibeMoments] Camera capture received:', capture)

      if (!capture?.path) {
        throw new Error('The camera did not return a usable media file.')
      }

      if (!capture?.sha256) {
        throw new Error('The camera did not return a capture fingerprint.')
      }

      if (!capture?.captureSessionId) {
        throw new Error('The camera did not return a capture session ID.')
      }

      if (!capture?.nonce) {
        throw new Error('The camera did not return a capture nonce.')
      }

      if (capture.captureSessionId !== captureSession?.captureSessionId) {
        throw new Error('Capture session does not match the active camera session.')
      }

      if (capture.nonce !== captureSession?.nonce) {
        throw new Error('Capture nonce does not match the active camera session.')
      }

      if (!capture?.deviceId) {
        throw new Error('The camera did not return a capture device ID.')
      }

      if (!capture?.captureSignature) {
        throw new Error('The camera did not return a capture signature.')
      }

      if (!capture?.proofVersion) {
        throw new Error('The camera did not return a capture proof version.')
      }

      if (!capture?.signatureAlgorithm) {
        throw new Error('The camera did not return a signature algorithm.')
      }

      const webPath = Capacitor.convertFileSrc(capture.path)

      if (capture.type === 'photo') {
        setMedia({
          type: 'photo',
          path: capture.path,
          webPath,
          format: 'jpeg',
          mimeType: capture.mimeType || 'image/jpeg',
          lens: capture.lens,

          sha256: capture.sha256,
          captureSessionId: capture.captureSessionId,
          nonce: capture.nonce,

          deviceId: capture.deviceId,
          captureSignature: capture.captureSignature,
          proofVersion: capture.proofVersion,
          signatureAlgorithm: capture.signatureAlgorithm
        })

        setCameraOpen(false)
        setCaptureSession(null)

        return
      }

      if (capture.type === 'video') {
        if (!capture.captureSessionId) {
          throw new Error('The camera did not return a capture session ID.')
        }

        if (!capture.nonce) {
          throw new Error('The camera did not return a capture nonce.')
        }

        if (!capture.sha256) {
          throw new Error('The camera did not return a video SHA-256.')
        }

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

          sha256: capture.sha256,
          captureSessionId: capture.captureSessionId,
          nonce: capture.nonce,

          deviceId: capture.deviceId,
          captureSignature: capture.captureSignature,
          proofVersion: capture.proofVersion,
          signatureAlgorithm: capture.signatureAlgorithm,

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

      setCaptureSession(null)
      setError(captureError?.message || 'Could not process the captured media.')
    }
  }

  // ---------------------------------------------------------------------------
  // Reset captured media
  // ---------------------------------------------------------------------------

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
    setCaptureSession(null)
    setCaption('')
    setSelectedInterests([])
    setCustomInterest('')
    setError('')
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
      if (
        !media.captureSessionId ||
        !media.nonce ||
        !media.sha256 ||
        !media.deviceId ||
        !media.captureSignature ||
        !media.proofVersion ||
        !media.signatureAlgorithm
      ) {
        throw new Error('This capture does not contain valid capture verification data.')
      }

      if (media.type === 'video') {
        const duration = media.duration || (await getVideoDuration(media.webPath))

        if (duration > MAX_VIDEO_DURATION + VIDEO_DURATION_TOLERANCE) {
          throw new Error(`Videos can be a maximum of ${MAX_VIDEO_DURATION} seconds.`)
        }
      }

      const file = await createMediaFile(media)
      const thumbnailFile = await createMediaThumbnail(media)

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
        interestIds: selectedInterests,

        captureSessionId: media.captureSessionId,
        captureNonce: media.nonce,
        mediaSha256: media.sha256,

        captureDeviceId: media.deviceId,
        captureSignature: media.captureSignature,
        captureProofVersion: media.proofVersion,
        captureSignatureAlgorithm: media.signatureAlgorithm
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
      setCaptureSession(null)
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
  // ---------------------------------------------------------------------------

  useEffect(() => {
    return () => {
      if (media?.thumbnailUrl) {
        URL.revokeObjectURL(media.thumbnailUrl)
      }
    }
  }, [media])

  // ---------------------------------------------------------------------------
  // Camera
  // ---------------------------------------------------------------------------

  if (!media && cameraOpen) {
    return (
      <VibeCameraScreen
        error={error}
        captureSession={captureSession}
        initialMode={captureMode}
        onCapture={handleCameraCapture}
        onError={handleCameraError}
        onClose={closeCamera}
      />
    )
  }

  // ---------------------------------------------------------------------------
  // Capture
  // ---------------------------------------------------------------------------

  if (!media) {
    return <VibeCaptureScreen error={error} openingCamera={openingCamera} onOpenCamera={openCamera} />
  }

  // ---------------------------------------------------------------------------
  // Composer
  // ---------------------------------------------------------------------------

  return (
    <VibeComposer
      media={media}
      caption={caption}
      publishing={publishing}
      error={error}
      userInterests={userInterests}
      otherInterests={otherInterests}
      selectedInterests={selectedInterests}
      customInterest={customInterest}
      creatingInterest={creatingInterest}
      maxInterests={MAX_INTERESTS}
      onCaptionChange={(value) => {
        setCaption(value)
        setError('')
      }}
      onCustomInterestChange={(value) => {
        setCustomInterest(value)
        setError('')
      }}
      onCreateInterest={handleCreateInterest}
      onToggleInterest={toggleInterest}
      onRemoveMedia={removeMedia}
      onPublish={handlePublish}
    />
  )
}

export default CreateVibe
