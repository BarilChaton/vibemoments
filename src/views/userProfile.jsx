import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { FiArrowLeft, FiMessageCircle, FiTrash2, FiUser, FiX } from 'react-icons/fi'
import { getFriendProfile, removeFriend } from '../services/friends.js'
import { getUserInterests } from '../services/interests.js'
import useAuthStore from '../stores/useAuthStore.js'

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

const formatDate = (createdAt) => {
  if (!createdAt) return ''

  return new Intl.DateTimeFormat(undefined, {
    month: 'long',
    year: 'numeric'
  }).format(new Date(createdAt))
}

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

const UserProfile = ({ friendId, onBack, onOpenConversation, onRemoved }) => {
  const { user } = useAuthStore()
  const queryClient = useQueryClient()

  const [removeOpen, setRemoveOpen] = useState(false)
  const [removing, setRemoving] = useState(false)
  const [removeError, setRemoveError] = useState('')

  // ---------------------------------------------------------------------------
  // Friend profile
  // ---------------------------------------------------------------------------

  const {
    data: profile,
    isLoading,
    error
  } = useQuery({
    queryKey: ['friend-profile', friendId],
    queryFn: () => getFriendProfile(friendId),
    enabled: Boolean(friendId),
    staleTime: 1000 * 30
  })

  // ---------------------------------------------------------------------------
  // Current user's interests
  // ---------------------------------------------------------------------------

  const { data: myInterests = [] } = useQuery({
    queryKey: ['user-interests', user?.id],
    queryFn: () => getUserInterests(user.id),
    enabled: Boolean(user?.id),
    staleTime: 1000 * 30
  })

  // ---------------------------------------------------------------------------
  // Shared interests
  // ---------------------------------------------------------------------------

  const myInterestIds = new Set(myInterests.map((interest) => interest.id))

  const sharedInterests = (profile?.interests || []).filter((interest) => {
    return myInterestIds.has(interest.id)
  })

  // ---------------------------------------------------------------------------
  // Remove friend
  // ---------------------------------------------------------------------------

  const handleRemoveFriend = async () => {
    if (!friendId || removing) return

    setRemoving(true)
    setRemoveError('')

    try {
      const removed = await removeFriend(friendId)

      if (!removed) {
        throw new Error('Friendship could not be removed.')
      }

      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ['friends']
        }),

        queryClient.invalidateQueries({
          queryKey: ['friend-profile', friendId]
        }),

        queryClient.invalidateQueries({
          queryKey: ['friendship-state']
        }),

        queryClient.invalidateQueries({
          queryKey: ['profile-stats']
        })
      ])

      setRemoveOpen(false)
      onRemoved?.()
    } catch (error) {
      console.error('Failed to remove friend:', error)
      setRemoveError(error.message || 'Could not remove this friend.')
    } finally {
      setRemoving(false)
    }
  }

  // ---------------------------------------------------------------------------
  // Loading
  // ---------------------------------------------------------------------------

  if (isLoading) {
    return (
      <div className="flex min-h-0 flex-1 items-center justify-center">
        <div className="text-center">
          <div className="mx-auto size-3 animate-pulse rounded-full bg-vibe-lime" />
          <p className="mt-4 text-sm text-vibe-muted">Loading profile...</p>
        </div>
      </div>
    )
  }

  // ---------------------------------------------------------------------------
  // Error
  // ---------------------------------------------------------------------------

  if (error) {
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        <header className="safe-top flex shrink-0 items-center gap-3 px-4 pb-4 pt-5">
          <button
            className="flex size-10 items-center justify-center rounded-full text-vibe-petrol active:scale-95"
            type="button"
            onClick={onBack}>
            <FiArrowLeft />
          </button>

          <p className="font-bold text-vibe-petrol">Profile</p>
        </header>

        <div className="flex flex-1 items-center justify-center px-6 text-center">
          <div>
            <p className="font-semibold text-vibe-text">Couldn't load this profile.</p>
            <p className="mt-2 text-sm text-vibe-muted">{error.message}</p>
          </div>
        </div>
      </div>
    )
  }

  const displayName = profile?.display_name || profile?.username || 'Vibe user'
  const initial = displayName.slice(0, 1).toUpperCase()

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* Header */}
      <header className="safe-top flex shrink-0 items-center gap-3 px-4 pb-4 pt-5">
        <button
          className="flex size-10 shrink-0 items-center justify-center rounded-full text-vibe-petrol transition active:scale-95"
          type="button"
          onClick={onBack}>
          <FiArrowLeft className="text-xl" />
        </button>

        <div>
          <p className="text-sm font-semibold text-vibe-apricot-dark">FRIEND PROFILE</p>
          <h1 className="text-xl font-black text-vibe-petrol">{displayName}</h1>
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-28">
        {/* Identity */}
        <div className="rounded-3xl bg-vibe-surface p-6 shadow-sm">
          {profile?.avatar_url ? (
            <img className="size-20 rounded-full object-cover" src={profile.avatar_url} alt="" />
          ) : (
            <div className="flex size-20 items-center justify-center rounded-full bg-vibe-petrol text-3xl font-black text-vibe-surface">
              {initial}
            </div>
          )}

          <h2 className="mt-5 text-2xl font-black text-vibe-text">{displayName}</h2>

          {profile?.username && <p className="mt-1 text-sm font-medium text-vibe-muted">@{profile.username}</p>}

          {profile?.bio ? (
            <p className="mt-5 whitespace-pre-wrap text-sm leading-6 text-vibe-text">{profile.bio}</p>
          ) : (
            <p className="mt-5 text-sm text-vibe-muted">No bio yet.</p>
          )}

          <div className="mt-5 flex flex-wrap gap-x-5 gap-y-2 text-xs text-vibe-muted">
            {profile?.created_at && <span>Member since {formatDate(profile.created_at)}</span>}
            {profile?.friends_since && <span>Friends since {formatDate(profile.friends_since)}</span>}
          </div>
        </div>

        {/* Shared interests */}
        <div className="mt-7">
          <h3 className="font-black text-vibe-petrol">Shared interests</h3>

          <p className="mt-1 text-xs text-vibe-muted">Things you both chose as part of your Vibe identity.</p>

          <div className="mt-4 flex flex-wrap gap-2">
            {sharedInterests.length > 0 ? (
              sharedInterests.map((interest) => (
                <span key={interest.id} className="rounded-full bg-vibe-apricot/20 px-3 py-2 text-sm font-semibold text-vibe-petrol">
                  {interest.name}
                </span>
              ))
            ) : (
              <p className="text-sm text-vibe-muted">No shared interests yet.</p>
            )}
          </div>
        </div>

        {/* Their interests */}
        {profile?.interests?.length > 0 && (
          <div className="mt-7">
            <h3 className="font-black text-vibe-petrol">Their interests</h3>

            <div className="mt-4 flex flex-wrap gap-2">
              {profile.interests.map((interest) => (
                <span
                  key={interest.id}
                  className={`rounded-full px-3 py-2 text-sm font-semibold ${
                    myInterestIds.has(interest.id) ? 'bg-vibe-apricot/20 text-vibe-petrol' : 'bg-vibe-surface text-vibe-muted'
                  }`}>
                  {interest.name}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="mt-8 space-y-3">
          {profile?.conversation_id && (
            <button
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-vibe-petrol px-5 py-4 font-bold text-vibe-surface transition active:scale-[0.98]"
              type="button"
              onClick={() => onOpenConversation?.(profile.conversation_id)}>
              <FiMessageCircle />
              Message
            </button>
          )}

          <button
            className="flex w-full items-center justify-center gap-2 rounded-2xl border border-red-500/20 bg-vibe-surface px-5 py-4 font-semibold text-red-500 transition active:scale-[0.98]"
            type="button"
            onClick={() => {
              setRemoveError('')
              setRemoveOpen(true)
            }}>
            <FiTrash2 />
            Remove friend
          </button>
        </div>
      </div>

      {/* Remove confirmation */}
      {removeOpen && (
        <div className="fixed inset-0 z-60 flex items-end justify-center bg-black/50 px-4 pb-6 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-3xl bg-vibe-bg p-5 shadow-xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="flex size-11 items-center justify-center rounded-full bg-red-500/10 text-red-500">
                  <FiUser />
                </div>

                <h3 className="mt-4 text-lg font-black text-vibe-text">Remove {displayName}?</h3>

                <p className="mt-2 text-sm leading-6 text-vibe-muted">
                  You'll no longer be friends, but your existing conversation and message history will stay intact.
                </p>
              </div>

              <button
                className="flex size-9 shrink-0 items-center justify-center rounded-full bg-vibe-surface text-vibe-muted active:scale-95"
                type="button"
                disabled={removing}
                onClick={() => setRemoveOpen(false)}>
                <FiX />
              </button>
            </div>

            {removeError && <p className="mt-4 text-sm font-medium text-red-500">{removeError}</p>}

            <div className="mt-6 flex gap-2">
              <button
                className="flex-1 rounded-2xl bg-vibe-surface px-4 py-3.5 text-sm font-semibold text-vibe-muted active:scale-[0.98]"
                type="button"
                disabled={removing}
                onClick={() => setRemoveOpen(false)}>
                Cancel
              </button>

              <button
                className="flex-1 rounded-2xl bg-red-500 px-4 py-3.5 text-sm font-bold text-white active:scale-[0.98] disabled:opacity-50"
                type="button"
                disabled={removing}
                onClick={handleRemoveFriend}>
                {removing ? 'Removing...' : 'Remove friend'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default UserProfile
