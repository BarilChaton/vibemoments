import { FiCamera, FiVideo } from 'react-icons/fi'
import { useTranslation } from 'react-i18next'
import { MAX_VIDEO_DURATION } from '../../utils/vibeMedia.js'

const VibeCaptureScreen = ({ error, onOpenCamera }) => {
  const { t } = useTranslation()

  return (
    <div className="flex flex-1 flex-col">
      <header className="px-6 pb-4 pt-5">
        <p className="text-sm font-semibold text-vibe-apricot-dark">{t('createVibe.capture.eyebrow')}</p>

        <h1 className="mt-1 text-3xl font-black text-vibe-petrol">{t('createVibe.capture.title')}</h1>

        <p className="mt-2 text-sm text-vibe-muted">{t('createVibe.capture.description')}</p>
      </header>

      <div className="flex flex-1 flex-col justify-center px-6">
        <button
          className="flex w-full flex-col items-center justify-center rounded-3xl bg-vibe-surface px-6 py-10 transition active:scale-[0.98]"
          type="button"
          onClick={onOpenCamera}>
          <div className="flex size-20 items-center justify-center rounded-full bg-vibe-petrol/10">
            <FiCamera className="text-4xl text-vibe-petrol" />
          </div>

          <span className="mt-5 text-lg font-bold text-vibe-text">{t('createVibe.capture.openCamera')}</span>

          <span className="mt-1 text-sm text-vibe-muted">{t('createVibe.capture.cameraDescription')}</span>

          <div className="mt-5 flex items-center gap-3 text-xs font-semibold text-vibe-muted">
            <span className="flex items-center gap-1.5">
              <FiCamera />
              {t('createVibe.capture.photo')}
            </span>

            <span className="size-1 rounded-full bg-vibe-muted/40" />

            <span className="flex items-center gap-1.5">
              <FiVideo />
              {t('createVibe.capture.videoMaximum', { seconds: MAX_VIDEO_DURATION })}
            </span>
          </div>
        </button>

        <p className="mx-auto mt-6 max-w-xs text-center text-sm leading-6 text-vibe-muted">{t('createVibe.capture.explanation')}</p>

        {error && <p className="mt-5 text-center text-sm font-medium text-red-500">{error}</p>}
      </div>
    </div>
  )
}

export default VibeCaptureScreen
