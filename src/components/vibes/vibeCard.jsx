import { FiMapPin } from 'react-icons/fi'
import { formatVibeLocation } from '../../utils/formatVibeLocation.js'

const formatAge = (createdAt) => {
  const seconds = Math.floor((Date.now() - new Date(createdAt).getTime()) / 1000)

  if (seconds < 60) return 'Now'

  const minutes = Math.floor(seconds / 60)

  if (minutes < 60) return `${minutes}m`

  const hours = Math.floor(minutes / 60)

  return `${hours}h`
}

const VibeCard = ({ vibe, onClick }) => {
  return (
    <button
      className="relative aspect-4/5 overflow-hidden rounded-3xl bg-vibe-surface text-left shadow-sm transition active:scale-[0.98]"
      type="button"
      onClick={() => onClick?.(vibe)}>
      {vibe.media_type === 'photo' && vibe.media_url && (
        <img
          className="h-full w-full object-cover"
          src={vibe.media_url}
          alt=""
          loading="lazy"
          onError={(e) => {
            console.error('Vibe image failed:', {
              id: vibe.id,
              url: vibe.media_url,
              src: e.currentTarget.src
            })
          }}
        />
      )}

      <div className="absolute inset-x-0 bottom-0 bg-linear-to-t from-black/80 via-black/35 to-transparent px-3 pb-3 pt-12 text-white">
        <div className="flex items-center justify-between gap-2">
          <p className="min-w-0 truncate text-sm font-bold">{vibe.display_name}</p>

          <div className="size-2 shrink-0 rounded-full bg-vibe-lime" />
        </div>

        <div className="mt-1 flex items-center gap-1 text-[11px] text-white/80">
          <FiMapPin />
          <span className="truncate">{formatVibeLocation(vibe)}</span>
          <span>·</span>
          <span>{formatAge(vibe.created_at)}</span>
        </div>

        {vibe.caption && <p className="mt-1 truncate text-xs text-white/90">{vibe.caption}</p>}
      </div>
    </button>
  )
}

export default VibeCard
