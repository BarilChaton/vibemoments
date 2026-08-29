import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { FiArrowRight, FiX } from 'react-icons/fi'
import { createConnectionRequest } from '../../services/connections.js'

const MAX_MESSAGE_LENGTH = 500

const ConnectionRequestComposer = ({ vibe, onClose, onSent }) => {
  const { t } = useTranslation()

  const [message, setMessage] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')

  const handleSend = async () => {
    const trimmed = message.trim()

    if (!trimmed || sending) return

    setSending(true)
    setError('')

    try {
      const request = await createConnectionRequest({
        vibeId: vibe.id,
        message: trimmed
      })

      onSent?.(request)
    } catch (error) {
      console.error('Failed to send connection request:', error)

      if (error.code === '23505') {
        setError(t('vibe.connection.composer.alreadyUsed'))
      } else {
        setError(t('vibe.connection.composer.sendError'))
      }
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="absolute inset-0 z-70 flex items-end bg-black/35 px-3 pb-[calc(env(safe-area-inset-bottom)+1rem)] backdrop-blur-sm">
      <div
        className="w-full rounded-3xl border border-white/15 bg-vibe-bg p-5 shadow-2xl"
        onTouchStart={(event) => event.stopPropagation()}
        onTouchMove={(event) => event.stopPropagation()}
        onTouchEnd={(event) => event.stopPropagation()}>
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.15em] text-vibe-apricot-dark">
              {t('vibe.connection.composer.eyebrow')}
            </p>

            <h2 className="mt-2 text-xl font-black text-vibe-petrol">{t('vibe.connection.composer.title', { name: vibe.display_name })}</h2>
          </div>

          <button
            className="flex size-10 shrink-0 items-center justify-center rounded-full bg-vibe-surface text-vibe-muted transition active:scale-95"
            type="button"
            disabled={sending}
            onClick={onClose}>
            <FiX className="text-xl" />
          </button>
        </div>

        <div className="mt-4 rounded-2xl bg-vibe-surface p-4">
          <p className="text-sm font-semibold text-vibe-petrol">{t('vibe.connection.composer.oneMessageTitle')}</p>

          <p className="mt-1 text-sm leading-5 text-vibe-muted">{t('vibe.connection.composer.oneMessageDescription')}</p>
        </div>

        <div className="mt-4">
          <textarea
            className="min-h-28 w-full resize-none rounded-2xl border border-vibe-petrol/15 bg-vibe-surface px-4 py-4 text-vibe-text outline-none transition placeholder:text-vibe-muted/60 focus:border-vibe-apricot"
            placeholder={t('vibe.connection.composer.placeholder')}
            value={message}
            maxLength={MAX_MESSAGE_LENGTH}
            disabled={sending}
            autoFocus
            onChange={(event) => {
              setMessage(event.target.value)
              setError('')
            }}
          />

          <div className="mt-2 flex justify-end">
            <span className="text-xs text-vibe-muted">
              {message.length}/{MAX_MESSAGE_LENGTH}
            </span>
          </div>
        </div>

        {error && <p className="mt-3 text-sm font-medium text-red-500">{error}</p>}

        <button
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-vibe-apricot px-5 py-4 font-bold text-vibe-text transition active:scale-[0.98] disabled:opacity-40"
          type="button"
          disabled={!message.trim() || sending}
          onClick={handleSend}>
          {sending ? (
            t('vibe.connection.composer.sending')
          ) : (
            <>
              {t('vibe.connection.composer.send')}
              <FiArrowRight />
            </>
          )}
        </button>
      </div>
    </div>
  )
}

export default ConnectionRequestComposer
