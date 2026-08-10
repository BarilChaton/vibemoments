import { supabase } from './supabase.js'

// -----------------------------------------------------------------------------
// Friendship state
// -----------------------------------------------------------------------------

export const getFriendshipState = async (conversationId) => {
  const { data, error } = await supabase.rpc('get_friendship_state', {
    target_conversation_id: conversationId
  })

  if (error) throw error

  return (
    data?.[0] || {
      state: 'locked',
      request_id: null
    }
  )
}

// -----------------------------------------------------------------------------
// Send friend request
// -----------------------------------------------------------------------------

export const sendFriendRequest = async (conversationId) => {
  const { data, error } = await supabase.rpc('send_friend_request', {
    target_conversation_id: conversationId
  })

  if (error) throw error
  return data
}

// -----------------------------------------------------------------------------
// Respond to friend request
// -----------------------------------------------------------------------------

export const respondToFriendRequest = async ({ requestId, accept }) => {
  const { data, error } = await supabase.rpc('respond_to_friend_request', {
    target_request_id: requestId,
    accept_request: accept
  })

  if (error) throw error
  return data
}

// -----------------------------------------------------------------------------
// Friends
// -----------------------------------------------------------------------------

export const getFriends = async () => {
  const { data, error } = await supabase.rpc('get_friends')

  if (error) throw error
  return data || []
}

// -----------------------------------------------------------------------------
// Friend profile
// -----------------------------------------------------------------------------

export const getFriendProfile = async (friendId) => {
  const { data, error } = await supabase.rpc('get_friend_profile', {
    target_friend_id: friendId
  })

  if (error) throw error
  return data
}

// -----------------------------------------------------------------------------
// Remove friend
// -----------------------------------------------------------------------------

export const removeFriend = async (friendId) => {
  const { data, error } = await supabase.rpc('remove_friendship', {
    target_friend_id: friendId
  })

  if (error) throw error
  return data
}
