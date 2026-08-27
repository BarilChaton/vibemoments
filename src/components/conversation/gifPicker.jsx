import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { FiSearch, FiX } from 'react-icons/fi'
import { getTrendingGifs, searchGifs } from '../../services/gifs.js'

const SEARCH_DELAY = 350

const GifPicker = ({ onClose, onSelect }) => {
  const { t } = useTranslation()
  const loadMoreRef = useRef(null)

  const [query, setQuery] = useState('')
  const [gifs, setGifs] = useState([])
  const [next, setNext] = useState(null)

  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState('')

  // ---------------------------------------------------------------------------
  // Initial search / query change
  // ---------------------------------------------------------------------------

  useEffect(() => {
    let cancelled = false

    const timeout = setTimeout(
      async () => {
        setLoading(true)
        setError('')
        setGifs([])
        setNext(null)

        try {
          const result = query.trim() ? await searchGifs(query) : await getTrendingGifs()

          if (cancelled) return

          setGifs(result.gifs)
          setNext(result.next)
        } catch (searchError) {
          if (cancelled) return

          console.error('Failed to load GIFs:', searchError)

          setGifs([])
          setNext(null)
          setError(t('conversation.gifPicker.loadErrorFallback'))
        } finally {
          if (!cancelled) {
            setLoading(false)
          }
        }
      },
      query.trim() ? SEARCH_DELAY : 0
    )

    return () => {
      cancelled = true
      clearTimeout(timeout)
    }
  }, [query, t])

  // ---------------------------------------------------------------------------
  // Infinite scroll
  // ---------------------------------------------------------------------------

  useEffect(() => {
    const target = loadMoreRef.current

    if (!target || !next) return

    const loadMore = async () => {
      if (!next || loading || loadingMore) return

      setLoadingMore(true)

      try {
        const result = query.trim()
          ? await searchGifs(query, {
              next
            })
          : await getTrendingGifs({
              next
            })

        setGifs((current) => {
          const existingIds = new Set(current.map((gif) => gif.id))
          const newGifs = result.gifs.filter((gif) => !existingIds.has(gif.id))

          return [...current, ...newGifs]
        })

        setNext(result.next)
      } catch (loadError) {
        console.error('Failed to load more GIFs:', loadError)
      } finally {
        setLoadingMore(false)
      }
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0]

        if (!entry?.isIntersecting) return

        loadMore()
      },
      {
        rootMargin: '200px'
      }
    )

    observer.observe(target)

    return () => {
      observer.disconnect()
    }
  }, [next, loading, loadingMore, query])

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="absolute inset-x-0 bottom-full z-40 border-t border-vibe-petrol/10 bg-vibe-bg shadow-2xl">
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-vibe-petrol/10 px-4 py-3">
        <div className="relative min-w-0 flex-1">
          <FiSearch className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-vibe-muted" />

          <input
            className="w-full rounded-2xl border border-vibe-petrol/10 bg-vibe-surface py-3 pl-11 pr-4 text-sm text-vibe-text outline-none transition placeholder:text-vibe-muted/60 focus:border-vibe-petrol/30"
            type="search"
            placeholder={t('conversation.gifPicker.searchPlaceholder')}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>

        <button
          className="flex size-10 shrink-0 items-center justify-center rounded-full bg-vibe-surface text-vibe-muted transition active:scale-95"
          type="button"
          onClick={onClose}>
          <FiX />
        </button>
      </div>

      {/* Content */}
      <div className="h-80 overflow-y-auto px-3 py-3">
        {loading && (
          <div className="flex h-full items-center justify-center">
            <div className="size-3 animate-pulse rounded-full bg-vibe-lime" />
          </div>
        )}

        {!loading && error && (
          <div className="flex h-full items-center justify-center px-6 text-center">
            <div>
              <p className="font-semibold text-vibe-text">{t('conversation.gifPicker.loadError')}</p>
              <p className="mt-2 text-sm text-vibe-muted">{error}</p>
            </div>
          </div>
        )}

        {!loading && !error && gifs.length === 0 && (
          <div className="flex h-full items-center justify-center px-6 text-center">
            <p className="text-sm text-vibe-muted">{t('conversation.gifPicker.empty')}</p>
          </div>
        )}

        {!loading && !error && gifs.length > 0 && (
          <>
            <div className="grid grid-cols-2 gap-2">
              {gifs.map((gif) => (
                <button
                  key={gif.id}
                  className="relative overflow-hidden rounded-2xl bg-vibe-surface transition active:scale-[0.98]"
                  type="button"
                  onClick={() => onSelect(gif)}>
                  <img
                    className="aspect-square w-full object-cover"
                    src={gif.previewUrl}
                    alt={gif.description || gif.title || t('conversation.gifPicker.imageAlt')}
                    loading="lazy"
                  />
                </button>
              ))}
            </div>

            {/* Infinite scroll trigger */}
            <div ref={loadMoreRef} className="h-8" />

            {loadingMore && (
              <div className="flex justify-center py-4">
                <div className="size-2.5 animate-pulse rounded-full bg-vibe-lime" />
              </div>
            )}

            {!next && gifs.length > 0 && (
              <p className="py-4 text-center text-[11px] text-vibe-muted">{t('conversation.gifPicker.noMore')}</p>
            )}
          </>
        )}
      </div>

      {/* Attribution */}
      <div className="border-t border-vibe-petrol/10 px-4 py-2 text-center">
        <span className="text-[10px] font-semibold uppercase tracking-[0.15em] text-vibe-muted">
          {t('conversation.gifPicker.poweredBy')}
        </span>
      </div>
    </div>
  )
}

export default GifPicker
