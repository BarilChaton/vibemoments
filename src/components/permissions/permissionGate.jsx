import { useCallback, useEffect, useState } from 'react'
import { Capacitor } from '@capacitor/core'
import { App as CapacitorApp } from '@capacitor/app'
import { checkAppPermissions } from '../../services/permissions.js'
import PermissionsStep from '../onboarding/permissionsStep.jsx'

const PermissionGate = ({ children }) => {
  const isNative = Capacitor.isNativePlatform()

  const [checking, setChecking] = useState(isNative)
  const [needsPermissions, setNeedsPermissions] = useState(false)
  const [sessionCompleted, setSessionCompleted] = useState(false)

  useEffect(() => {
    if (!isNative) return

    let cancelled = false
    let appStateListener = null

    const checkPermissions = async () => {
      try {
        const permissions = await checkAppPermissions()

        if (cancelled) return

        const missing = permissions.camera !== 'granted' || permissions.location !== 'granted' || permissions.notifications !== 'granted'

        setNeedsPermissions(missing)
      } catch (error) {
        console.error('Failed to check app permissions:', error)
      } finally {
        if (!cancelled) {
          setChecking(false)
        }
      }
    }

    const setup = async () => {
      await checkPermissions()

      appStateListener = await CapacitorApp.addListener('appStateChange', async ({ isActive }) => {
        if (!isActive || sessionCompleted) return

        await checkPermissions()
      })
    }

    setup()

    return () => {
      cancelled = true
      appStateListener?.remove()
    }
  }, [isNative, sessionCompleted])

  const handleComplete = useCallback(() => {
    setSessionCompleted(true)
    setNeedsPermissions(false)
  }, [])

  if (checking) {
    return (
      <main className="flex min-h-dvh items-center justify-center bg-vibe-bg text-vibe-text">
        <p className="text-sm font-medium text-vibe-muted">Checking permissions...</p>
      </main>
    )
  }

  if (needsPermissions && !sessionCompleted) {
    return (
      <main className="min-h-dvh bg-vibe-bg text-vibe-text">
        <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-6 pb-[calc(env(safe-area-inset-bottom)+2rem)] pt-[calc(env(safe-area-inset-top)+2rem)]">
          <PermissionsStep recoveryMode onComplete={handleComplete} />
        </div>
      </main>
    )
  }

  return children
}

export default PermissionGate
