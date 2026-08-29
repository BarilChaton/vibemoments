import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { FiSend } from 'react-icons/fi'
import { MdGif } from 'react-icons/md'
import GifPicker from './gifPicker.jsx'

const MessageComposer = ({ inputRef, message, sending, maxLength, onChange, onKeyDown, onSend, onGifSelect }) => {
  const { t } = useTranslation()
  const [gifPickerOpen, setGifPickerOpen] = useState(false)

  // ---------------------------------------------------------------------------
  // GIF selection
  // ---------------------------------------------------------------------------

  const handleGifSelect = (gif) => {
    setGifPickerOpen(false)
    onGifSelect?.(gif)
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="relative shrink-0 border-t border-vibe-petrol/10 bg-vibe-surface px-3 pb-8 pt-3">
      {gifPickerOpen && <GifPicker onClose={() => setGifPickerOpen(false)} onSelect={handleGifSelect} />}

      <div className="flex min-w-0 items-end gap-2">
        {/* GIF */}
        <button
          className={`flex size-11 shrink-0 items-center justify-center rounded-full transition active:scale-90 ${
            gifPickerOpen ? 'bg-vibe-petrol text-vibe-surface' : 'bg-vibe-bg text-vibe-petrol'
          }`}
          type="button"
          disabled={sending}
          onClick={() => setGifPickerOpen((current) => !current)}>
          <MdGif className="text-3xl" />
        </button>

        {/* Message */}
        <textarea
          ref={inputRef}
          className="max-h-32 min-h-11 min-w-0 flex-1 resize-none rounded-3xl border border-vibe-petrol/10 bg-vibe-bg px-4 py-3 text-sm leading-5 text-vibe-text outline-none transition placeholder:text-vibe-muted/60 focus:border-vibe-petrol/30"
          placeholder={t('conversation.messages.placeholder')}
          value={message}
          maxLength={maxLength}
          rows={1}
          disabled={sending}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={onKeyDown}
        />

        {/* Send */}
        <button
          className="flex size-11 shrink-0 items-center justify-center rounded-full bg-vibe-apricot text-vibe-text transition active:scale-90 disabled:opacity-30"
          type="button"
          disabled={!message.trim() || sending}
          onClick={onSend}>
          <FiSend className="text-lg" />
        </button>
      </div>
    </div>
  )
}

export default MessageComposer
