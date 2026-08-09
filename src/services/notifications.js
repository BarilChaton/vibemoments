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

  console.log('Push token saved to Supabase.')
}

// -----------------------------------------------------------------------------
// Listeners
// -----------------------------------------------------------------------------

const registerPushListeners = async () => {
  if (listenersRegistered) return

  listenersRegistered = true

  await PushNotifications.addListener('registration', async (token) => {
    console.log('FCM registration token:', token.value)

    await savePushToken(token.value)
  })

  await PushNotifications.addListener('registrationError', (error) => {
    console.error('Push notification registration failed:', error)
  })

  await PushNotifications.addListener('pushNotificationReceived', (notification) => {
    console.log('Push notification received:', notification)
  })

  await PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
    console.log('Push notification opened:', action.notification)

    const conversationId = action.notification.data?.conversationId

    if (conversationId) {
      console.log('Notification conversation:', conversationId)
    }
  })
}

// -----------------------------------------------------------------------------
// Register
// -----------------------------------------------------------------------------

export const registerPushNotifications = async (userId) => {
  if (!userId) return false

  if (!Capacitor.isNativePlatform()) {
    console.log('Push notifications skipped outside native app.')
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
      console.log('Push notification permission was not granted.')
      return false
    }

    await PushNotifications.register()

    return true
  } catch (error) {
    console.error('Failed to register push notifications:', error)
    return false
  }
}
