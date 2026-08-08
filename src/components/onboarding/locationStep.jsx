import { useState } from 'react'
import { Geolocation } from '@capacitor/geolocation'
import { FiArrowLeft, FiMapPin } from 'react-icons/fi'
import { completeOnboarding } from '../../services/onboarding.js'
import useAuthStore from '../../stores/useAuthStore.js'

const LocationStep = ({ onBack }) => {
  const { user, setProfile } = useAuthStore()

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleEnableLocation = async () => {
    setLoading(true)
    setError('')

    try {
      const permission = await Geolocation.requestPermissions()
      const allowed = permission.location === 'granted' || permission.coarseLocation === 'granted'

      if (!allowed) {
        setError('Location permission is required to discover nearby Vibes.')
        return
      }

      await Geolocation.getCurrentPosition({
        enableHighAccuracy: true,
        timeout: 10000
      })

      const profile = await completeOnboarding(user.id)
      setProfile(profile)
    } catch (error) {
      setError(error.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-1 flex-col">
      <button
        className="mb-6 flex w-fit items-center gap-2 text-sm font-medium text-vibe-muted transition hover:text-vibe-petrol active:opacity-50"
        type="button"
        onClick={onBack}>
        <FiArrowLeft />
        Back
      </button>

      <div>
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-vibe-apricot">Step 3 of 3</p>

        <h1 className="mt-3 text-3xl font-black text-vibe-text">See what’s happening around you</h1>

        <p className="mt-3 leading-6 text-vibe-muted">
          VibeMoments uses your location to find Vibes happening nearby and to understand which moments are relevant to you.
        </p>
      </div>

      <div className="mt-12 flex flex-1 flex-col items-center justify-center text-center">
        <div className="flex size-24 items-center justify-center rounded-full bg-vibe-surface shadow-sm">
          <FiMapPin className="text-4xl text-vibe-petrol" />
        </div>

        <h2 className="mt-8 text-xl font-bold text-vibe-text">Your location stays private</h2>

        <p className="mt-3 max-w-xs text-sm leading-6 text-vibe-muted">
          Other users will not see your live GPS position. Location is used to discover nearby Vibes and to attach approximate location
          information to moments you post.
        </p>

        <div className="mt-8 rounded-2xl border border-vibe-petrol/10 bg-vibe-surface px-5 py-4 text-left">
          <p className="text-sm font-semibold text-vibe-text">What we use it for</p>

          <ul className="mt-3 space-y-2 text-sm text-vibe-muted">
            <li>• Find Vibes within your local area</li>
            <li>• Calculate approximate distance</li>
            <li>• Help rank nearby moments</li>
          </ul>
        </div>

        {error && <p className="mt-6 text-sm font-medium text-red-500">{error}</p>}
      </div>

      <div className="pt-8">
        <button
          className="w-full rounded-2xl bg-vibe-petrol px-5 py-4 font-bold text-vibe-surface shadow-lg shadow-vibe-petrol/15 transition hover:bg-vibe-petrol-light active:scale-[0.98] disabled:opacity-50"
          type="button"
          disabled={loading}
          onClick={handleEnableLocation}>
          {loading ? 'Requesting location...' : 'Enable location'}
        </button>
      </div>
    </div>
  )
}

export default LocationStep
