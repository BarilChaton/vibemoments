import { Capacitor } from '@capacitor/core'
import { PushNotifications } from '@capacitor/push-notifications'
import { supabase } from './supabase.js'

let listenersRegistered = false
let currentUserId = null

// -----------------------------------------------------------------------------
// Save token
// -----------------------------------------------------------------------------

const savePushToken = async (token) => {
  if (!currentUserId || !token) return

  const { error } = await supabase.from('push_tokens').upsert(
    {
      user_id: currentUserId,
      token,
      platform: Capacitor.getPlatform(),
      updated_at: new Date().toISOString()
    },
    {
      onConflict: 'user_id,token'
    }
  )

  if (error) {
    console.error('Failed to save push token:', error)
    return
  }
}

// -----------------------------------------------------------------------------
// Listeners
// -----------------------------------------------------------------------------

const registerPushListeners = async () => {
  if (listenersRegistered) return

  listenersRegistered = true

  await PushNotifications.addListener('registration', async (token) => {
    await savePushToken(token.value)
  })

  await PushNotifications.addListener('registrationError', (error) => {
    console.error('Push notification registration failed:', error)
  })
}

// -----------------------------------------------------------------------------
// Register
// -----------------------------------------------------------------------------

export const registerPushNotifications = async (userId) => {
  if (!userId) return false

  if (!Capacitor.isNativePlatform()) {
    return false
  }

  currentUserId = userId

  try {
    await registerPushListeners()

    let permission = await PushNotifications.checkPermissions()

    if (permission.receive !== 'granted') {
      permission = await PushNotifications.requestPermissions()
    }

    if (permission.receive !== 'granted') {
      return false
    }

    await PushNotifications.register()

    return true
  } catch (error) {
    console.error('Failed to register push notifications:', error)
    return false
  }
}
