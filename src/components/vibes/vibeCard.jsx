import { useEffect, useRef, useState } from 'react'
import { FiMapPin } from 'react-icons/fi'
import { getVibeMediaUrl } from '../../services/vibes.js'
import { formatVibeLocation } from '../../utils/formatVibeLocation.js'

const formatAge = (createdAt) => {
  const seconds = Math.floor((Date.now() - new Date(createdAt).getTime()) / 1000)

  if (seconds < 60) return 'Now'

  const minutes = Math.floor(seconds / 60)

  if (minutes < 60) return `${minutes}m`

  const hours = Math.floor(minutes / 60)

  if (hours < 24) return `${hours}h`

  return `${Math.floor(hours / 24)}d`
}

const VibeCard = ({ vibe, onClick }) => {
  const videoRef = useRef(null)

  const [videoUrl, setVideoUrl] = useState(null)
  const [videoReady, setVideoReady] = useState(false)

  const thumbnailUrl = vibe.thumbnail_url || vibe.media_url || null

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
  // Render
  // ---------------------------------------------------------------------------

  return (
    <button
      className="relative aspect-4/5 overflow-hidden rounded-3xl bg-vibe-surface text-left shadow-sm transition active:scale-[0.98]"
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
  )
}

export default VibeCard
