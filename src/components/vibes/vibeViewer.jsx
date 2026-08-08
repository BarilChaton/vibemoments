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
      left: 12 + Math.random() * 76,
      drift: Math.round(Math.random() * 160 - 80),
      rotation: Math.round(Math.random() * 50 - 25)
    }

    setFloatingReactions((current) => [...current, floatingReaction])

    setTimeout(() => {
      setFloatingReactions((current) => current.filter((item) => item.id !== floatingReaction.id))
    }, 1250)
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
    <div className="fixed inset-0 z-50 overflow-hidden bg-black">
      {isLoading ? (
        <div className="flex h-full items-center justify-center">
          <div className="text-center">
            <div className="mx-auto size-3 animate-pulse rounded-full bg-vibe-lime" />
            <p className="mt-4 text-sm text-white/60">Loading Vibe...</p>
          </div>
        </div>
      ) : error ? (
        <div className="flex h-full items-center justify-center px-6 text-center text-white">
          <div>
            <p className="font-semibold">Couldn't load this Vibe.</p>
            <p className="mt-2 text-sm text-white/60">{error.message}</p>
          </div>
        </div>
      ) : (
        <>
          <div className="absolute inset-0">
            {vibe.media_type === 'photo' && <img className="h-full w-full object-cover" src={data.mediaUrl} alt="" />}

            <div className="absolute inset-0 bg-linear-to-b from-black/25 via-transparent to-black/65" />
          </div>

          <div className="safe-top absolute inset-x-0 top-2 z-30 flex items-center justify-between px-4 py-2">
            <button
              className="flex size-11 items-center justify-center rounded-full border border-white/15 bg-black/25 text-white backdrop-blur-md transition active:scale-95"
              type="button"
              onClick={onClose}>
              <FiX className="text-2xl" />
            </button>

            <div className="flex items-center gap-2 rounded-full border border-white/15 bg-black/25 px-3 py-2 text-xs font-semibold text-white backdrop-blur-md">
              <div className="size-2 rounded-full bg-vibe-lime" />
              LIVE
            </div>
          </div>

          <div className="pointer-events-none absolute inset-0 z-50 overflow-hidden">
            {floatingReactions.map((reaction) => (
              <span
                key={reaction.id}
                className="absolute bottom-20 text-4xl animate-vibe-reaction"
                style={{
                  left: `${reaction.left}%`,
                  '--reaction-drift': `${reaction.drift}px`,
                  '--reaction-rotation': `${reaction.rotation}deg`
                }}>
                {reaction.emoji}
              </span>
            ))}
          </div>

          <div className="absolute inset-x-0 bottom-24 z-20 px-4">
            <div className="rounded-3xl border border-white/15 bg-black/30 p-4 text-white shadow-lg backdrop-blur-md">
              <div className="flex items-center gap-2">
                <h2 className="truncate text-lg font-bold">{vibe.display_name}</h2>
                <div className="size-2 shrink-0 rounded-full bg-vibe-lime" />
              </div>

              <div className="mt-1 flex items-center gap-1.5 text-xs text-white/70">
                <FiMapPin />
                <span>{formatDistance(vibe.distance_meters)}</span>
                <span>·</span>
                <span>{formatAge(vibe.created_at)}</span>
              </div>

              {vibe.caption && <p className="mt-3 text-sm leading-6 text-white/95">{vibe.caption}</p>}

              {data.interests.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {data.interests.map((interest) => (
                    <span
                      className="rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-semibold text-white backdrop-blur-sm"
                      key={interest.id}>
                      {interest.name}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="safe-bottom absolute inset-x-0 bottom-0 z-30 px-3 pb-3">
            <div className="rounded-3xl border border-white/15 bg-black/25 px-3 py-2.5 shadow-lg backdrop-blur-xl">
              <div className="flex items-center justify-between gap-1">
                {REACTIONS.map((emoji) => (
                  <button
                    key={emoji}
                    className="flex size-11 items-center justify-center rounded-full bg-white/10 text-2xl transition hover:bg-white/20 active:scale-75"
                    type="button"
                    onClick={() => handleReaction(emoji)}>
                    {emoji}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

export default VibeViewer
