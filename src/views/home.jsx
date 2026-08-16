import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Geolocation } from '@capacitor/geolocation'
import { FiMapPin, FiRefreshCw } from 'react-icons/fi'
import { getNearbyVibes, getVibeMediaUrl } from '../services/vibes.js'
import useFeedReactionActivity from '../hooks/useFeedReactionActivity.js'
import VibeCard from '../components/vibes/VibeCard.jsx'
import VibeViewer from '../components/vibes/VibeViewer.jsx'

const loadNearbyVibes = async () => {
  const position = await Geolocation.getCurrentPosition({
    enableHighAccuracy: true,
    timeout: 10000
  })

  const vibes = await getNearbyVibes({
    latitude: position.coords.latitude,
    longitude: position.coords.longitude,
    radiusMeters: 5000
  })

  return Promise.all(
    vibes.map(async (vibe) => {
      const mediaPath = vibe.thumbnail_path || vibe.media_path
      const mediaUrl = mediaPath ? await getVibeMediaUrl(mediaPath) : null

      return {
        ...vibe,
        media_url: mediaUrl
      }
    })
  )
}

const Home = ({ onOpenConversation }) => {
  const {
    data: vibes = [],
    isLoading,
    isFetching,
    error,
    refetch
  } = useQuery({
    queryKey: ['nearby-vibes'],
    queryFn: loadNearbyVibes,
    staleTime: 1000 * 30
  })

  const [selectedVibeIndex, setSelectedVibeIndex] = useState(null)

  const reactionActivity = useFeedReactionActivity(vibes)

  return (
    <div className="flex flex-1 flex-col">
      <header className="safe-top px-6 pb-4 pt-5">
        <div className="flex items-end justify-between">
          <div>
            <p className="text-sm font-semibold text-vibe-apricot-dark">RIGHT NOW</p>
            <h1 className="mt-1 text-3xl font-black text-vibe-petrol">Nearby Vibes</h1>

            <p className="mt-1 flex items-center gap-1 text-sm text-vibe-muted">
              <FiMapPin />
              Within 5 km
            </p>
          </div>

          <button
            className="flex size-10 items-center justify-center rounded-full bg-vibe-surface text-vibe-petrol shadow-sm transition active:scale-95 disabled:opacity-50"
            type="button"
            disabled={isFetching}
            onClick={() => refetch()}>
            <FiRefreshCw className={isFetching ? 'animate-spin' : ''} />
          </button>
        </div>
      </header>

      {isLoading ? (
        <div className="flex flex-1 items-center justify-center px-6">
          <div className="text-center">
            <div className="mx-auto size-3 animate-pulse rounded-full bg-vibe-lime" />
            <p className="mt-4 text-sm text-vibe-muted">Finding nearby Vibes...</p>
          </div>
        </div>
      ) : error ? (
        <div className="flex flex-1 items-center justify-center px-6 text-center">
          <div>
            <h2 className="text-lg font-bold text-vibe-text">Couldn't load nearby Vibes</h2>

            <p className="mx-auto mt-2 max-w-xs text-sm leading-6 text-vibe-muted">
              {error.message || 'Something went wrong while loading nearby Vibes.'}
            </p>

            <button
              className="mt-5 rounded-2xl bg-vibe-petrol px-5 py-3 text-sm font-bold text-vibe-surface active:scale-95"
              type="button"
              onClick={() => refetch()}>
              Try again
            </button>
          </div>
        </div>
      ) : vibes.length === 0 ? (
        <div className="flex flex-1 items-center justify-center px-6 text-center">
          <div>
            <div className="mx-auto mb-5 size-3 rounded-full bg-vibe-lime shadow-lg shadow-vibe-lime/30" />

            <h2 className="text-xl font-bold text-vibe-text">Nothing nearby yet</h2>

            <p className="mx-auto mt-2 max-w-xs text-sm leading-6 text-vibe-muted">
              There aren't any active Vibes within 5 km. Be the first to share what's happening.
            </p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 px-3 pb-8 pt-2">
          {vibes.map((vibe, index) => (
            <VibeCard key={vibe.id} vibe={vibe} reactionActivity={reactionActivity[vibe.id]} onClick={() => setSelectedVibeIndex(index)} />
          ))}
        </div>
      )}

      {selectedVibeIndex !== null && (
        <VibeViewer
          vibes={vibes}
          initialIndex={selectedVibeIndex}
          onClose={() => setSelectedVibeIndex(null)}
          onOpenConversation={onOpenConversation}
        />
      )}
    </div>
  )
}

export default Home
