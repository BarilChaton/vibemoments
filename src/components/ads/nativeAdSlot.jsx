import { useEffect, useRef } from 'react'
import { Capacitor } from '@capacitor/core'
import { hideNativeAd, loadNativeAd, showNativeAd } from '../../services/nativeMonetization.js'

const NativeAdSlot = () => {
  const slotRef = useRef(null)

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return

    let cancelled = false

    const setupAd = async () => {
      try {
        await loadNativeAd()

        if (cancelled || !slotRef.current) return

        await showNativeAd(slotRef.current)
      } catch (error) {
        console.error('Failed to prepare native ad:', error)
      }
    }

    setupAd()

    return () => {
      cancelled = true

      hideNativeAd().catch(() => {})
    }
  }, [])

  if (!Capacitor.isNativePlatform()) {
    return (
      <div className="col-span-2 flex h-72 items-center justify-center rounded-3xl border border-dashed border-vibe-muted/30 bg-vibe-surface text-xs text-vibe-muted">
        Native ad slot
      </div>
    )
  }

  return <div ref={slotRef} className="col-span-2 h-72" />
}

export default NativeAdSlot
