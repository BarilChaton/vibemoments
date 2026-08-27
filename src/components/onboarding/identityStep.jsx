import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { FiClock, FiRefreshCw } from 'react-icons/fi'
import { generateDisplayName } from '../../utils/generateDisplayName.js'
import { saveDisplayName } from '../../services/onboarding.js'
import useAuthStore from '../../stores/useAuthStore.js'

const MAX_HISTORY = 6

const IdentityStep = ({ onNext }) => {
  const { t } = useTranslation()
  const { user, setProfile } = useAuthStore()

  const [displayName, setDisplayName] = useState(() => generateDisplayName())
  const [nameHistory, setNameHistory] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const addToHistory = (name) => {
    const trimmedName = name.trim()

    if (!trimmedName) return

    setNameHistory((current) => [trimmedName, ...current.filter((item) => item !== trimmedName)].slice(0, MAX_HISTORY))
  }

  const generateAnother = () => {
    addToHistory(displayName)
    setDisplayName(generateDisplayName())
    setError('')
  }

  const selectPreviousName = (name) => {
    if (displayName.trim() !== name) addToHistory(displayName)

    setDisplayName(name)
    setNameHistory((current) => current.filter((item) => item !== name))
    setError('')
  }

  const handleContinue = async () => {
    const name = displayName.trim()

    if (name.length < 3) {
      setError(t('onboarding.identity.minimumLengthError'))
      return
    }

    setError('')
    setLoading(true)

    try {
      const profile = await saveDisplayName(user.id, name)

      setProfile(profile)
      onNext()
    } catch (saveError) {
      console.error('Failed to save display name:', saveError)
      setError(t('onboarding.identity.saveError'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-1 flex-col">
      <div>
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-vibe-apricot">{t('onboarding.identity.step')}</p>

        <h1 className="mt-3 text-3xl font-black text-vibe-text">{t('onboarding.identity.title')}</h1>

        <p className="mt-3 leading-6 text-vibe-muted">{t('onboarding.identity.description')}</p>
      </div>

      <div className="mt-12">
        <label className="text-sm font-semibold text-vibe-muted" htmlFor="display-name">
          {t('onboarding.identity.displayName')}
        </label>

        <input
          id="display-name"
          className="mt-3 w-full rounded-2xl border border-vibe-petrol/15 bg-vibe-surface px-5 py-4 text-lg font-semibold text-vibe-text outline-none transition placeholder:text-vibe-muted/50 focus:border-vibe-petrol focus:ring-2 focus:ring-vibe-petrol/10"
          type="text"
          value={displayName}
          maxLength={30}
          autoComplete="off"
          onChange={(e) => {
            setDisplayName(e.target.value)
            setError('')
          }}
        />

        <button
          className="mt-4 flex items-center gap-2 text-sm font-semibold text-vibe-apricot-dark transition hover:text-vibe-apricot active:opacity-60"
          type="button"
          onClick={generateAnother}>
          <FiRefreshCw />
          {t('onboarding.identity.generateAnother')}
        </button>

        {nameHistory.length > 0 && (
          <div className="mt-8">
            <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-vibe-muted">
              <FiClock />
              {t('onboarding.identity.previousNames')}
            </div>

            <div className="flex flex-wrap gap-2">
              {nameHistory.map((name) => (
                <button
                  key={name}
                  className="rounded-full border border-vibe-petrol/15 bg-vibe-surface px-4 py-2 text-sm font-medium text-vibe-text transition hover:border-vibe-apricot hover:bg-vibe-apricot/10 active:scale-95"
                  type="button"
                  onClick={() => selectPreviousName(name)}>
                  {name}
                </button>
              ))}
            </div>
          </div>
        )}

        <p className="mt-6 text-sm leading-6 text-vibe-muted">{t('onboarding.identity.nameExplanation')}</p>

        {error && <p className="mt-4 text-sm font-medium text-red-500">{error}</p>}
      </div>

      <div className="mt-auto pt-8">
        <button
          className="w-full rounded-2xl bg-vibe-petrol px-5 py-4 font-bold text-vibe-surface shadow-lg shadow-vibe-petrol/15 transition hover:bg-vibe-petrol-light active:scale-[0.98] disabled:opacity-50"
          type="button"
          disabled={loading}
          onClick={handleContinue}>
          {loading ? t('onboarding.identity.saving') : t('common.continue')}
        </button>
      </div>
    </div>
  )
}

export default IdentityStep
