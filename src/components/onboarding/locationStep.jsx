import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Geolocation } from '@capacitor/geolocation'
import { FiArrowLeft, FiMapPin } from 'react-icons/fi'
import { completeOnboarding } from '../../services/onboarding.js'
import useAuthStore from '../../stores/useAuthStore.js'

const LocationStep = ({ onBack }) => {
  const { t } = useTranslation()
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
        setError(t('onboarding.location.permissionRequired'))
        return
      }

      await Geolocation.getCurrentPosition({
        enableHighAccuracy: true,
        timeout: 10000
      })

      const profile = await completeOnboarding(user.id)
      setProfile(profile)
    } catch (locationError) {
      console.error('Failed to enable onboarding location:', locationError)
      setError(t('onboarding.location.error'))
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
        {t('common.back')}
      </button>

      <div>
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-vibe-apricot">{t('onboarding.location.step')}</p>

        <h1 className="mt-3 text-3xl font-black text-vibe-text">{t('onboarding.location.title')}</h1>

        <p className="mt-3 leading-6 text-vibe-muted">{t('onboarding.location.description')}</p>
      </div>

      <div className="mt-12 flex flex-1 flex-col items-center justify-center text-center">
        <div className="flex size-24 items-center justify-center rounded-full bg-vibe-surface shadow-sm">
          <FiMapPin className="text-4xl text-vibe-petrol" />
        </div>

        <h2 className="mt-8 text-xl font-bold text-vibe-text">{t('onboarding.location.privacyTitle')}</h2>

        <p className="mt-3 max-w-xs text-sm leading-6 text-vibe-muted">{t('onboarding.location.privacyDescription')}</p>

        <div className="mt-8 rounded-2xl border border-vibe-petrol/10 bg-vibe-surface px-5 py-4 text-left">
          <p className="text-sm font-semibold text-vibe-text">{t('onboarding.location.usesTitle')}</p>

          <ul className="mt-3 space-y-2 text-sm text-vibe-muted">
            <li>• {t('onboarding.location.uses.findNearby')}</li>
            <li>• {t('onboarding.location.uses.distance')}</li>
            <li>• {t('onboarding.location.uses.ranking')}</li>
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
          {loading ? t('onboarding.location.requesting') : t('onboarding.location.enable')}
        </button>
      </div>
    </div>
  )
}

export default LocationStep
