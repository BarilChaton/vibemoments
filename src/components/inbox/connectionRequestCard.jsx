import { useState } from 'react'
import { FiArrowRight } from 'react-icons/fi'
import { acceptConnectionRequest } from '../../services/connections.js'

const ConnectionRequestCard = ({ request, onAccepted }) => {
  const [reply, setReply] = useState('')
  const [replying, setReplying] = useState(false)
  const [error, setError] = useState('')

  const handleReply = async () => {
    const trimmed = reply.trim()

    if (!trimmed || replying) return

    setReplying(true)
    setError('')

    try {
      const conversationId = await acceptConnectionRequest({
        requestId: request.id,
        reply: trimmed
      })

      onAccepted?.(conversationId)
    } catch (error) {
      console.error('Failed to accept connection request:', error)
      setError(error.message || 'Could not send your reply.')
    } finally {
      setReplying(false)
    }
  }

  return (
    <div className="rounded-3xl bg-vibe-surface p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-bold text-vibe-petrol">{request.sender?.display_name || 'Someone nearby'}</p>
          <p className="mt-1 text-xs text-vibe-muted">Reached out through your Vibe</p>
        </div>

        <span className="shrink-0 rounded-full bg-vibe-apricot/20 px-3 py-1 text-xs font-semibold text-vibe-apricot-dark">Pending</span>
      </div>

      <div className="mt-4 rounded-2xl border border-vibe-petrol/10 bg-vibe-bg p-4">
        <p className="text-sm leading-6 text-vibe-text">{request.initial_message}</p>
      </div>

      <div className="mt-4">
        <textarea
          className="min-h-24 w-full resize-none rounded-2xl border border-vibe-petrol/15 bg-vibe-bg px-4 py-3 text-sm text-vibe-text outline-none transition placeholder:text-vibe-muted/60 focus:border-vibe-apricot"
          placeholder="Reply to unlock chat..."
          value={reply}
          maxLength={1000}
          disabled={replying}
          onChange={(event) => {
            setReply(event.target.value)
            setError('')
          }}
        />

        {error && <p className="mt-2 text-sm font-medium text-red-500">{error}</p>}

        <button
          className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl bg-vibe-apricot px-4 py-3 font-bold text-vibe-text transition active:scale-[0.98] disabled:opacity-40"
          type="button"
          disabled={!reply.trim() || replying}
          onClick={handleReply}>
          {replying ? 'Replying...' : 'Reply & unlock chat'}
          {!replying && <FiArrowRight />}
        </button>
      </div>
    </div>
  )
}

export default ConnectionRequestCard
