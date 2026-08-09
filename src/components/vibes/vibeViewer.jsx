import { useEffect, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { FiMapPin, FiX } from 'react-icons/fi'
import {
  getVibeInterests,
  getVibeMediaUrl,
  sendVibeReaction,
  subscribeToVibeReactions,
  unsubscribeFromVibeReactions
} from '../../services/vibes.js'
import { getConnectionRequestForVibe } from '../../services/connections.js'
import { formatVibeLocation } from '../../utils/formatVibeLocation.js'
import useAuthStore from '../../stores/useAuthStore.js'
import ConnectionRequestComposer from './ConnectionRequestComposer.jsx'

const REACTIONS = ['❤️', '😂', '🔥', '😍', '👏', '😮']

const VERTICAL_SWIPE_THRESHOLD = 70
const HORIZONTAL_SWIPE_THRESHOLD = 90
const GESTURE_LOCK_THRESHOLD = 12
const TRANSITION_DURATION = 280

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

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

// -----------------------------------------------------------------------------
// Vibe slide
// -----------------------------------------------------------------------------

const VibeSlide = ({ vibe, active = false, floatingReactions = [], onClose, onReaction }) => {
  const videoRef = useRef(null)
  const [videoReady, setVideoReady] = useState(false)

  const { data, isLoading, error } = useQuery({
    queryKey: ['vibe-view', vibe.id],
    queryFn: () => loadVibeDetails(vibe),
    staleTime: 1000 * 60 * 5
  })

  const fallbackImage = vibe.thumbnail_url || vibe.media_url || null

  const photoUrl = vibe.media_type === 'photo' ? data?.mediaUrl || fallbackImage : null
  const videoUrl = vibe.media_type === 'video' ? data?.mediaUrl : null

  useEffect(() => {
    const video = videoRef.current

    if (!video) return

    if (active) {
      video.currentTime = 0

      video.play().catch(() => {})
    } else {
      video.pause()
    }
  }, [active, videoUrl])

  return (
    <div className="relative h-full w-full overflow-hidden bg-black">
      {vibe.media_type === 'photo' && photoUrl && <img className="absolute inset-0 h-full w-full object-cover" src={photoUrl} alt="" />}

      {vibe.media_type === 'video' && fallbackImage && (
        <img
          className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-200 ${
            videoReady ? 'opacity-0' : 'opacity-100'
          }`}
          src={fallbackImage}
          alt=""
        />
      )}

      {vibe.media_type === 'video' && videoUrl && (
        <video
          ref={videoRef}
          className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-200 ${
            videoReady ? 'opacity-100' : 'opacity-0'
          }`}
          src={videoUrl}
          loop
          playsInline
          preload={active ? 'auto' : 'metadata'}
          poster={fallbackImage || undefined}
          onCanPlay={() => setVideoReady(true)}
        />
      )}

      {isLoading && !fallbackImage && (
        <div className="absolute inset-0 flex items-center justify-center bg-black">
          <div className="text-center">
            <div className="mx-auto size-3 animate-pulse rounded-full bg-vibe-lime" />
            <p className="mt-4 text-sm text-white/60">Loading Vibe...</p>
          </div>
        </div>
      )}

      {error && !fallbackImage && (
        <div className="absolute inset-0 flex items-center justify-center bg-black px-6 text-center text-white">
          <div>
            <p className="font-semibold">Couldn't load this Vibe.</p>
            <p className="mt-2 text-sm text-white/60">{error.message}</p>
          </div>
        </div>
      )}

      <div className="pointer-events-none absolute inset-0 bg-linear-to-b from-black/25 via-transparent to-black/65" />

      {active && (
        <>
          {/* Top controls */}
          <div className="safe-top absolute inset-x-0 top-2 z-30 flex items-center justify-between px-4 py-2">
            <button
              className="flex size-11 items-center justify-center rounded-full border border-white/15 bg-black/25 text-white backdrop-blur-md transition active:scale-95"
              type="button"
              onTouchStart={(event) => event.stopPropagation()}
              onTouchMove={(event) => event.stopPropagation()}
              onTouchEnd={(event) => event.stopPropagation()}
              onClick={onClose}>
              <FiX className="text-2xl" />
            </button>

            <div className="flex items-center gap-2 rounded-full border border-white/15 bg-black/25 px-3 py-2 text-xs font-semibold text-white backdrop-blur-md">
              <div className="size-2 rounded-full bg-vibe-lime" />
              LIVE
            </div>
          </div>

          {/* Floating reactions */}
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

          {/* Vibe information */}
          <div className="absolute inset-x-0 bottom-24 z-20 px-4">
            <div className="rounded-3xl border border-white/15 bg-black/30 p-4 text-white shadow-lg backdrop-blur-md">
              <div className="flex items-center gap-2">
                <h2 className="truncate text-lg font-bold">{vibe.display_name}</h2>
                <div className="size-2 shrink-0 rounded-full bg-vibe-lime" />
              </div>

              <div className="mt-1 flex items-center gap-1.5 text-xs text-white/70">
                <FiMapPin />
                <span className="truncate">{formatVibeLocation(vibe)}</span>
                <span>·</span>
                <span className="shrink-0">{formatAge(vibe.created_at)}</span>
              </div>

              {vibe.caption && <p className="mt-3 text-sm leading-6 text-white/95">{vibe.caption}</p>}

              {data?.interests?.length > 0 && (
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

          {/* Reaction controls */}
          <div
            className="safe-bottom absolute inset-x-0 bottom-0 z-30 px-3 pb-3"
            onTouchStart={(event) => event.stopPropagation()}
            onTouchMove={(event) => event.stopPropagation()}
            onTouchEnd={(event) => event.stopPropagation()}>
            <div className="rounded-3xl border border-white/15 bg-black/25 px-3 py-2.5 shadow-lg backdrop-blur-xl">
              <div className="flex items-center justify-between gap-1">
                {REACTIONS.map((emoji) => (
                  <button
                    key={emoji}
                    className="flex size-11 items-center justify-center rounded-full bg-white/10 text-2xl transition hover:bg-white/20 active:scale-75"
                    type="button"
                    onClick={() => onReaction(emoji)}>
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

// -----------------------------------------------------------------------------
// Viewer
// -----------------------------------------------------------------------------

const VibeViewer = ({ vibes, initialIndex, onClose }) => {
  const { user } = useAuthStore()

  const [activeIndex, setActiveIndex] = useState(initialIndex)

  const [touchStartX, setTouchStartX] = useState(null)
  const [touchStartY, setTouchStartY] = useState(null)

  const [touchCurrentX, setTouchCurrentX] = useState(null)
  const [touchCurrentY, setTouchCurrentY] = useState(null)

  const [gestureAxis, setGestureAxis] = useState(null)

  const [slideX, setSlideX] = useState(0)
  const [slideY, setSlideY] = useState(0)

  const [animateSlide, setAnimateSlide] = useState(false)
  const [transitioning, setTransitioning] = useState(false)

  const [floatingReactions, setFloatingReactions] = useState([])

  const [connectionComposerOpen, setConnectionComposerOpen] = useState(false)
  const [connectionRequest, setConnectionRequest] = useState(null)

  const vibe = vibes[activeIndex]

  const previousVibe = activeIndex > 0 ? vibes[activeIndex - 1] : null
  const nextVibe = activeIndex < vibes.length - 1 ? vibes[activeIndex + 1] : null

  // ---------------------------------------------------------------------------
  // Existing connection request
  // ---------------------------------------------------------------------------

  const { data: existingConnectionRequest } = useQuery({
    queryKey: ['vibe-connection-request', vibe.id, user?.id],
    queryFn: () =>
      getConnectionRequestForVibe({
        vibeId: vibe.id,
        userId: user.id
      }),
    enabled: Boolean(user?.id && vibe?.id && vibe.user_id !== user?.id),
    staleTime: 1000 * 30
  })

  const currentConnectionRequest = connectionRequest?.vibe_id === vibe.id ? connectionRequest : existingConnectionRequest

  // ---------------------------------------------------------------------------
  // Reactions
  // ---------------------------------------------------------------------------

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
    }, 2000)
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

  // ---------------------------------------------------------------------------
  // Gestures
  // ---------------------------------------------------------------------------

  const resetGesture = () => {
    setTouchStartX(null)
    setTouchStartY(null)
    setTouchCurrentX(null)
    setTouchCurrentY(null)
    setGestureAxis(null)
  }

  const handleTouchStart = (event) => {
    if (transitioning || connectionComposerOpen) return

    const touch = event.touches[0]

    setAnimateSlide(false)

    setTouchStartX(touch.clientX)
    setTouchStartY(touch.clientY)

    setTouchCurrentX(touch.clientX)
    setTouchCurrentY(touch.clientY)

    setGestureAxis(null)
  }

  const handleTouchMove = (event) => {
    if (touchStartX === null || touchStartY === null || transitioning || connectionComposerOpen) return

    const touch = event.touches[0]

    const deltaX = touch.clientX - touchStartX
    const deltaY = touch.clientY - touchStartY

    setTouchCurrentX(touch.clientX)
    setTouchCurrentY(touch.clientY)

    let axis = gestureAxis

    if (!axis && (Math.abs(deltaX) > GESTURE_LOCK_THRESHOLD || Math.abs(deltaY) > GESTURE_LOCK_THRESHOLD)) {
      axis = Math.abs(deltaX) > Math.abs(deltaY) ? 'horizontal' : 'vertical'
      setGestureAxis(axis)
    }

    if (axis === 'vertical') {
      let offset = deltaY

      if (activeIndex === 0 && offset > 0) offset *= 0.2
      if (activeIndex === vibes.length - 1 && offset < 0) offset *= 0.2

      setSlideY(offset)
      setSlideX(0)
    }

    if (axis === 'horizontal') {
      // We only have an action on swipe-right for now.
      // Swipe-left gets resistance rather than moving freely.
      const offset = deltaX < 0 ? deltaX * 0.15 : deltaX

      setSlideX(offset)
      setSlideY(0)
    }
  }

  const changeVibe = (direction) => {
    if (transitioning) return

    const nextIndex = direction === 'up' ? activeIndex + 1 : activeIndex - 1

    if (nextIndex < 0 || nextIndex >= vibes.length) {
      setAnimateSlide(true)
      setSlideY(0)
      return
    }

    const viewportHeight = window.innerHeight
    const destination = direction === 'up' ? -viewportHeight : viewportHeight

    setTransitioning(true)
    setAnimateSlide(true)
    setSlideY(destination)

    setTimeout(() => {
      setAnimateSlide(false)

      setActiveIndex(nextIndex)
      setFloatingReactions([])
      setConnectionRequest(null)

      setSlideY(0)
      setSlideX(0)

      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setTransitioning(false)
        })
      })
    }, TRANSITION_DURATION)
  }

  const openConnectionComposer = () => {
    setAnimateSlide(true)
    setSlideX(0)

    if (!user) return
    if (vibe.user_id === user.id) return

    if (currentConnectionRequest) return

    setConnectionComposerOpen(true)
  }

  const handleTouchEnd = () => {
    if (transitioning) return

    const deltaX = touchStartX !== null && touchCurrentX !== null ? touchCurrentX - touchStartX : 0
    const deltaY = touchStartY !== null && touchCurrentY !== null ? touchStartY - touchCurrentY : 0

    const axis = gestureAxis

    resetGesture()

    if (axis === 'horizontal') {
      if (deltaX >= HORIZONTAL_SWIPE_THRESHOLD) {
        openConnectionComposer()
        return
      }

      setAnimateSlide(true)
      setSlideX(0)
      return
    }

    if (axis === 'vertical') {
      if (deltaY > VERTICAL_SWIPE_THRESHOLD) {
        changeVibe('up')
        return
      }

      if (deltaY < -VERTICAL_SWIPE_THRESHOLD) {
        changeVibe('down')
        return
      }
    }

    setAnimateSlide(true)
    setSlideX(0)
    setSlideY(0)
  }

  const handleTouchCancel = () => {
    resetGesture()

    setAnimateSlide(true)
    setSlideX(0)
    setSlideY(0)
  }

  // ---------------------------------------------------------------------------
  // Connection request
  // ---------------------------------------------------------------------------

  const handleConnectionSent = (request) => {
    setConnectionRequest({
      ...request,
      vibe_id: vibe.id
    })

    setConnectionComposerOpen(false)
  }

  // ---------------------------------------------------------------------------
  // Realtime
  // ---------------------------------------------------------------------------

  useEffect(() => {
    const channel = subscribeToVibeReactions(vibe.id, (reaction) => {
      showFloatingReaction(reaction)
    })

    return () => {
      unsubscribeFromVibeReactions(channel)
    }
  }, [vibe.id])

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div
      className="fixed inset-0 z-50 overflow-hidden bg-black touch-none"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchCancel}>
      {/* Previous Vibe */}
      {previousVibe && (
        <div
          className={`absolute inset-0 ${animateSlide ? 'transition-transform ease-out' : ''}`}
          style={{
            transform: `translate3d(0, calc(-100% + ${slideY}px), 0)`,
            transitionDuration: animateSlide ? `${TRANSITION_DURATION}ms` : '0ms'
          }}>
          <VibeSlide key={previousVibe.id} vibe={previousVibe} />
        </div>
      )}

      {/* Current Vibe */}
      <div
        className={`absolute inset-0 ${animateSlide ? 'transition-transform ease-out' : ''}`}
        style={{
          transform: `translate3d(${slideX}px, ${slideY}px, 0)`,
          transitionDuration: animateSlide ? `${TRANSITION_DURATION}ms` : '0ms'
        }}>
        <VibeSlide key={vibe.id} vibe={vibe} active floatingReactions={floatingReactions} onClose={onClose} onReaction={handleReaction} />
      </div>

      {/* Next Vibe */}
      {nextVibe && (
        <div
          className={`absolute inset-0 ${animateSlide ? 'transition-transform ease-out' : ''}`}
          style={{
            transform: `translate3d(0, calc(100% + ${slideY}px), 0)`,
            transitionDuration: animateSlide ? `${TRANSITION_DURATION}ms` : '0ms'
          }}>
          <VibeSlide key={nextVibe.id} vibe={nextVibe} />
        </div>
      )}

      {/* Right-swipe visual hint */}
      {gestureAxis === 'horizontal' && slideX > 30 && !currentConnectionRequest && vibe.user_id !== user?.id && (
        <div
          className="pointer-events-none absolute left-5 top-1/2 z-40 -translate-y-1/2 rounded-full border border-white/20 bg-black/30 px-4 py-2 text-sm font-bold text-white backdrop-blur-md"
          style={{
            opacity: Math.min(1, slideX / HORIZONTAL_SWIPE_THRESHOLD)
          }}>
          Connect →
        </div>
      )}

      {/* Existing request state */}
      {currentConnectionRequest && (
        <div className="pointer-events-none absolute left-1/2 top-20 z-40 -translate-x-1/2 rounded-full border border-white/15 bg-black/30 px-4 py-2 text-xs font-semibold text-white backdrop-blur-md">
          {currentConnectionRequest.status === 'accepted'
            ? 'Connected'
            : currentConnectionRequest.status === 'pending'
            ? 'Request sent'
            : 'Request expired'}
        </div>
      )}

      {/* Position indicator */}
      <div className="pointer-events-none absolute right-3 top-1/2 z-40 flex -translate-y-1/2 flex-col items-center gap-1.5">
        {vibes.slice(Math.max(0, activeIndex - 2), activeIndex + 3).map((item) => {
          const index = vibes.findIndex((vibe) => vibe.id === item.id)

          return (
            <div
              key={item.id}
              className={`rounded-full transition-all ${index === activeIndex ? 'h-5 w-1.5 bg-white' : 'size-1.5 bg-white/40'}`}
            />
          )
        })}
      </div>

      {/* Connection composer */}
      {connectionComposerOpen && (
        <ConnectionRequestComposer vibe={vibe} onClose={() => setConnectionComposerOpen(false)} onSent={handleConnectionSent} />
      )}
    </div>
  )
}

export default VibeViewer
