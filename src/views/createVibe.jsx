import { useEffect, useState } from 'react'
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera'
import { Geolocation } from '@capacitor/geolocation'
import { FiCamera, FiMapPin, FiPlus, FiX } from 'react-icons/fi'
import { publishVibe } from '../services/vibes.js'
import { getRandomInterests, getUserInterests, createInterest } from '../services/interests.js'
import { createImageThumbnail } from '../utils/createImageThumbnail.js'
import useAuthStore from '../stores/useAuthStore.js'

const MAX_INTERESTS = 5

const CreateVibe = ({ onPublished }) => {
  const { user } = useAuthStore()

  const [photo, setPhoto] = useState(null)
  const [caption, setCaption] = useState('')
  const [publishing, setPublishing] = useState(false)
  const [error, setError] = useState('')

  const [userInterests, setUserInterests] = useState([])
  const [otherInterests, setOtherInterests] = useState([])
  const [selectedInterests, setSelectedInterests] = useState([])

  const [customInterest, setCustomInterest] = useState('')
  const [creatingInterest, setCreatingInterest] = useState(false)

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

      setPhoto({
        webPath: image.webPath,
        format: image.format || 'jpeg'
      })
    } catch (error) {
      if (error?.message?.toLowerCase().includes('cancel')) return

      console.error('Failed to take photo:', error)
      setError('Could not take the photo. Please try again.')
    }
  }

  const removePhoto = () => {
    setPhoto(null)
    setCaption('')
    setSelectedInterests([])
    setCustomInterest('')
    setError('')
  }

  const getPhotoFile = async () => {
    const response = await fetch(photo.webPath)
    const blob = await response.blob()

    return new File([blob], `vibe-${Date.now()}.${photo.format}`, {
      type: blob.type || `image/${photo.format}`
    })
  }

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

  const handlePublish = async () => {
    if (!photo || !user || publishing) return

    setPublishing(true)
    setError('')

    try {
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

      const file = await getPhotoFile()
      const thumbnailFile = await createImageThumbnail(photo.webPath)

      await publishVibe({
        userId: user.id,
        file,
        thumbnailFile,
        mediaType: 'photo',
        caption,
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        interestIds: selectedInterests
      })

      setPhoto(null)
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

  const toggleInterest = (interestId) => {
    setSelectedInterests((current) => {
      if (current.includes(interestId)) return current.filter((id) => id !== interestId)

      if (current.length >= MAX_INTERESTS) return current

      return [...current, interestId]
    })
  }

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

  if (!photo) {
    return (
      <div className="flex flex-1 flex-col">
        <header className="safe-top px-6 pb-4 pt-5">
          <p className="text-sm font-semibold text-vibe-apricot-dark">CAPTURE THE MOMENT</p>
          <h1 className="mt-1 text-3xl font-black text-vibe-petrol">Create a Vibe</h1>
          <p className="mt-2 text-sm text-vibe-muted">Share what's happening around you right now.</p>
        </header>

        <div className="flex flex-1 flex-col items-center justify-center px-6">
          <button
            className="flex size-32 items-center justify-center rounded-full bg-vibe-apricot text-vibe-text shadow-xl shadow-vibe-apricot/20 transition active:scale-95"
            type="button"
            onClick={takePhoto}>
            <FiCamera className="text-5xl" />
          </button>

          <h2 className="mt-7 text-xl font-bold text-vibe-text">Take a photo</h2>

          <p className="mt-2 max-w-xs text-center text-sm leading-6 text-vibe-muted">
            Capture something happening around you and share it with nearby people.
          </p>

          {error && <p className="mt-6 text-center text-sm font-medium text-red-500">{error}</p>}
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-1 flex-col">
      <header className="safe-top flex items-center justify-between px-6 pb-4 pt-5">
        <div>
          <p className="text-sm font-semibold text-vibe-apricot-dark">NEW VIBE</p>
          <h1 className="mt-1 text-3xl font-black text-vibe-petrol">Looking good?</h1>
        </div>

        <button
          className="flex size-10 items-center justify-center rounded-full bg-vibe-surface text-vibe-muted transition active:scale-95"
          type="button"
          disabled={publishing}
          onClick={removePhoto}>
          <FiX className="text-xl" />
        </button>
      </header>

      <div className="flex-1 overflow-y-auto px-6 pb-6">
        <div className="overflow-hidden rounded-3xl bg-black">
          <img className="aspect-4/5 w-full object-cover" src={photo.webPath} alt="Your Vibe" />
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
            <p className="text-sm font-semibold text-vibe-text">Nearby location</p>
            <p className="mt-0.5 text-xs text-vibe-muted">Your exact coordinates won't be shown to other users.</p>
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
