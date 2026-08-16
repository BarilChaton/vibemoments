import { useEffect, useMemo, useRef, useState } from 'react'
import { FiMapPin } from 'react-icons/fi'
import { getVibeMediaUrl } from '../../services/vibes.js'
import { formatVibeLocation } from '../../utils/formatVibeLocation.js'

const PARTICLE_SYMBOLS = ['✦', '✧', '⋆', '✦', '·']
const PARTICLE_COLORS = ['#ffffff', '#fff4c2', '#d9fff7', '#ffe3a3', '#ffffff']

const pseudoRandom = (seed) => {
  const value = Math.sin(seed * 999.91) * 43758.5453

  return value - Math.floor(value)
}

const createMagicParticles = (count = 48) => {
  return Array.from({ length: count }, (_, index) => {
    const side = index % 4
    const offset = 6 + pseudoRandom(index + 1) * 88
    const outside = 1 + pseudoRandom(index + 20) * 8

    let left
    let top

    if (side === 0) {
      left = `${offset}%`
      top = `${-outside}px`
    }

    if (side === 1) {
      left = `calc(100% + ${outside}px)`
      top = `${offset}%`
    }

    if (side === 2) {
      left = `${offset}%`
      top = `calc(100% + ${outside}px)`
    }

    if (side === 3) {
      left = `${-outside}px`
      top = `${offset}%`
    }

    const angle = pseudoRandom(index + 40) * Math.PI * 2
    const distance = 5 + pseudoRandom(index + 60) * 16

    return {
      id: index,
      left,
      top,
      symbol: PARTICLE_SYMBOLS[index % PARTICLE_SYMBOLS.length],
      color: PARTICLE_COLORS[index % PARTICLE_COLORS.length],
      size: 5 + pseudoRandom(index + 80) * 10,
      duration: 700 + pseudoRandom(index + 100) * 1400,
      delay: pseudoRandom(index + 120) * 1200,
      moveX: Math.cos(angle) * distance,
      moveY: Math.sin(angle) * distance,
      rotation: -40 + pseudoRandom(index + 140) * 80
    }
  })
}

const MAGIC_PARTICLES = createMagicParticles()

const formatAge = (createdAt) => {
  const seconds = Math.floor((Date.now() - new Date(createdAt).getTime()) / 1000)

  if (seconds < 60) return 'Now'

  const minutes = Math.floor(seconds / 60)

  if (minutes < 60) return `${minutes}m`

  const hours = Math.floor(minutes / 60)

  if (hours < 24) return `${hours}h`

  return `${Math.floor(hours / 24)}d`
}

// -----------------------------------------------------------------------------
// Individual magical particle
// -----------------------------------------------------------------------------

const MagicParticle = ({ particle, intensity }) => {
  const particleRef = useRef(null)

  useEffect(() => {
    const element = particleRef.current

    if (!element) return

    const intensityMultiplier = intensity === 4 ? 1.35 : intensity === 3 ? 1.15 : 1

    const animation = element.animate(
      [
        {
          opacity: 0,
          transform: 'translate(-50%, -50%) scale(0.15) rotate(0deg)'
        },
        {
          opacity: 0.3,
          transform: 'translate(-50%, -50%) scale(0.55) rotate(12deg)',
          offset: 0.15
        },
        {
          opacity: 1,
          transform: 'translate(-50%, -50%) scale(1.25) rotate(-10deg)',
          offset: 0.42
        },
        {
          opacity: 0.65,
          transform: `translate(calc(-50% + ${particle.moveX * 0.45 * intensityMultiplier}px), calc(-50% + ${
            particle.moveY * 0.45 * intensityMultiplier
          }px)) scale(0.8) rotate(${particle.rotation * 0.5}deg)`,
          offset: 0.68
        },
        {
          opacity: 0,
          transform: `translate(calc(-50% + ${particle.moveX * intensityMultiplier}px), calc(-50% + ${
            particle.moveY * intensityMultiplier
          }px)) scale(0.15) rotate(${particle.rotation}deg)`
        }
      ],
      {
        duration: particle.duration,
        delay: particle.delay,
        iterations: Infinity,
        easing: 'ease-in-out'
      }
    )

    return () => {
      animation.cancel()
    }
  }, [particle, intensity])

  return (
    <span
      ref={particleRef}
      className="absolute font-black"
      style={{
        left: particle.left,
        top: particle.top,
        color: particle.color,
        fontSize: `${particle.size}px`,
        lineHeight: 1,
        opacity: 0,
        textShadow: `0 0 ${intensity >= 4 ? 9 : 6}px currentColor`,
        willChange: 'transform, opacity'
      }}>
      {particle.symbol}
    </span>
  )
}

