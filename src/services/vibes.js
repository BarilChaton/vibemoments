import { supabase } from './supabase.js'

// -----------------------------------------------------------------------------
// Constants
// -----------------------------------------------------------------------------

const VIBE_TABLE = 'vibes'
const VIBE_BUCKET = 'vibes'
const DEFAULT_RADIUS_METERS = 5000
const DEFAULT_FEED_LIMIT = 50
const SIGNED_URL_EXPIRY = 60 * 60
const MAX_UPLOAD_SIZE = 50 * 1024 * 1024

// -----------------------------------------------------------------------------
// Media
// -----------------------------------------------------------------------------

const getFileExtension = (file, fallback) => {
  return file?.name?.split('.').pop()?.toLowerCase() || fallback
}

export const uploadVibeMedia = async ({ userId, vibeId, file, mediaType, filename = null }) => {
  if (!file) throw new Error('No media file provided.')

  if (file.size > MAX_UPLOAD_SIZE) {
    throw new Error('Vibe media can be a maximum of 50 MB.')
  }

  const extension = getFileExtension(file, mediaType === 'video' ? 'mp4' : 'jpg')
  const finalFilename = filename || `${mediaType}.${extension}`
  const path = `${userId}/${vibeId}/${finalFilename}`

  const { error } = await supabase.storage.from(VIBE_BUCKET).upload(path, file, {
    contentType: file.type,
    upsert: false
  })

  if (error) throw error

  return path
}

export const getVibeMediaUrl = async (mediaPath) => {
  if (!mediaPath) return null

  const { data, error } = await supabase.storage.from(VIBE_BUCKET).createSignedUrl(mediaPath, SIGNED_URL_EXPIRY)

  if (error) throw error

  return data.signedUrl
}

export const deleteVibeMedia = async (mediaPaths = []) => {
  const paths = Array.isArray(mediaPaths) ? mediaPaths.filter(Boolean) : [mediaPaths].filter(Boolean)

  if (!paths.length) return

  const { error } = await supabase.storage.from(VIBE_BUCKET).remove(paths)

  if (error) throw error
}

// -----------------------------------------------------------------------------
// Vibes
// -----------------------------------------------------------------------------

export const createVibe = async ({
  userId,
  vibeId,
  mediaType,
  mediaPath,
  thumbnailPath = null,
  caption,
  latitude,
  longitude,
  locationArea = null,
  locationCity = null
}) => {
  const { data, error } = await supabase
    .from(VIBE_TABLE)
    .insert({
      id: vibeId,
      user_id: userId,
      media_type: mediaType,
      media_path: mediaPath,
      thumbnail_path: thumbnailPath,
      caption: caption?.trim() || null,

      // Private exact coordinate
      location: `POINT(${longitude} ${latitude})`,

      // Public coarse location
      location_area: locationArea,
      location_city: locationCity
    })
    .select()
    .single()

  if (error) throw error

  return data
}

export const addVibeInterests = async (vibeId, interestIds = []) => {
  const uniqueInterestIds = [...new Set(interestIds)]

  if (!uniqueInterestIds.length) return []

  const rows = uniqueInterestIds.map((interestId) => ({
    vibe_id: vibeId,
    interest_id: interestId
  }))

  const { data, error } = await supabase.from('vibe_interests').insert(rows).select()

  if (error) throw error

  return data
}

export const deleteVibe = async (vibeId) => {
  const { error } = await supabase.from(VIBE_TABLE).delete().eq('id', vibeId)

  if (error) throw error
}

export const getVibeInterests = async (vibeId) => {
  const { data, error } = await supabase
    .from('vibe_interests')
    .select(
      `
      interest_id,
      interests (
        id,
        name
      )
    `
    )
    .eq('vibe_id', vibeId)

  if (error) throw error

  return data.map((item) => item.interests).filter(Boolean)
}

// -----------------------------------------------------------------------------
// Vibe reactions
// -----------------------------------------------------------------------------

