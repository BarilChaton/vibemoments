import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { FiArrowLeft, FiCheck, FiGlobe, FiMapPin } from 'react-icons/fi'
import { updateVibeRadius } from '../services/profile.js'
import { SUPPORTED_LANGUAGES, getResolvedLanguage, getSavedLanguage, saveLanguage } from '../services/language.js'
import useAuthStore from '../stores/useAuthStore.js'

const MIN_VIBE_RADIUS_KM = 5
const MAX_VIBE_RADIUS_KM = 25

const Settings = ({ onBack }) => {
  const { t, i18n } = useTranslation()
  const { user, profile, setProfile } = useAuthStore()
  const queryClient = useQueryClient()

  const [selectedLanguage, setSelectedLanguage] = useState(getSavedLanguage())

  const [vibeRadiusKm, setVibeRadiusKm] = useState(Math.round((profile?.vibe_radius_meters || 5000) / 1000))
  const [savingVibeRadius, setSavingVibeRadius] = useState(false)
  const [radiusError, setRadiusError] = useState('')
  const [radiusSuccess, setRadiusSuccess] = useState('')

  // ---------------------------------------------------------------------------
  // Language
  // ---------------------------------------------------------------------------

  const handleLanguageChange = async (language) => {
    setSelectedLanguage(language)
    saveLanguage(language)

    if (language === 'system') {
      await i18n.changeLanguage(getResolvedLanguage())
      return
    }

    await i18n.changeLanguage(language)
  }

  // ---------------------------------------------------------------------------
  // Vibe distance
  // ---------------------------------------------------------------------------

  const handleSaveVibeRadius = async () => {
    if (!user?.id || savingVibeRadius) return

    const radiusMeters = vibeRadiusKm * 1000
    const currentRadiusMeters = profile?.vibe_radius_meters || 5000

    if (radiusMeters === currentRadiusMeters) return

    setSavingVibeRadius(true)
    setRadiusError('')
    setRadiusSuccess('')

    try {
      const updatedProfile = await updateVibeRadius({
        userId: user.id,
        radiusMeters
      })

      setProfile(updatedProfile)

      await queryClient.invalidateQueries({
        queryKey: ['nearby-vibes']
      })

      setRadiusSuccess(
        t('profile.distance.updated', {
          distance: vibeRadiusKm
        })
      )
    } catch (error) {
      console.error('Failed to update Vibe distance:', error)

      setRadiusError(t('profile.distance.updateError'))
      setVibeRadiusKm(Math.round((profile?.vibe_radius_meters || 5000) / 1000))
    } finally {
      setSavingVibeRadius(false)
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="shrink-0 px-4 pb-4 pt-5">
        <div className="flex items-center gap-3">
          <button
            className="flex size-10 shrink-0 items-center justify-center rounded-full text-vibe-petrol transition active:scale-95"
            type="button"
            onClick={onBack}>
            <FiArrowLeft className="text-xl" />
          </button>

          <div>
            <p className="text-sm font-semibold text-vibe-apricot-dark">{t('settings.eyebrow')}</p>

            <h1 className="mt-1 text-3xl font-black text-vibe-petrol">{t('settings.title')}</h1>
          </div>
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-28">
        {/* Language */}
        <div className="mt-2">
          <div className="flex items-center gap-3">
            <div className="flex size-11 items-center justify-center rounded-full bg-vibe-petrol/10 text-vibe-petrol">
              <FiGlobe />
            </div>

            <div>
              <h2 className="font-black text-vibe-petrol">{t('settings.language.title')}</h2>

              <p className="mt-1 text-xs text-vibe-muted">{t('settings.language.description')}</p>
            </div>
          </div>

          <div className="mt-4 max-h-72 overflow-y-auto rounded-3xl bg-vibe-surface">
            {SUPPORTED_LANGUAGES.map((language) => {
              const active = selectedLanguage === language.code

              return (
                <button
                  key={language.code}
                  className="flex w-full items-center justify-between border-b border-vibe-petrol/5 px-5 py-4 text-left last:border-b-0 active:bg-vibe-bg"
                  type="button"
                  onClick={() => handleLanguageChange(language.code)}>
                  <div>
                    <p className="font-semibold text-vibe-text">
                      {language.code === 'system' ? t('settings.language.system') : language.label}
                    </p>

                    {language.code === 'system' && (
                      <p className="mt-1 text-xs text-vibe-muted">
                        {t('settings.language.current', {
                          language: getResolvedLanguage().toUpperCase()
                        })}
                      </p>
                    )}
                  </div>

                  {active && <FiCheck className="text-xl text-vibe-petrol" />}
                </button>
              )
            })}
          </div>
        </div>

        {/* Vibe distance */}
        <div className="mt-8">
          <div className="flex items-start gap-3">
            <div className="flex size-11 shrink-0 items-center justify-center rounded-full bg-vibe-petrol/10 text-vibe-petrol">
              <FiMapPin />
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="font-black text-vibe-petrol">{t('profile.distance.title')}</h2>

                  <p className="mt-1 text-xs leading-5 text-vibe-muted">{t('profile.distance.description')}</p>
                </div>

                <div className="shrink-0 rounded-full bg-vibe-petrol px-3 py-1.5 text-sm font-black text-vibe-surface">
                  {t('profile.distance.value', {
                    distance: vibeRadiusKm
                  })}
                </div>
              </div>
            </div>
          </div>

          <div className="mt-4 rounded-3xl bg-vibe-surface p-5 shadow-sm">
            <input
              className="w-full accent-vibe-petrol"
              type="range"
              min={MIN_VIBE_RADIUS_KM}
              max={MAX_VIBE_RADIUS_KM}
              step="1"
              value={vibeRadiusKm}
              disabled={savingVibeRadius}
              onChange={(event) => {
                setVibeRadiusKm(Number(event.target.value))
                setRadiusError('')
                setRadiusSuccess('')
              }}
              onPointerUp={handleSaveVibeRadius}
              onTouchEnd={handleSaveVibeRadius}
              onKeyUp={handleSaveVibeRadius}
            />

            <div className="mt-2 flex items-center justify-between text-[11px] font-semibold text-vibe-muted">
              <span>{t('profile.distance.value', { distance: MIN_VIBE_RADIUS_KM })}</span>
              <span>{t('profile.distance.value', { distance: MAX_VIBE_RADIUS_KM })}</span>
            </div>

            <p className="mt-4 text-xs leading-5 text-vibe-muted">{t('profile.distance.ownVibesNotice')}</p>

            {savingVibeRadius && <p className="mt-3 text-xs font-semibold text-vibe-petrol">{t('profile.distance.saving')}</p>}

            {radiusError && <p className="mt-3 text-xs font-semibold text-red-500">{radiusError}</p>}

            {radiusSuccess && <p className="mt-3 text-xs font-semibold text-vibe-petrol">{radiusSuccess}</p>}
          </div>
        </div>
      </div>
    </div>
  )
}

export default Settings
