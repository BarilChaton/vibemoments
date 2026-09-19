import { Capacitor, registerPlugin } from '@capacitor/core'

const VibeNativeAd = registerPlugin('VibeNativeAd')

export const loadNativeAd = async () => {
  if (!Capacitor.isNativePlatform()) {
    console.log('Native ads skipped: browser environment')

    return null
  }

  return VibeNativeAd.loadAd({
    adUnitId: 'ca-app-pub-3940256099942544/2247696110'
  })
}