export const sendVibeReaction = async ({ vibeId, userId, emoji }) => {
  const { data, error } = await supabase
    .from('vibe_reactions')
    .insert({
      vibe_id: vibeId,
      user_id: userId,
      emoji
    })
    .select()
    .single()

  if (error) throw error

  return data
}

// -----------------------------------------------------------------------------
// Single Vibe reaction realtime
// -----------------------------------------------------------------------------

export const subscribeToVibeReactions = (vibeId, onReaction) => {
  const channel = supabase
    .channel(`vibe-reactions-${vibeId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'vibe_reactions',
        filter: `vibe_id=eq.${vibeId}`
      },
      (payload) => {
        onReaction(payload.new)
      }
    )
    .subscribe()

  return channel
}

export const unsubscribeFromVibeReactions = async (channel) => {
  if (!channel) return

  await supabase.removeChannel(channel)
}

// -----------------------------------------------------------------------------
// Feed reaction realtime
// -----------------------------------------------------------------------------

export const subscribeToFeedVibeReactions = (vibeIds, onReaction) => {
  const ids = [...new Set((vibeIds || []).filter(Boolean))].slice(0, 100)

  if (!ids.length) return null

  const channel = supabase
    .channel(`feed-vibe-reactions:${crypto.randomUUID()}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'vibe_reactions',
        filter: `vibe_id=in.(${ids.join(',')})`
      },
      (payload) => {
        onReaction(payload.new)
      }
    )
    .subscribe((status) => {
      console.log('Feed reaction realtime status:', status)
    })

  return channel
}

export const unsubscribeFromFeedVibeReactions = async (channel) => {
  if (!channel) return

  await supabase.removeChannel(channel)
}

// -----------------------------------------------------------------------------
// Nearby feed
// -----------------------------------------------------------------------------

export const getNearbyVibes = async ({ latitude, longitude, radiusMeters = DEFAULT_RADIUS_METERS, limit = DEFAULT_FEED_LIMIT }) => {
  const { data, error } = await supabase.rpc('get_nearby_vibes', {
    user_lat: latitude,
    user_lng: longitude,
    radius_meters: radiusMeters,
    result_limit: limit
  })

  if (error) throw error

  return data
}

// -----------------------------------------------------------------------------
// Complete creation flow
// -----------------------------------------------------------------------------

export const publishVibe = async ({
  userId,
  file,
  mediaType = 'photo',
  thumbnailFile = null,
  caption = '',
  latitude,
  longitude,
  locationArea = null,
  locationCity = null,
  interestIds = []
}) => {
  if (!file) throw new Error('No media file provided.')

  if (file.size > MAX_UPLOAD_SIZE) {
    throw new Error('Vibe media can be a maximum of 50 MB.')
  }

  const vibeId = crypto.randomUUID()

  let mediaPath = null
  let thumbnailPath = null
  let vibeCreated = false

  try {
    mediaPath = await uploadVibeMedia({
      userId,
      vibeId,
      file,
      mediaType,
      filename: `original.${getFileExtension(file, 'jpg')}`
    })

    if (thumbnailFile) {
      thumbnailPath = await uploadVibeMedia({
        userId,
        vibeId,
        file: thumbnailFile,
        mediaType: 'photo',
        filename: 'thumbnail.webp'
      })
    }

    const vibe = await createVibe({
      userId,
      vibeId,
      mediaType,
      mediaPath,
      thumbnailPath,
      caption,
      latitude,
      longitude,
      locationArea,
      locationCity
    })

    vibeCreated = true

    await addVibeInterests(vibeId, interestIds)

    return vibe
  } catch (error) {
    if (vibeCreated) {
      try {
        await deleteVibe(vibeId)
      } catch (cleanupError) {
        console.error('Failed to clean up Vibe row:', cleanupError)
      }
    }

    try {
      await deleteVibeMedia([mediaPath, thumbnailPath])
    } catch (cleanupError) {
      console.error('Failed to clean up Vibe media:', cleanupError)
    }

    throw error
  }
}
