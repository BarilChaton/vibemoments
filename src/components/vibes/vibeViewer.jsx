import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { FiMapPin, FiX } from 'react-icons/fi'
import {
  getVibeInterests,
  getVibeMediaUrl,
  sendVibeReaction,
  subscribeToVibeReactions,
  unsubscribeFromVibeReactions
} from '../../services/vibes.js'
import useAuthStore from '../../stores/useAuthStore.js'

const REACTIONS = ['❤️', '😂', '🔥', '😍', '👏', '😮']

const formatDistance = (meters) => {
  if (meters < 1000) return `${Math.round(meters)} m away`

  return `${(meters / 1000).toFixed(1)} km away`
}

const formatAge = (createdAt) => {
  const seconds = Math.floor((Date.now() - new Date(createdAt).getTime()) / 1000)

  if (seconds < 60) return 'Just now'

  const minutes = Math.floor(seconds / 60)

  if (minutes < 60) return `${minutes}m ago`

  const hours = Math.floor(minutes / 60)

  if (hours < 24) return `${hours}h ago`

  return `${Math.floor(hours / 24)}d ago`
}

const loadVibeDetails = async (vibe) => {
  const [mediaUrl, interests] = await Promise.all([getVibeMediaUrl(vibe.media_path), getVibeInterests(vibe.id)])

  return {
    mediaUrl,
    interests
  }
}

const VibeViewer = ({ vibe, onClose }) => {
  const { user } = useAuthStore()

  const [floatingReactions, setFloatingReactions] = useState([])

  const { data, isLoading, error } = useQuery({
    queryKey: ['vibe-view', vibe.id],
    queryFn: () => loadVibeDetails(vibe),
    staleTime: 1000 * 60 * 5
  })

  const showFloatingReaction = (reaction) => {
    const floatingReaction = {
      id: `${reaction.id}-${Date.now()}-${Math.random()}`,
      emoji: reaction.emoji,
      left: 12 + Math.random() * 76
    }

    setFloatingReactions((current) => [...current, floatingReaction])

    setTimeout(() => {
      setFloatingReactions((current) => current.filter((item) => item.id !== floatingReaction.id))
    }, 2500)
  }

  const handleReaction = async (emoji) => {
    if (!user) return

    try {
      await sendVibeReaction({
        vibeId: vibe.id,
        userId: user.id,
        emoji
      })
    } catch (error) {
      console.error('Failed to send Vibe reaction:', error)
    }
  }

  useEffect(() => {
    const channel = subscribeToVibeReactions(vibe.id, (reaction) => {
      showFloatingReaction(reaction)
    })

    return () => {
      unsubscribeFromVibeReactions(channel)
    }
  }, [vibe.id])

  return (
    <div className="fixed inset-0 z-50 flex flex-col overflow-hidden bg-vibe-bg text-vibe-text pt-4">
      <div className="safe-top flex shrink-0 items-center justify-between px-4 pb-3 pt-6">
        <button
          className="flex size-11 items-center justify-center rounded-full bg-vibe-surface text-vibe-petrol shadow-sm transition active:scale-95"
          type="button"
          onClick={onClose}>
          <FiX className="text-2xl" />
        </button>

        <div className="flex items-center gap-2 rounded-full bg-vibe-surface px-3 py-2 text-xs font-semibold text-vibe-petrol shadow-sm">
          <div className="size-2 rounded-full bg-vibe-lime" />
          LIVE
        </div>
      </div>

      <div className="relative mx-3 shrink-0 overflow-hidden rounded-3xl bg-black">
        {isLoading ? (
          <div className="flex aspect-3/4 items-center justify-center">
            <div className="text-center">
              <div className="mx-auto size-3 animate-pulse rounded-full bg-vibe-lime" />
              <p className="mt-4 text-sm text-white/60">Loading Vibe...</p>
            </div>
          </div>
        ) : error ? (
          <div className="flex aspect-3/4 items-center justify-center px-6 text-center text-white">
            <div>
              <p className="font-semibold">Couldn't load this Vibe.</p>
              <p className="mt-2 text-sm text-white/60">{error.message}</p>
            </div>
          </div>
        ) : (
          vibe.media_type === 'photo' && <img className="max-h-[58dvh] w-full object-contain" src={data.mediaUrl} alt="" />
        )}

        <div className="pointer-events-none absolute inset-0 z-20 overflow-hidden">
          {floatingReactions.map((reaction) => (
            <span key={reaction.id} className="absolute bottom-4 text-4xl animate-vibe-reaction" style={{ left: `${reaction.left}%` }}>
              {reaction.emoji}
            </span>
          ))}
        </div>
      </div>

      {!isLoading && !error && (
        <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-5 pt-5">
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="truncate text-lg font-bold text-vibe-petrol">{vibe.display_name}</h2>
                <div className="size-2 rounded-full bg-vibe-lime" />
              </div>

              <div className="mt-1 flex items-center gap-1.5 text-xs text-vibe-muted">
                <FiMapPin />
                <span>{formatDistance(vibe.distance_meters)}</span>
                <span>·</span>
                <span>{formatAge(vibe.created_at)}</span>
              </div>
            </div>
          </div>

          {vibe.caption && <p className="mt-4 text-sm leading-6 text-vibe-text">{vibe.caption}</p>}

          {data.interests.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2">
              {data.interests.map((interest) => (
                <span
                  className="rounded-full border border-vibe-petrol/15 bg-vibe-surface px-3 py-1.5 text-xs font-semibold text-vibe-petrol"
                  key={interest.id}>
                  {interest.name}
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {!isLoading && !error && (
        <div className="safe-bottom shrink-0 border-t border-vibe-petrol/10 bg-vibe-surface px-4">
          <div className="flex items-center justify-between gap-2 py-4">
            {REACTIONS.map((emoji) => (
              <button
                key={emoji}
                className="flex size-11 items-center justify-center rounded-full bg-vibe-bg text-2xl shadow-sm transition active:scale-75"
                type="button"
                onClick={() => handleReaction(emoji)}>
                {emoji}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export default VibeViewer
