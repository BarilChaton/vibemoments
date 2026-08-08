import { supabase } from './supabase.js'
import { normalizeInterestName } from '../utils/normalizeInterestsName.js'

export const getUserInterests = async (userId) => {
  const { data, error } = await supabase
    .from('user_interests')
    .select(
      `
      interest_id,
      interests (
        id,
        name
      )
    `
    )
    .eq('user_id', userId)

  if (error) throw error
  return data.map((item) => item.interests)
}

export const getRandomInterests = async (limit = 15) => {
  const { data, error } = await supabase.rpc('get_random_interests', {
    limit_count: limit
  })

  if (error) throw error
  return data
}

export const createInterest = async (userId, name) => {
  const trimmedName = name.trim()
  const normalizedName = normalizeInterestName(trimmedName)

  if (!normalizedName) throw new Error('Invalid interest name')

  const slug = normalizedName.replace(/\s+/g, '-')

  const { data: existing, error: lookupError } = await supabase
    .from('interests')
    .select('*')
    .eq('normalized_name', normalizedName)
    .maybeSingle()

  if (lookupError) throw lookupError

  if (existing) return existing

  const { data, error } = await supabase
    .from('interests')
    .insert({
      name: trimmedName,
      slug,
      normalized_name: normalizedName,
      created_by: userId
    })
    .select()
    .single()

  if (error) throw error

  return data
}
