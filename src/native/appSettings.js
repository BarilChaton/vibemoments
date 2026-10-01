import { Capacitor, registerPlugin } from '@capacitor/core'

const AppSettingsNative = registerPlugin('AppSettings')

export const openAppSettings = async () => {
  if (!Capacitor.isNativePlatform()) {
    return false
  }

  try {
    const result = await AppSettingsNative.openAppSettings()

    return result?.opened === true
  } catch (error) {
    console.error('Failed to open app settings:', error)

    return false
  }
}
