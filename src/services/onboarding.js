import { supabase } from './supabase.js'
import { normalizeInterestName } from '../utils/normalizeInterestsName.js'

export const getRandomInterests = async (limit = 15) => {
  const { data, error } = await supabase.rpc('get_random_interests', {
    limit_count: limit
  })

  if (error) throw error

  return data
}

export const saveDisplayName = async (userId, displayName) => {
  const { data, error } = await supabase
    .from('profiles')
    .update({
      display_name: displayName,
      updated_at: new Date().toISOString()
    })
    .eq('id', userId)
    .select()
    .single()

  if (error) throw error

  return data
}

export const createInterest = async (userId, name) => {
  const trimmedName = name.trim()
  const normalizedName = normalizeInterestName(trimmedName)

  if (!normalizedName) throw new Error('Invalid interest name')

  const { data: existing, error: lookupError } = await supabase
    .from('interests')
    .select('*')
    .eq('normalized_name', normalizedName)
    .maybeSingle()

  if (lookupError) throw lookupError

  // If somebody already created "Billie Eilish",
  // reuse it instead of creating another.
  if (existing) return existing

  const { data, error } = await supabase
    .from('interests')
    .insert({
      name: trimmedName,
      normalized_name: normalizedName,
      created_by: userId
    })
    .select()
    .single()

  if (error) throw error

  return data
}

export const saveUserInterests = async (userId, interestIds) => {
  const { error: deleteError } = await supabase.from('user_interests').delete().eq('user_id', userId)

  if (deleteError) throw deleteError

  const rows = interestIds.map((interestId) => ({
    user_id: userId,
    interest_id: interestId
  }))

  const { error } = await supabase.from('user_interests').insert(rows)

  if (error) throw error
}

export const completeOnboarding = async (userId) => {
  const { data, error } = await supabase
    .from('profiles')
    .update({
      onboarding_completed: true,
      updated_at: new Date().toISOString()
    })
    .eq('id', userId)
    .select()
    .single()

  if (error) throw error

  return data
}
