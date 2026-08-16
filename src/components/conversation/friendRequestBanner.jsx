import { FiCheck, FiX } from 'react-icons/fi'

const FriendRequestBanner = ({ otherUser, loading, onRespond }) => {
  return (
    <div className="shrink-0 border-b border-vibe-petrol/10 bg-vibe-apricot/15 px-4 py-3">
      <div className="flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-vibe-petrol">Friend request</p>

          <p className="mt-0.5 text-xs leading-5 text-vibe-muted">
            {otherUser?.display_name || 'This person'} would like to add you as a friend.
          </p>
        </div>

        <button
          className="flex size-10 shrink-0 items-center justify-center rounded-full bg-vibe-bg text-vibe-muted transition active:scale-95 disabled:opacity-50"
          type="button"
          title="Decline"
          disabled={loading}
          onClick={() => onRespond(false)}>
          <FiX />
        </button>

        <button
          className="flex size-10 shrink-0 items-center justify-center rounded-full bg-vibe-apricot text-vibe-text transition active:scale-95 disabled:opacity-50"
          type="button"
          title="Accept"
          disabled={loading}
          onClick={() => onRespond(true)}>
          <FiCheck />
        </button>
      </div>
    </div>
  )
}

export default FriendRequestBanner
