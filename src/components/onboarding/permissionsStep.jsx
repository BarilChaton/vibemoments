import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { FiArrowLeft, FiBell, FiCamera, FiCheck, FiMapPin, FiSettings } from 'react-icons/fi'
import {
  checkAppPermissions,
  requestCameraPermission,
  requestLocationPermission,
  requestNotificationPermission
} from '../../services/permissions.js'
import { completeOnboarding } from '../../services/onboarding.js'
import useAuthStore from '../../stores/useAuthStore.js'

const PERMISSIONS = ['location', 'camera', 'notifications']

const PermissionsStep = ({ onBack }) => {
  const { t } = useTranslation()
  const { user, setProfile } = useAuthStore()

  const [statuses, setStatuses] = useState({
    location: 'prompt',
    camera: 'prompt',
    notifications: 'prompt'
  })

  const [currentIndex, setCurrentIndex] = useState(0)
  const [checking, setChecking] = useState(true)
  const [requesting, setRequesting] = useState(false)
  const [finishing, setFinishing] = useState(false)
  const [error, setError] = useState('')

  const currentPermission = PERMISSIONS[currentIndex]

  const permissionConfig = useMemo(
    () => ({
      location: {
        icon: FiMapPin,
        title: t('onboarding.permissions.location.title'),
        description: t('onboarding.permissions.location.description')
      },
      camera: {
        icon: FiCamera,
        title: t('onboarding.permissions.camera.title'),
        description: t('onboarding.permissions.camera.description')
      },
      notifications: {
        icon: FiBell,
        title: t('onboarding.permissions.notifications.title'),
        description: t('onboarding.permissions.notifications.description')
      }
    }),
    [t]
  )

  const currentConfig = permissionConfig[currentPermission]
  const CurrentIcon = currentConfig.icon
  const currentStatus = statuses[currentPermission]

  // ---------------------------------------------------------------------------
  // Initial permission check
  // ---------------------------------------------------------------------------

  useEffect(() => {
    let cancelled = false

    const loadPermissions = async () => {
      try {
        const permissions = await checkAppPermissions()

        if (cancelled) return

        setStatuses(permissions)

        const firstMissingIndex = PERMISSIONS.findIndex((permission) => permissions[permission] !== 'granted')

        if (firstMissingIndex >= 0) {
          setCurrentIndex(firstMissingIndex)
        } else {
          setCurrentIndex(PERMISSIONS.length - 1)
        }
      } catch (permissionError) {
        console.error('Failed to check onboarding permissions:', permissionError)

        if (!cancelled) {
          setError(t('onboarding.permissions.checkError'))
        }
      } finally {
        if (!cancelled) {
          setChecking(false)
        }
      }
    }

    loadPermissions()

    return () => {
      cancelled = true
    }
  }, [t])

  // ---------------------------------------------------------------------------
  // Request current permission
  // ---------------------------------------------------------------------------

  const handleRequestPermission = async () => {
    if (requesting) return

    setRequesting(true)
    setError('')

    try {
      if (currentPermission === 'camera') {
        const result = await requestCameraPermission()

        setStatuses((current) => ({
          ...current,
          camera: result.camera
        }))

        return
      }

      if (currentPermission === 'location') {
        const result = await requestLocationPermission()

        const locationGranted = result.location === 'granted' || result.coarseLocation === 'granted'

        setStatuses((current) => ({
          ...current,
          location: locationGranted ? 'granted' : result.location
        }))

        return
      }

      if (currentPermission === 'notifications') {
        const result = await requestNotificationPermission()

        setStatuses((current) => ({
          ...current,
          notifications: result.receive
        }))
      }
    } catch (permissionError) {
      console.error(`Failed to request ${currentPermission} permission:`, permissionError)

      setError(t('onboarding.permissions.requestError'))
    } finally {
      setRequesting(false)
    }
  }

  // ---------------------------------------------------------------------------
  // Next permission
  // ---------------------------------------------------------------------------

  const handleContinue = async () => {
    setError('')

    if (currentIndex < PERMISSIONS.length - 1) {
      setCurrentIndex((current) => current + 1)
      return
    }

    setFinishing(true)

    try {
      const profile = await completeOnboarding(user.id)

      setProfile(profile)
    } catch (completeError) {
      console.error('Failed to complete onboarding:', completeError)

      setError(t('onboarding.permissions.completeError'))
    } finally {
      setFinishing(false)
    }
  }

  // ---------------------------------------------------------------------------
  // Status
  // ---------------------------------------------------------------------------

  const granted = currentStatus === 'granted'
  const blocked = currentStatus === 'blocked'

  const statusText = granted
    ? t('onboarding.permissions.status.granted')
    : blocked
    ? t('onboarding.permissions.status.blocked')
    : currentStatus === 'denied'
    ? t('onboarding.permissions.status.denied')
    : t('onboarding.permissions.status.notGranted')

  // ---------------------------------------------------------------------------
  // Loading
  // ---------------------------------------------------------------------------

  if (checking) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <p className="text-sm text-vibe-muted">{t('onboarding.permissions.checking')}</p>
      </div>
    )
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

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
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-vibe-apricot">
          {t('onboarding.permissions.step', {
            current: currentIndex + 1,
            total: PERMISSIONS.length
          })}
        </p>

        <h1 className="mt-3 text-3xl font-black text-vibe-text">{t('onboarding.permissions.title')}</h1>

        <p className="mt-3 leading-6 text-vibe-muted">{t('onboarding.permissions.description')}</p>
      </div>

      <div className="mt-12 flex flex-1 flex-col items-center justify-center text-center">
        <div className="flex size-24 items-center justify-center rounded-full bg-vibe-surface shadow-sm">
          <CurrentIcon className="text-4xl text-vibe-petrol" />
        </div>

        <h2 className="mt-8 text-xl font-bold text-vibe-text">{currentConfig.title}</h2>

        <p className="mt-3 max-w-xs text-sm leading-6 text-vibe-muted">{currentConfig.description}</p>

        <div className="mt-6 flex items-center gap-2 rounded-full bg-vibe-surface px-4 py-2 text-sm font-semibold">
          {granted && <FiCheck className="text-vibe-lime" />}

          {blocked && <FiSettings className="text-vibe-apricot" />}

          <span className={granted ? 'text-vibe-petrol' : 'text-vibe-muted'}>{statusText}</span>
        </div>

        {blocked && (
          <div className="mt-6 max-w-sm rounded-2xl border border-vibe-apricot/20 bg-vibe-surface px-5 py-4 text-left">
            <p className="text-sm font-semibold text-vibe-text">{t('onboarding.permissions.settings.title')}</p>

            <p className="mt-2 text-sm leading-6 text-vibe-muted">{t('onboarding.permissions.settings.description')}</p>
          </div>
        )}

        {error && <p className="mt-6 text-sm font-medium text-red-500">{error}</p>}
      </div>

      <div className="space-y-3 pt-8">
        {!granted && !blocked && (
          <button
            className="w-full rounded-2xl bg-vibe-petrol px-5 py-4 font-bold text-vibe-surface shadow-lg shadow-vibe-petrol/15 transition hover:bg-vibe-petrol-light active:scale-[0.98] disabled:opacity-50"
            type="button"
            disabled={requesting}
            onClick={handleRequestPermission}>
            {requesting ? t('onboarding.permissions.requesting') : t('onboarding.permissions.allow')}
          </button>
        )}

        <button
          className={`w-full rounded-2xl px-5 py-4 font-bold transition active:scale-[0.98] disabled:opacity-50 ${
            granted
              ? 'bg-vibe-petrol text-vibe-surface shadow-lg shadow-vibe-petrol/15'
              : 'border border-vibe-petrol/15 bg-vibe-surface text-vibe-muted'
          }`}
          type="button"
          disabled={requesting || finishing}
          onClick={handleContinue}>
          {finishing
            ? t('onboarding.permissions.finishing')
            : currentIndex === PERMISSIONS.length - 1
            ? t('onboarding.permissions.finish')
            : t('common.continue')}
        </button>
      </div>
    </div>
  )
}

export default PermissionsStep
