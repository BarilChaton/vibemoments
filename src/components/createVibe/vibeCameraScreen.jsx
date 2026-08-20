import { VibeCamera } from '@barilchaton/vibemoments-camera'

const VibeCameraScreen = ({ error, captureSession, initialMode, onCapture, onError, onClose }) => {
  return (
    <div className="relative flex flex-1 overflow-hidden bg-transparent">
      <VibeCamera captureSession={captureSession} initialMode={initialMode} onCapture={onCapture} onError={onError} onClose={onClose} />

      {error && (
        <div className="absolute left-4 right-4 top-20 z-30 rounded-2xl bg-red-500/90 px-4 py-3 text-center text-sm font-medium text-white backdrop-blur-md">
          {error}
        </div>
      )}
    </div>
  )
}

export default VibeCameraScreen
