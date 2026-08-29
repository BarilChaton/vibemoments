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
import { useTranslation } from 'react-i18next'
import useAuthStore from '../stores/useAuthStore.js'
import VibeCameraScreen from '../components/createVibe/vibeCameraScreen.jsx'
import VibeCaptureScreen from '../components/createVibe/vibeCaptureScreen.jsx'
import VibeComposer from '../components/createVibe/vibeComposer.jsx'

const MAX_INTERESTS = 5

const CreateVibe = ({ onPublished, onCameraOpenChange }) => {
  const { user } = useAuthStore()
  const { t } = useTranslation()

  const [cameraOpen, setCameraOpen] = useState(false)
  const [captureSession, setCaptureSession] = useState(null)
  const [captureDeviceId, setCaptureDeviceId] = useState(null)
  const [captureSessionUpdating, setCaptureSessionUpdating] = useState(false)
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
      throw new Error(t('errors.camera.captureSessionInvalid'))
    }

    return data
  }

  const handleCaptureModeChange = async (nextMode) => {
    if (!captureDeviceId || captureSessionUpdating) return
    if (nextMode !== 'photo' && nextMode !== 'video') return
    if (nextMode === captureMode && captureSession) return

    setCaptureSessionUpdating(true)
    setError('')

    try {
      /*
       * Do not allow the old session to remain usable while a session
       * for the newly selected media type is being created.
       */
      setCaptureSession(null)

      const session = await createCaptureSession(nextMode, captureDeviceId)

      setCaptureSession(session)
      setCaptureMode(nextMode)
    } catch (sessionError) {
      console.error('Failed to change secure capture mode:', sessionError)

      setCaptureSession(null)
      setError(t('errors.camera.prepareMode'))
    } finally {
      setCaptureSessionUpdating(false)
    }
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
      const { identity } = await registerCaptureDevice()

      setCaptureDeviceId(identity.deviceId)

      const session = await createCaptureSession(mediaType, identity.deviceId)

      setCaptureSession(session)
      setCaptureMode(mediaType)
      setCameraOpen(true)
    } catch (captureError) {
      console.error('Failed to prepare secure camera:', captureError)

      setCaptureSession(null)
      setCaptureDeviceId(null)
      setError(t('errors.camera.prepareCamera'))
    } finally {
      setOpeningCamera(false)
    }
  }

  const closeCamera = () => {
    setCameraOpen(false)
    setCaptureSession(null)
    setCaptureDeviceId(null)
    setCaptureSessionUpdating(false)
    setCaptureMode('photo')
  }

  const handleCameraError = (cameraError) => {
    console.error('VibeCamera error:', cameraError)

    setError(t('errors.camera.useCamera'))
  }

  const handleCameraCapture = async (capture) => {
    setError('')

    try {
      if (!capture?.path) {
        throw new Error(t('errors.camera.missingMediaFile'))
      }

      if (!capture?.sha256) {
        throw new Error(t('errors.camera.missingFingerprint'))
      }

      if (!capture?.captureSessionId) {
        throw new Error(t('errors.camera.missingSessionId'))
      }

      if (!capture?.nonce) {
        throw new Error(t('errors.camera.missingNonce'))
      }

      if (capture.captureSessionId !== captureSession?.captureSessionId) {
        throw new Error(t('errors.camera.sessionMismatch'))
      }

      if (capture.nonce !== captureSession?.nonce) {
        throw new Error(t('errors.camera.nonceMismatch'))
      }

      if (!capture?.deviceId) {
        throw new Error(t('errors.camera.missingDeviceId'))
      }

      if (!capture?.captureSignature) {
        throw new Error(t('errors.camera.missingSignature'))
      }

      if (!capture?.proofVersion) {
        throw new Error(t('errors.camera.missingProofVersion'))
      }

      if (!capture?.signatureAlgorithm) {
        throw new Error(t('errors.camera.missingSignatureAlgorithm'))
      }

      if (capture.type !== captureMode) {
        throw new Error(
          t('errors.camera.mediaTypeMismatch', {
            type: capture.type,
            mode: captureMode
          })
        )
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
        setCaptureDeviceId(null)
        setCaptureSessionUpdating(false)

        return
      }

      if (capture.type === 'video') {
        let duration = capture.durationMs ? capture.durationMs / 1000 : 0

        if (!duration) {
          duration = await getVideoDuration(webPath)
        }

        if (duration > MAX_VIDEO_DURATION + VIDEO_DURATION_TOLERANCE) {
          throw new Error(
            t('errors.camera.videoTooLong', {
              seconds: MAX_VIDEO_DURATION
            })
          )
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
        setCaptureSession(null)
        setCaptureDeviceId(null)
        setCaptureSessionUpdating(false)

        return
      }

      throw new Error(
        t('errors.camera.unsupportedMediaType', {
          type: capture.type
        })
      )
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
      setCaptureDeviceId(null)
      setCaptureSessionUpdating(false)
      setError(captureError?.message || t('errors.camera.processCapture'))
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
    setCaptureDeviceId(null)
    setCaptureSessionUpdating(false)
    setCaptureMode('photo')
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
      console.error('Failed to create interest:', interestError)

      setError(t('errors.interests.createError'))
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
        throw new Error(t('errors.camera.invalidVerificationData'))
      }

      if (media.type === 'video') {
        const duration = media.duration || (await getVideoDuration(media.webPath))

        if (duration > MAX_VIDEO_DURATION + VIDEO_DURATION_TOLERANCE) {
          throw new Error(
            t('errors.camera.videoTooLong', {
              seconds: MAX_VIDEO_DURATION
            })
          )
        }
      }

      const file = await createMediaFile(media)
      const thumbnailFile = await createMediaThumbnail(media)

      const permission = await Geolocation.checkPermissions()

      if (permission.location !== 'granted' && permission.coarseLocation !== 'granted') {
        const requested = await Geolocation.requestPermissions()

        if (requested.location !== 'granted' && requested.coarseLocation !== 'granted') {
          throw new Error(t('errors.camera.locationRequiredToPublish'))
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
      setCaptureDeviceId(null)
      setCaptureSessionUpdating(false)
      setCaptureMode('photo')
      setCaption('')
      setSelectedInterests([])
      setCustomInterest('')
      setError('')

      onPublished?.()
    } catch (publishError) {
      console.error('Failed to publish Vibe:', publishError)

      setError(publishError?.message || t('errors.camera.publishError'))
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
        captureSessionUpdating={captureSessionUpdating}
        initialMode={captureMode}
        onModeChange={handleCaptureModeChange}
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
