const KLIPY_API_URL = 'https://api.klipy.com/v2'
const KLIPY_API_KEY = import.meta.env.VITE_KLIPY_API_KEY

const DEFAULT_LIMIT = 24

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

const assertApiKey = () => {
  if (!KLIPY_API_KEY) {
    throw new Error('KLIPY API key is missing.')
  }
}

const getGifMedia = (item) => {
  const formats = item.media_formats || {}

  const full = formats.gif || formats.mediumgif || formats.tinygif || formats.nanogif || formats.preview

  const preview = formats.tinygif || formats.nanogif || formats.preview || formats.mediumgif || formats.gif

  if (!full?.url) return null

  return {
    id: String(item.id),
    title: item.title || '',
    description: item.content_description || item.title || '',
    url: full.url,
    previewUrl: preview?.url || full.url,
    width: full.dims?.[0] || null,
    height: full.dims?.[1] || null,
    provider: 'klipy'
  }
}

const normalizeResults = (data) => {
  return (data?.results || []).map(getGifMedia).filter(Boolean)
}

const request = async (endpoint, params = {}) => {
  assertApiKey()

  const searchParams = new URLSearchParams({
    key: KLIPY_API_KEY,
    limit: String(DEFAULT_LIMIT),
    media_filter: 'gif,tinygif,mediumgif,nanogif,preview',
    contentfilter: 'medium',
    ...params
  })

  const response = await fetch(`${KLIPY_API_URL}/${endpoint}?${searchParams}`)

  if (!response.ok) {
    throw new Error(`KLIPY request failed with status ${response.status}.`)
  }

  return response.json()
}

// -----------------------------------------------------------------------------
// Trending
// -----------------------------------------------------------------------------

export const getTrendingGifs = async ({ limit = DEFAULT_LIMIT, next = null } = {}) => {
  const params = {
    limit: String(limit)
  }

  if (next) {
    params.pos = next
  }

  const data = await request('featured', params)

  return {
    gifs: normalizeResults(data),
    next: data?.next || null
  }
}

// -----------------------------------------------------------------------------
// Search
// -----------------------------------------------------------------------------

export const searchGifs = async (query, { limit = DEFAULT_LIMIT, next = null } = {}) => {
  const trimmed = query.trim()

  if (!trimmed) {
    return getTrendingGifs({
      limit,
      next
    })
  }

  const params = {
    q: trimmed,
    limit: String(limit)
  }

  if (next) {
    params.pos = next
  }

  const data = await request('search', params)

  return {
    gifs: normalizeResults(data),
    next: data?.next || null
  }
}
