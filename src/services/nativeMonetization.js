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

export const showNativeAd = async (element) => {
  if (!Capacitor.isNativePlatform() || !element) return

  const rect = element.getBoundingClientRect()

  return VibeNativeAd.showAd({
    x: rect.left,
    y: rect.top,
    width: rect.width,
    height: rect.height
  })
}

export const hideNativeAd = async () => {
  if (!Capacitor.isNativePlatform()) return

  return VibeNativeAd.hideAd()
}
