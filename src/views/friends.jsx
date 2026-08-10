import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { FiMessageCircle, FiRefreshCw, FiUsers } from 'react-icons/fi'
import { getFriends } from '../services/friends.js'
import UserProfile from './UserProfile.jsx'

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

const formatFriendsSince = (createdAt) => {
  if (!createdAt) return ''

  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    year: 'numeric'
  }).format(new Date(createdAt))
}

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

const Friends = ({ onOpenConversation }) => {
  const [selectedFriendId, setSelectedFriendId] = useState(null)

  const {
    data: friends = [],
    isLoading,
    isFetching,
    error,
    refetch
  } = useQuery({
    queryKey: ['friends'],
    queryFn: getFriends,
    staleTime: 1000 * 30
  })

  // ---------------------------------------------------------------------------
  // Friend profile
  // ---------------------------------------------------------------------------

  if (selectedFriendId) {
    return (
      <UserProfile
        friendId={selectedFriendId}
        onBack={() => setSelectedFriendId(null)}
        onOpenConversation={onOpenConversation}
        onRemoved={() => setSelectedFriendId(null)}
      />
    )
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* Header */}
      <header className="safe-top shrink-0 px-6 pb-4 pt-5">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-vibe-apricot-dark">YOUR PEOPLE</p>

            <h1 className="mt-1 text-3xl font-black text-vibe-petrol">Friends</h1>

            <p className="mt-2 text-sm text-vibe-muted">People you've connected with through real conversations.</p>
          </div>

          <button
            className="flex size-10 shrink-0 items-center justify-center rounded-full bg-vibe-surface text-vibe-petrol shadow-sm transition active:scale-95 disabled:opacity-50"
            type="button"
            disabled={isFetching}
            onClick={() => refetch()}>
            <FiRefreshCw className={isFetching ? 'animate-spin' : ''} />
          </button>
        </div>
      </header>

      {/* Content */}
      <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-24 pt-3">
        {/* Loading */}
        {isLoading && (
          <div className="flex justify-center py-16">
            <div className="size-3 animate-pulse rounded-full bg-vibe-lime" />
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="py-14 text-center">
            <p className="font-semibold text-vibe-text">Couldn't load your friends.</p>

            <p className="mx-auto mt-2 max-w-xs text-sm leading-6 text-vibe-muted">
              {error.message || 'Something went wrong while loading your friends.'}
            </p>

            <button
              className="mt-5 rounded-2xl bg-vibe-petrol px-5 py-3 text-sm font-bold text-vibe-surface active:scale-95"
              type="button"
              onClick={() => refetch()}>
              Try again
            </button>
          </div>
        )}

        {/* Empty */}
        {!isLoading && !error && friends.length === 0 && (
          <div className="py-16 text-center">
            <div className="mx-auto flex size-16 items-center justify-center rounded-full bg-vibe-petrol/10 text-2xl text-vibe-petrol">
              <FiUsers />
            </div>

            <p className="mt-5 text-lg font-bold text-vibe-petrol">No friends yet</p>

            <p className="mx-auto mt-2 max-w-xs text-sm leading-6 text-vibe-muted">
              Keep talking with people you meet through Vibes. When a connection grows naturally, the option to become friends can appear.
            </p>
          </div>
        )}

        {/* Friends */}
        {!isLoading && !error && friends.length > 0 && (
          <div className="space-y-3">
            {friends.map((friend) => {
              const displayName = friend.display_name || friend.username || 'Vibe user'
              const initial = displayName.slice(0, 1).toUpperCase()

              return (
                <div key={friend.friendship_id} className="flex items-center gap-3 rounded-3xl bg-vibe-surface p-4 shadow-sm">
                  {/* Profile */}
                  <button
                    className="flex min-w-0 flex-1 items-center gap-3 text-left transition active:scale-[0.99]"
                    type="button"
                    onClick={() => setSelectedFriendId(friend.friend_id)}>
                    {friend.avatar_url ? (
                      <img className="size-13 shrink-0 rounded-full object-cover" src={friend.avatar_url} alt="" />
                    ) : (
                      <div className="flex size-13 shrink-0 items-center justify-center rounded-full bg-vibe-petrol text-lg font-black text-vibe-surface">
                        {initial}
                      </div>
                    )}

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="truncate font-black text-vibe-petrol">{displayName}</p>
                        <div className="size-1.5 shrink-0 rounded-full bg-vibe-lime" />
                      </div>

                      {friend.username && <p className="mt-0.5 truncate text-xs font-medium text-vibe-muted">@{friend.username}</p>}

                      <p className="mt-1 text-xs text-vibe-muted">Friends since {formatFriendsSince(friend.friends_since)}</p>
                    </div>
                  </button>

                  {/* Chat */}
                  {friend.conversation_id && (
                    <button
                      className="flex size-11 shrink-0 items-center justify-center rounded-full bg-vibe-apricot/20 text-vibe-apricot-dark transition active:scale-90"
                      type="button"
                      onClick={() => onOpenConversation?.(friend.conversation_id)}>
                      <FiMessageCircle />
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

export default Friends
