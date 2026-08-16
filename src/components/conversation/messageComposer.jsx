import { FiSend } from 'react-icons/fi'

const MessageComposer = ({ inputRef, message, sending, maxLength, onChange, onKeyDown, onSend }) => {
  return (
    <div className="shrink-0 border-t border-vibe-petrol/10 bg-vibe-surface px-3 pb-8 pt-3">
      <div className="flex min-w-0 items-end gap-2">
        <textarea
          ref={inputRef}
          className="max-h-32 min-h-11 min-w-0 flex-1 resize-none rounded-3xl border border-vibe-petrol/10 bg-vibe-bg px-4 py-3 text-sm leading-5 text-vibe-text outline-none transition placeholder:text-vibe-muted/60 focus:border-vibe-petrol/30"
          placeholder="Message..."
          value={message}
          maxLength={maxLength}
          rows={1}
          disabled={sending}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={onKeyDown}
        />

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
