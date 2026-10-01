import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { FiArrowLeft, FiBell, FiCamera, FiCheck, FiMapPin, FiSettings } from 'react-icons/fi'
import { App as CapacitorApp } from '@capacitor/app'
import { openAppSettings } from '../../native/appSettings.js'
import {
  checkAppPermissions,
  requestCameraPermission,
  requestLocationPermission,
  requestNotificationPermission
} from '../../services/permissions.js'
import { completeOnboarding } from '../../services/onboarding.js'
import useAuthStore from '../../stores/useAuthStore.js'

const PERMISSIONS = ['location', 'camera', 'notifications']

const PermissionsStep = ({ onBack, recoveryMode = false, onComplete }) => {
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

  const findNextMissingPermission = (currentStatuses, startIndex) => {
    for (let index = startIndex; index < PERMISSIONS.length; index += 1) {
      if (currentStatuses[PERMISSIONS[index]] !== 'granted') {
        return index
      }
    }

    return -1
  }

  const applyPermissionStatuses = useCallback(
    (permissions) => {
      setStatuses(permissions)

      const firstMissingIndex = PERMISSIONS.findIndex((permission) => permissions[permission] !== 'granted')

      if (firstMissingIndex >= 0) {
        setCurrentIndex(firstMissingIndex)
        return
      }

      if (recoveryMode) {
        onComplete?.()
        return
      }

      setCurrentIndex(PERMISSIONS.length - 1)
    },
    [recoveryMode, onComplete]
  )

  // ---------------------------------------------------------------------------
  // Open Android settings
  // ---------------------------------------------------------------------------

  const handleOpenSettings = async () => {
    setError('')

    const opened = await openAppSettings()

    if (!opened) {
      setError(t('onboarding.permissions.settings.openError'))
    }
  }

  // ---------------------------------------------------------------------------
  // Initial permission check
  // ---------------------------------------------------------------------------

  useEffect(() => {
    let cancelled = false

    const loadPermissions = async () => {
      try {
        const permissions = await checkAppPermissions()

        if (cancelled) return

        applyPermissionStatuses(permissions)
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
  }, [applyPermissionStatuses, onComplete, recoveryMode, t])

  // ---------------------------------------------------------------------------
  // Re-check permissions after returning from Android settings
  // ---------------------------------------------------------------------------

  useEffect(() => {
    let cancelled = false
    let listener = null

    const refreshPermissions = async () => {
      try {
        const permissions = await checkAppPermissions()

        if (cancelled) return

        applyPermissionStatuses(permissions)
      } catch (permissionError) {
        console.error('Failed to refresh permissions:', permissionError)
      }
    }

    const setupListener = async () => {
      listener = await CapacitorApp.addListener('appStateChange', async ({ isActive }) => {
        if (!isActive) return

        await refreshPermissions()
      })
    }

    setupListener()

    return () => {
      cancelled = true
      listener?.remove()
    }
  }, [applyPermissionStatuses, onComplete, recoveryMode])

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

    const nextMissingIndex = findNextMissingPermission(statuses, currentIndex + 1)

    if (nextMissingIndex >= 0) {
      setCurrentIndex(nextMissingIndex)
      return
    }

    setFinishing(true)

    try {
      if (recoveryMode) {
        onComplete?.()
        return
      }

      const profile = await completeOnboarding(user.id)

      setProfile(profile)
    } catch (completeError) {
      console.error('Failed to complete permission setup:', completeError)

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
      {!recoveryMode && (
        <button
          className="mb-6 flex w-fit items-center gap-2 text-sm font-medium text-vibe-muted transition hover:text-vibe-petrol active:opacity-50"
          type="button"
          onClick={onBack}>
          <FiArrowLeft />
          {t('common.back')}
        </button>
      )}

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
          <div className="mt-6 w-full max-w-sm rounded-2xl border border-vibe-apricot/20 bg-vibe-surface px-5 py-4 text-left">
            <p className="text-sm font-semibold text-vibe-text">{t('onboarding.permissions.settings.title')}</p>

            <p className="mt-2 text-sm leading-6 text-vibe-muted">{t('onboarding.permissions.settings.description')}</p>

            <button
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-vibe-petrol px-4 py-3 text-sm font-bold text-vibe-surface transition active:scale-[0.98]"
              type="button"
              onClick={handleOpenSettings}>
              <FiSettings />
              {t('onboarding.permissions.settings.open')}
            </button>
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
