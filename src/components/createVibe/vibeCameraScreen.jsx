import { useRef, useState } from 'react'
import { VibeCamera, Camera } from '@barilchaton/vibemoments-camera'

const VibeCameraScreen = ({ error, captureSession, captureSessionUpdating, initialMode, onModeChange, onCapture, onError, onClose }) => {
  const pinchStartDistanceRef = useRef(null)
  const pinchStartZoomRef = useRef(1)
  const lastAppliedZoomRef = useRef(1)
  const lastZoomCallRef = useRef(0)

  const [zoom, setZoom] = useState(1)
  const [minZoom, setMinZoom] = useState(1)
  const [maxZoom, setMaxZoom] = useState(1)

  const getTouchDistance = (touches) => {
    if (touches.length < 2) return null

    const first = touches[0]
    const second = touches[1]

    return Math.hypot(second.clientX - first.clientX, second.clientY - first.clientY)
  }

  const clampZoom = (value) => {
    return Math.min(Math.max(value, minZoom), maxZoom)
  }

  const applyZoom = async (nextZoom) => {
    const now = performance.now()

    if (now - lastZoomCallRef.current < 35) return

    const clampedZoom = clampZoom(nextZoom)

    if (Math.abs(clampedZoom - lastAppliedZoomRef.current) < 0.02) return

    lastZoomCallRef.current = now
    lastAppliedZoomRef.current = clampedZoom

    try {
      const result = await Camera.setZoomRatio(clampedZoom)

      const appliedZoom = result?.ratio ?? clampedZoom

      lastAppliedZoomRef.current = appliedZoom

      setZoom(appliedZoom)
    } catch (zoomError) {
      console.error('[VibeCamera] Unable to set zoom', zoomError)
    }
  }

  const handleTouchStart = async (event) => {
    if (event.touches.length !== 2) return

    const distance = getTouchDistance(event.touches)

    if (!distance) return

    event.preventDefault()

    pinchStartDistanceRef.current = distance

    try {
      const zoomState = await Camera.getZoomState()

      const currentZoom = zoomState?.ratio ?? 1
      const currentMinZoom = zoomState?.minRatio ?? 1
      const currentMaxZoom = zoomState?.maxRatio ?? 1

      pinchStartZoomRef.current = currentZoom
      lastAppliedZoomRef.current = currentZoom

      setZoom(currentZoom)
      setMinZoom(currentMinZoom)
      setMaxZoom(currentMaxZoom)
    } catch (zoomError) {
      console.error('[VibeCamera] Unable to get zoom state', zoomError)

      pinchStartZoomRef.current = zoom
    }
  }

  const handleTouchMove = (event) => {
    if (event.touches.length !== 2 || pinchStartDistanceRef.current === null) {
      return
    }

    const distance = getTouchDistance(event.touches)

    if (!distance) return

    event.preventDefault()

    const scale = distance / pinchStartDistanceRef.current
    const nextZoom = pinchStartZoomRef.current * scale

    applyZoom(nextZoom)
  }

  const handleTouchEnd = (event) => {
    if (event.touches.length >= 2) return

    pinchStartDistanceRef.current = null
  }

  return (
    <div
      className="relative flex flex-1 overflow-hidden bg-transparent"
      style={{ touchAction: 'none' }}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchEnd}>
      <VibeCamera
        captureSession={captureSession}
        sessionUpdating={captureSessionUpdating}
        initialMode={initialMode}
        onModeChange={onModeChange}
        onCapture={onCapture}
        onError={onError}
        onClose={onClose}
      />

      {zoom > 1.01 && (
        <div className="pointer-events-none absolute left-1/2 top-20 z-30 -translate-x-1/2 rounded-full bg-black/50 px-3 py-1.5 text-sm font-semibold text-white backdrop-blur-md">
          {zoom.toFixed(1)}x
        </div>
      )}

      {captureSessionUpdating && (
        <div className="pointer-events-none absolute inset-x-0 top-32 z-30 flex justify-center px-4">
          <div className="rounded-full bg-black/65 px-4 py-2 text-sm font-semibold text-white backdrop-blur-md">
            Preparing secure capture...
          </div>
        </div>
      )}

      {error && (
        <div className="absolute left-4 right-4 top-20 z-30 rounded-2xl bg-red-500/90 px-4 py-3 text-center text-sm font-medium text-white backdrop-blur-md">
          {error}
        </div>
      )}
    </div>
  )
}

export default VibeCameraScreen
