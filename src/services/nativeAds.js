import { registerPlugin } from '@capacitor/core'

const VibeNativeAd = registerPlugin('VibeNativeAd')

export const loadNativeAd = async () => {
  return VibeNativeAd.loadAd({
    adUnitId: 'ca-app-pub-3940256099942544/2247696110'
  })
}
