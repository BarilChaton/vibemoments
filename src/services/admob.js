import { AdMob, AdmobConsentStatus } from '@capacitor-community/admob'
import { Capacitor } from '@capacitor/core'

let initializationPromise = null

export const initializeAdMob = async () => {
  if (!Capacitor.isNativePlatform()) return false

  if (initializationPromise) return initializationPromise

  initializationPromise = (async () => {
    await AdMob.initialize()

    let consentInfo = await AdMob.requestConsentInfo()

    if (consentInfo.isConsentFormAvailable && consentInfo.status === AdmobConsentStatus.REQUIRED) {
      consentInfo = await AdMob.showConsentForm()
    }

    return consentInfo.canRequestAds === true
  })()

  try {
    return await initializationPromise
  } catch (error) {
    initializationPromise = null
    throw error
  }
}
