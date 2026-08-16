import { useEffect, useMemo, useState } from 'react'
import { subscribeToFeedVibeReactions, unsubscribeFromFeedVibeReactions } from '../services/vibes.js'

const REACTION_WINDOW_MS = 3000
const CLEANUP_INTERVAL_MS = 250

const getIntensity = (count) => {
  if (count >= 10) return 4
  if (count >= 6) return 3
  if (count >= 3) return 2
  if (count >= 1) return 1

  return 0
}

const useFeedReactionActivity = (vibes = []) => {
  const [activity, setActivity] = useState({})

  const vibeIds = useMemo(() => vibes.map((vibe) => vibe.id).filter(Boolean), [vibes])

  const vibeIdsKey = vibeIds.join(',')

  // ---------------------------------------------------------------------------
  // Realtime reactions
  // ---------------------------------------------------------------------------

  useEffect(() => {
    if (!vibeIds.length) return

    const channel = subscribeToFeedVibeReactions(vibeIds, (reaction) => {
      if (!reaction?.vibe_id) return

      const now = Date.now()
      const cutoff = now - REACTION_WINDOW_MS

      setActivity((current) => {
        const previous = current[reaction.vibe_id]

        const timestamps = [...(previous?.timestamps || []).filter((timestamp) => timestamp > cutoff), now]
        const count = timestamps.length

        return {
          ...current,

          [reaction.vibe_id]: {
            timestamps,
            count,
            intensity: getIntensity(count),
            pulseId: (previous?.pulseId || 0) + 1
          }
        }
      })
    })

    return () => {
      unsubscribeFromFeedVibeReactions(channel)
    }
  }, [vibeIds, vibeIdsKey])

  // ---------------------------------------------------------------------------
  // Reaction energy decay
  // ---------------------------------------------------------------------------

  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now()
      const cutoff = now - REACTION_WINDOW_MS

      setActivity((current) => {
        let changed = false
        const next = {}

        Object.entries(current).forEach(([vibeId, entry]) => {
          const timestamps = entry.timestamps.filter((timestamp) => timestamp > cutoff)

          if (!timestamps.length) {
            changed = true
            return
          }

          const count = timestamps.length
          const intensity = getIntensity(count)

          if (count !== entry.count || intensity !== entry.intensity) {
            changed = true
          }

          next[vibeId] = {
            ...entry,
            timestamps,
            count,
            intensity
          }
        })

        return changed ? next : current
      })
    }, CLEANUP_INTERVAL_MS)

    return () => {
      clearInterval(interval)
    }
  }, [])

  return activity
}

export default useFeedReactionActivity