// -----------------------------------------------------------------------------
// Reaction magic
// -----------------------------------------------------------------------------

const ReactionMagic = ({ intensity }) => {
  const particleCount = intensity === 2 ? 12 : intensity === 3 ? 26 : intensity >= 4 ? 44 : 0

  const particles = useMemo(() => MAGIC_PARTICLES.slice(0, particleCount), [particleCount])

  if (intensity < 2) return null

  return (
    <div className="pointer-events-none absolute -inset-4 z-20 overflow-visible">
      {/* Soft magical aura */}
      <div
        className={`absolute inset-3 rounded-4xl blur-xl transition-all duration-500 ${
          intensity === 2 ? 'bg-vibe-apricot/10 opacity-60' : intensity === 3 ? 'bg-vibe-lime/15 opacity-80' : 'bg-white/15 opacity-100'
        }`}
      />

      {/* Warm glow */}
      <div
        className={`absolute -left-2 top-[18%] rounded-full bg-vibe-apricot blur-2xl transition-all duration-500 ${
          intensity === 2 ? 'size-10 opacity-10' : intensity === 3 ? 'size-14 opacity-20' : 'size-20 opacity-30'
        }`}
      />

      {/* Cool glow */}
      <div
        className={`absolute -right-3 bottom-[18%] rounded-full bg-vibe-lime blur-2xl transition-all duration-500 ${
          intensity === 2 ? 'size-10 opacity-10' : intensity === 3 ? 'size-16 opacity-20' : 'size-20 opacity-30'
        }`}
      />

      {/* Extra magical clouds during intense activity */}
      {intensity >= 3 && (
        <>
          <div className="absolute -right-4 top-[8%] size-14 animate-pulse rounded-full bg-white/10 blur-2xl" />

          <div
            className="absolute -left-4 bottom-[8%] size-16 animate-pulse rounded-full bg-vibe-apricot/15 blur-2xl"
            style={{
              animationDelay: '400ms',
              animationDuration: '1400ms'
            }}
          />
        </>
      )}

      {intensity >= 4 && (
        <>
          <div
            className="absolute left-[25%] -top-4 size-16 animate-pulse rounded-full bg-white/10 blur-2xl"
            style={{
              animationDuration: '900ms'
            }}
          />

          <div
            className="absolute bottom-0 right-[20%] size-20 animate-pulse rounded-full bg-vibe-lime/10 blur-2xl"
            style={{
              animationDelay: '250ms',
              animationDuration: '1100ms'
            }}
          />
        </>
      )}

      {/* Magical particles */}
      {particles.map((particle) => (
        <MagicParticle key={particle.id} particle={particle} intensity={intensity} />
      ))}

      {/* Larger hero sparkles */}
      {intensity >= 3 && (
        <>
          <span
            className="absolute -right-2 top-[16%] animate-pulse text-lg text-white"
            style={{
              textShadow: '0 0 12px white',
              animationDuration: '1100ms'
            }}>
            ✦
          </span>

          <span
            className="absolute -left-2 bottom-[24%] animate-pulse text-sm text-[#fff4c2]"
            style={{
              textShadow: '0 0 10px currentColor',
              animationDelay: '350ms',
              animationDuration: '850ms'
            }}>
            ✧
          </span>
        </>
      )}

      {intensity >= 4 && (
        <>
          <span
            className="absolute left-[17%] -top-3 animate-pulse text-xl text-white"
            style={{
              textShadow: '0 0 14px white',
              animationDelay: '150ms',
              animationDuration: '700ms'
            }}>
            ✦
          </span>

          <span
            className="absolute -bottom-3 right-[18%] animate-pulse text-lg text-[#d9fff7]"
            style={{
              textShadow: '0 0 14px currentColor',
              animationDelay: '500ms',
              animationDuration: '900ms'
            }}>
            ✧
          </span>

          <span
            className="absolute -right-3 bottom-[43%] animate-pulse text-sm text-[#ffe3a3]"
            style={{
              textShadow: '0 0 12px currentColor',
              animationDelay: '750ms',
              animationDuration: '650ms'
            }}>
            ✦
          </span>
        </>
      )}
    </div>
  )
}

// -----------------------------------------------------------------------------
// Vibe card
// -----------------------------------------------------------------------------

