import { supabase } from './supabase.js'

export const createConnectionRequest = async ({ vibeId, message }) => {
  const { data, error } = await supabase.rpc('create_vibe_connection_request', {
    target_vibe_id: vibeId,
    message_text: message
  })

  if (error) throw error

  return data
}

export const getConnectionRequestForVibe = async ({ vibeId, userId }) => {
  const { data, error } = await supabase
    .from('vibe_connection_requests')
    .select('id, vibe_id, status, created_at, expires_at, responded_at')
    .eq('vibe_id', vibeId)
    .eq('sender_id', userId)
    .maybeSingle()

  if (error) throw error

  return data
}

export const getIncomingConnectionRequests = async () => {
  const { data: authData, error: authError } = await supabase.auth.getUser()

  if (authError) throw authError
  if (!authData.user) return []

  const { data, error } = await supabase
    .from('vibe_connection_requests')
    .select(
      `
      id,
      vibe_id,
      sender_id,
      creator_id,
      initial_message,
      status,
      created_at,
      expires_at,
      responded_at,
      sender:profiles!vibe_connection_requests_sender_id_fkey (
        id,
        display_name
      )
    `
    )
    .eq('creator_id', authData.user.id)
    .eq('status', 'pending')
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false })

  if (error) throw error

  return data
}

export const acceptConnectionRequest = async ({ requestId, reply }) => {
  const { data, error } = await supabase.rpc('accept_vibe_connection_request', {
    request_id: requestId,
    reply_text: reply
  })

  if (error) throw error

  return data
}

export const getConversations = async () => {
  const { data: authData, error: authError } = await supabase.auth.getUser()

  if (authError) throw authError
  if (!authData.user) return []

  const userId = authData.user.id

  const { data, error } = await supabase
    .from('conversations')
    .select(
      `
      id,
      connection_request_id,
      user_a_id,
      user_b_id,
      created_at,
      user_a:profiles!conversations_user_a_id_fkey (
        id,
        display_name
      ),
      user_b:profiles!conversations_user_b_id_fkey (
        id,
        display_name
      )
    `
    )
    .or(`user_a_id.eq.${userId},user_b_id.eq.${userId}`)
    .order('created_at', { ascending: false })

  if (error) throw error

  return data.map((conversation) => ({
    ...conversation,
    otherUser: conversation.user_a_id === userId ? conversation.user_b : conversation.user_a
  }))
}

export const getConversationMessages = async (conversationId) => {
  const { data, error } = await supabase
    .from('messages')
    .select('id, conversation_id, sender_id, body, created_at')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true })

  if (error) throw error

  return data
}

export const sendMessage = async ({ conversationId, message }) => {
  const { data: authData, error: authError } = await supabase.auth.getUser()

  if (authError) throw authError
  if (!authData.user) throw new Error('Not authenticated')

  const { data, error } = await supabase
    .from('messages')
    .insert({
      conversation_id: conversationId,
      sender_id: authData.user.id,
      body: message.trim()
    })
    .select()
    .single()

  if (error) throw error

  return data
}

export const getConversation = async (conversationId) => {
  const { data: authData, error: authError } = await supabase.auth.getUser()

  if (authError) throw authError
  if (!authData.user) throw new Error('Not authenticated')

  const userId = authData.user.id

  const { data, error } = await supabase
    .from('conversations')
    .select(
      `
      id,
      connection_request_id,
      user_a_id,
      user_b_id,
      created_at,
      user_a:profiles!conversations_user_a_id_fkey (
        id,
        display_name
      ),
      user_b:profiles!conversations_user_b_id_fkey (
        id,
        display_name
      )
    `
    )
    .eq('id', conversationId)
    .single()

  if (error) throw error

  return {
    ...data,
    otherUser: data.user_a_id === userId ? data.user_b : data.user_a
  }
}

export const subscribeToConversationMessages = (conversationId, onMessage) => {
  const channel = supabase
    .channel(`conversation:${conversationId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `conversation_id=eq.${conversationId}`
      },
      (payload) => {
        console.log('Realtime message received:', payload.new)
        onMessage(payload.new)
      }
    )
    .subscribe((status) => {
      console.log('Conversation realtime status:', status)
    })

  return channel
}

export const unsubscribeFromConversationMessages = async (channel) => {
  if (!channel) return

  await supabase.removeChannel(channel)
}
