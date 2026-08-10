import { supabase } from './supabase.js'

export const updateProfile = async ({ userId, displayName, username, bio }) => {
  const cleanDisplayName = displayName.trim()
  const cleanUsername = username.trim().toLowerCase()
  const cleanBio = bio.trim()

  if (!userId) throw new Error('Not authenticated')

  if (cleanDisplayName.length < 2) {
    throw new Error('Display name must be at least 2 characters.')
  }

  if (cleanDisplayName.length > 40) {
    throw new Error('Display name must be 40 characters or fewer.')
  }

  if (cleanUsername.length < 3) {
    throw new Error('Username must be at least 3 characters.')
  }

  if (cleanUsername.length > 30) {
    throw new Error('Username must be 30 characters or fewer.')
  }

  if (!/^[a-z0-9_]+$/.test(cleanUsername)) {
    throw new Error('Username can only contain letters, numbers and underscores.')
  }

  if (cleanBio.length > 160) {
    throw new Error('Bio must be 160 characters or fewer.')
  }

  const { data, error } = await supabase
    .from('profiles')
    .update({
      display_name: cleanDisplayName,
      username: cleanUsername,
      bio: cleanBio || null,
      updated_at: new Date().toISOString()
    })
    .eq('id', userId)
    .select()
    .single()

  if (error) {
    if (error.code === '23505') {
      throw new Error('That username is already taken.')
    }

    throw error
  }

  return data
}

export const getProfileStats = async (userId) => {
  if (!userId) {
    return {
      vibes: 0,
      chats: 0
    }
  }

  const [vibesResult, conversationsResult] = await Promise.all([
    supabase
      .from('vibes')
      .select('id', {
        count: 'exact',
        head: true
      })
      .eq('user_id', userId),

    supabase.rpc('get_conversation_summaries')
  ])

  if (vibesResult.error) throw vibesResult.error
  if (conversationsResult.error) throw conversationsResult.error

  return {
    vibes: vibesResult.count || 0,
    chats: conversationsResult.data?.length || 0
  }
}