const VibeCard = ({ vibe, reactionActivity, onClick }) => {
  const videoRef = useRef(null)
  const cardRef = useRef(null)

  const [videoUrl, setVideoUrl] = useState(null)
  const [videoReady, setVideoReady] = useState(false)

  const thumbnailUrl = vibe.thumbnail_url || vibe.media_url || null

  const reactionIntensity = reactionActivity?.intensity || 0
  const reactionPulseId = reactionActivity?.pulseId || 0

  // ---------------------------------------------------------------------------
  // Load video
  // ---------------------------------------------------------------------------

  useEffect(() => {
    if (vibe.media_type !== 'video' || !vibe.media_path) return

    let cancelled = false

    const loadVideo = async () => {
      try {
        const url = await getVibeMediaUrl(vibe.media_path)

        if (!cancelled) setVideoUrl(url)
      } catch (error) {
        console.error('Failed to load Vibe video:', error)
      }
    }

    loadVideo()

    return () => {
      cancelled = true
    }
  }, [vibe.media_type, vibe.media_path])

  // ---------------------------------------------------------------------------
  // Autoplay
  // ---------------------------------------------------------------------------

  const handleVideoReady = () => {
    setVideoReady(true)

    const video = videoRef.current

    if (!video) return

    video.play().catch((error) => {
      console.log('Feed video autoplay was prevented:', error)
    })
  }

  // ---------------------------------------------------------------------------
  // Reaction pulse
  // ---------------------------------------------------------------------------

  useEffect(() => {
    if (!reactionPulseId || !cardRef.current) return

    const card = cardRef.current

    const scaleDown = reactionIntensity >= 4 ? 0.955 : reactionIntensity === 3 ? 0.962 : reactionIntensity === 2 ? 0.97 : 0.978

    const scaleUp = reactionIntensity >= 4 ? 1.018 : reactionIntensity === 3 ? 1.014 : reactionIntensity === 2 ? 1.01 : 1.006

    const duration = reactionIntensity >= 3 ? 300 : 250

    const animation = card.animate(
      [
        {
          transform: 'scale(1)',
          offset: 0
        },
        {
          transform: `scale(${scaleDown})`,
          offset: 0.35
        },
        {
          transform: `scale(${scaleUp})`,
          offset: 0.72
        },
        {
          transform: 'scale(1)',
          offset: 1
        }
      ],
      {
        duration,
        easing: 'cubic-bezier(0.22, 1, 0.36, 1)'
      }
    )

    return () => {
      animation.cancel()
    }
  }, [reactionPulseId, reactionIntensity])

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="relative aspect-4/5">
      <ReactionMagic intensity={reactionIntensity} />

      <button
        ref={cardRef}
        className="absolute inset-0 z-10 h-full w-full overflow-hidden rounded-3xl bg-vibe-surface text-left shadow-sm transition active:scale-[0.98]"
        type="button"
        onClick={() => onClick?.(vibe)}>
        {/* Photo */}
        {vibe.media_type === 'photo' && thumbnailUrl && (
          <img className="absolute inset-0 h-full w-full object-cover" src={thumbnailUrl} alt="" loading="lazy" />
        )}

        {/* Video thumbnail */}
        {vibe.media_type === 'video' && thumbnailUrl && (
          <img
            className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-300 ${
              videoReady ? 'opacity-0' : 'opacity-100'
            }`}
            src={thumbnailUrl}
            alt=""
            loading="lazy"
          />
        )}

        {/* Video */}
        {vibe.media_type === 'video' && videoUrl && (
          <video
            ref={videoRef}
            className={`pointer-events-none absolute inset-0 h-full w-full object-cover transition-opacity duration-300 ${
              videoReady ? 'opacity-100' : 'opacity-0'
            }`}
            src={videoUrl}
            muted
            loop
            playsInline
            preload="metadata"
            poster={thumbnailUrl || undefined}
            onCanPlay={handleVideoReady}
          />
        )}

        {/* Bottom gradient */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-linear-to-t from-black/80 via-black/35 to-transparent px-3 pb-3 pt-12 text-white">
          <div className="flex items-center justify-between gap-2">
            <p className="min-w-0 truncate text-sm font-bold">{vibe.display_name}</p>

            <div className="size-2 shrink-0 rounded-full bg-vibe-lime" />
          </div>

          <div className="mt-1 flex items-center gap-1 text-[11px] text-white/80">
            <FiMapPin />
            <span className="truncate">{formatVibeLocation(vibe)}</span>
            <span>·</span>
            <span className="shrink-0">{formatAge(vibe.created_at)}</span>
          </div>

          {vibe.caption && <p className="mt-1 truncate text-xs text-white/90">{vibe.caption}</p>}
        </div>
      </button>
    </div>
  )
}

export default VibeCard
