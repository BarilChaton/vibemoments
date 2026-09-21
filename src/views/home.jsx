import { Fragment, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Geolocation } from '@capacitor/geolocation'
import { FiArrowDown, FiCheck, FiMapPin, FiRefreshCw } from 'react-icons/fi'
import { getNearbyVibes, getVibeMediaUrl } from '../services/vibes.js'
import { useTranslation } from 'react-i18next'
import useAuthStore from '../stores/useAuthStore.js'
import useFeedReactionActivity from '../hooks/useFeedReactionActivity.js'
import VibeCard from '../components/vibes/vibeCard.jsx'
import VibeViewer from '../components/vibes/vibeViewer.jsx'
import WebAdCard from '../components/ads/webAdCard.jsx'

const PULL_THRESHOLD = 72
const MAX_PULL_DISTANCE = 110
const PULL_RESISTANCE = 0.5

const loadNearbyVibes = async (radiusMeters) => {
  const position = await Geolocation.getCurrentPosition({
    enableHighAccuracy: true,
    timeout: 10000
  })

  const vibes = await getNearbyVibes({
    latitude: position.coords.latitude,
    longitude: position.coords.longitude,
    radiusMeters
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
  const { profile } = useAuthStore()
  const { t } = useTranslation()

  const touchStartYRef = useRef(null)
  const pullingRef = useRef(false)

  const [pullDistance, setPullDistance] = useState(0)
  const [isPullRefreshing, setIsPullRefreshing] = useState(false)
  const [selectedVibeIndex, setSelectedVibeIndex] = useState(null)
  const [isPulling, setIsPulling] = useState(false)

  const vibeRadiusMeters = profile?.vibe_radius_meters || 5000
  const vibeRadiusKm = Math.round(vibeRadiusMeters / 1000)
  const adsEnabled = import.meta.env.VITE_ADS_ENABLED === 'true'

  const {
    data: vibes = [],
    isLoading,
    isFetching,
    error,
    refetch
  } = useQuery({
    queryKey: ['nearby-vibes', vibeRadiusMeters],
    queryFn: () => loadNearbyVibes(vibeRadiusMeters),
    staleTime: 1000 * 30
  })

  const reactionActivity = useFeedReactionActivity(vibes)

  const pullReady = pullDistance >= PULL_THRESHOLD

  const handleTouchStart = (event) => {
    if (isFetching || isPullRefreshing) return

    const scrollContainer = document.getElementById('app-scroll-container')

    if (!scrollContainer || scrollContainer.scrollTop > 0) return

    touchStartYRef.current = event.touches[0].clientY
    pullingRef.current = true
    setIsPulling(true)
  }

  const handleTouchMove = (event) => {
    if (!pullingRef.current || touchStartYRef.current === null) return

    const scrollContainer = document.getElementById('app-scroll-container')

    if (!scrollContainer || scrollContainer.scrollTop > 0) {
      pullingRef.current = false
      touchStartYRef.current = null
      setIsPulling(false)
      setPullDistance(0)

      return
    }

    const currentY = event.touches[0].clientY
    const deltaY = currentY - touchStartYRef.current

    if (deltaY <= 0) {
      setPullDistance(0)
      return
    }

    event.preventDefault()

    const resistedDistance = Math.min(deltaY * PULL_RESISTANCE, MAX_PULL_DISTANCE)

    setPullDistance(resistedDistance)
  }

  const finishPull = async () => {
    if (!pullingRef.current) return

    const shouldRefresh = pullDistance >= PULL_THRESHOLD

    pullingRef.current = false
    touchStartYRef.current = null
    setIsPulling(false)

    if (!shouldRefresh) {
      setPullDistance(0)
      return
    }

    setIsPullRefreshing(true)
    setPullDistance(0)

    try {
      await refetch()
    } finally {
      setIsPullRefreshing(false)
    }
  }

  const handleTouchCancel = () => {
    pullingRef.current = false
    touchStartYRef.current = null
    setIsPulling(false)
    setPullDistance(0)
  }

  return (
    <div
      className="relative flex flex-1 flex-col overscroll-y-contain"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={finishPull}
      onTouchCancel={handleTouchCancel}>
      {/* Pull-to-refresh indicator */}
      <div
        className="pointer-events-none absolute inset-x-0 top-0 z-10 flex items-center justify-center overflow-hidden"
        style={{
          height: `${pullDistance}px`,
          opacity: Math.min(pullDistance / 35, 1)
        }}>
        <div className="flex size-9 items-center justify-center rounded-full bg-vibe-surface text-vibe-petrol shadow-sm">
          {pullReady ? (
            <FiCheck />
          ) : (
            <FiArrowDown
              style={{
                transform: `rotate(${Math.min(pullDistance * 2.5, 180)}deg)`
              }}
            />
          )}
        </div>
      </div>

      {/* Feed content */}
      <div
        className="flex flex-1 flex-col"
        style={{
          transform: `translateY(${pullDistance}px)`,
          transition: isPulling ? 'none' : 'transform 200ms ease-out'
        }}>
        <header className="px-6 pb-4 pt-5">
          <div className="flex items-end justify-between">
            <div>
              <p className="text-sm font-semibold text-vibe-apricot-dark">{t('home.eyebrow')}</p>

              <h1 className="mt-1 text-3xl font-black text-vibe-petrol">{t('home.title')}</h1>

              <p className="mt-1 flex items-center gap-1 text-sm text-vibe-muted">
                <FiMapPin />
                {t('home.withinDistance', { distance: vibeRadiusKm })}
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

              <p className="mt-4 text-sm text-vibe-muted">{t('home.finding')}</p>
            </div>
          </div>
        ) : error ? (
          <div className="flex flex-1 items-center justify-center px-6 text-center">
            <div>
              <h2 className="text-lg font-bold text-vibe-text">{t('home.error.title')}</h2>

              <p className="mx-auto mt-2 max-w-xs text-sm leading-6 text-vibe-muted">{t('home.error.fallback')}</p>

              <button
                className="mt-5 rounded-2xl bg-vibe-petrol px-5 py-3 text-sm font-bold text-vibe-surface active:scale-95"
                type="button"
                onClick={() => refetch()}>
                {t('common.tryAgain')}
              </button>
            </div>
          </div>
        ) : vibes.length === 0 ? (
          <div className="flex flex-1 items-center justify-center px-6 text-center">
            <div>
              <div className="mx-auto mb-5 size-3 rounded-full bg-vibe-lime shadow-lg shadow-vibe-lime/30" />

              <h2 className="text-xl font-bold text-vibe-text">{t('home.empty.title')}</h2>

              <p className="mx-auto mt-2 max-w-xs text-sm leading-6 text-vibe-muted">
                {t('home.empty.description', { distance: vibeRadiusKm })}
              </p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 px-3 pb-8 pt-2">
            {vibes.map((vibe, index) => (
              <Fragment key={vibe.id}>
                <VibeCard vibe={vibe} reactionActivity={reactionActivity[vibe.id]} onClick={() => setSelectedVibeIndex(index)} />

                {adsEnabled && (index + 1) % 16 === 0 && <WebAdCard slotId={`feed-ad-${Math.floor((index + 1) / 16)}`} />}
              </Fragment>
            ))}
          </div>
        )}
      </div>

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
