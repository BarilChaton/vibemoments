import { supabase } from './supabase.js'

// -----------------------------------------------------------------------------
// Connection requests
// -----------------------------------------------------------------------------

export const createConnectionRequest = async ({ vibeId, message }) => {
  const { data, error } = await supabase.rpc('create_vibe_connection_request', {
    target_vibe_id: vibeId,
    message_text: message
  })

  if (error) throw error

  return data
}

export const getConnectionRequestForVibe = async ({ vibeId, userId }) => {
  const { data: request, error: requestError } = await supabase
    .from('vibe_connection_requests')
    .select('id, vibe_id, sender_id, creator_id, status, created_at, expires_at, responded_at')
    .eq('vibe_id', vibeId)
    .eq('sender_id', userId)
    .maybeSingle()

  if (requestError) throw requestError
  if (!request) return null

  if (request.status !== 'accepted') return request

  const { data: conversation, error: conversationError } = await supabase
    .from('conversations')
    .select('id')
    .eq('connection_request_id', request.id)
    .maybeSingle()

  if (conversationError) throw conversationError

  return {
    ...request,
    conversation
  }
}

// -----------------------------------------------------------------------------
// Existing connection between two users
// -----------------------------------------------------------------------------

export const getExistingConversationBetweenUsers = async ({ userId, otherUserId }) => {
  if (!userId || !otherUserId || userId === otherUserId) return null

  const { data, error } = await supabase
    .from('conversations')
    .select('id, connection_request_id, user_a_id, user_b_id, created_at')
    .or(`and(user_a_id.eq.${userId},user_b_id.eq.${otherUserId}),and(user_a_id.eq.${otherUserId},user_b_id.eq.${userId})`)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()

  if (error) throw error

  return data
}

// -----------------------------------------------------------------------------
// Incoming requests
// -----------------------------------------------------------------------------

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

// -----------------------------------------------------------------------------
// Accept request
// -----------------------------------------------------------------------------

export const acceptConnectionRequest = async ({ requestId, reply }) => {
  const { data, error } = await supabase.rpc('accept_vibe_connection_request', {
    request_id: requestId,
    reply_text: reply
  })

  if (error) throw error

  return data
}

// -----------------------------------------------------------------------------
// Conversations
// -----------------------------------------------------------------------------

export const getConversations = async () => {
  const { data, error } = await supabase.rpc('get_conversation_summaries')

  if (error) throw error

  return (data || []).map((conversation) => ({
    ...conversation,
    otherUser: {
      id: conversation.other_user_id,
      display_name: conversation.other_user_display_name
    }
  }))
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

// -----------------------------------------------------------------------------
// Messages
// -----------------------------------------------------------------------------

export const getConversationMessages = async (conversationId) => {
  const { data, error } = await supabase
    .from('messages')
    .select(
      `
      id,
      conversation_id,
      sender_id,
      body,
      created_at,
      message_type,
      media_url,
      media_preview_url,
      media_provider,
      media_id
    `
    )
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

const getMessageById = async (messageId) => {
  const { data, error } = await supabase
    .from('messages')
    .select(
      `
      id,
      conversation_id,
      sender_id,
      body,
      created_at,
      message_type,
      media_url,
      media_preview_url,
      media_provider,
      media_id
    `
    )
    .eq('id', messageId)
    .single()

  if (error) throw error

  return data
}

// -----------------------------------------------------------------------------
// Conversation realtime
// -----------------------------------------------------------------------------

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
      async (payload) => {
        try {
          let message = payload.new

          const needsHydration =
            !message.message_type || (message.message_type === 'gif' && !message.media_url) || (message.body === null && !message.media_url)

          if (needsHydration) {
            message = await getMessageById(message.id)
          }

          onMessage(message)
        } catch (error) {
          console.error('Failed to hydrate realtime message:', error)

          onMessage(payload.new)
        }
      }
    )
    .subscribe()

  return channel
}

export const unsubscribeFromConversationMessages = async (channel) => {
  if (!channel) return

  await supabase.removeChannel(channel)
}

// -----------------------------------------------------------------------------
// Inbox realtime
// -----------------------------------------------------------------------------

export const subscribeToInboxMessages = (onMessage) => {
  const channelName = `inbox-messages:${crypto.randomUUID()}`

  return supabase
    .channel(channelName)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'messages'
      },
      (payload) => {
        onMessage(payload.new)
      }
    )
    .subscribe()
}

export const unsubscribeFromInboxMessages = async (channel) => {
  if (!channel) return

  await supabase.removeChannel(channel)
}

// -----------------------------------------------------------------------------
// Read state
// -----------------------------------------------------------------------------

export const markConversationAsRead = async (conversationId) => {
  const { data: authData, error: authError } = await supabase.auth.getUser()

  if (authError) throw authError
  if (!authData.user) throw new Error('Not authenticated')

  const { error } = await supabase.from('conversation_reads').upsert(
    {
      conversation_id: conversationId,
      user_id: authData.user.id,
      last_read_at: new Date().toISOString()
    },
    {
      onConflict: 'conversation_id,user_id'
    }
  )

  if (error) throw error
}

export const getTotalUnreadCount = async () => {
  const { data, error } = await supabase.rpc('get_conversation_summaries')

  if (error) throw error

  return (data || []).reduce((total, conversation) => total + Number(conversation.unread_count || 0), 0)
}

// -----------------------------------------------------------------------------
// Typing realtime
// -----------------------------------------------------------------------------

export const subscribeToConversationTyping = (conversationId, onTyping) => {
  const channel = supabase
    .channel(`conversation-typing:${conversationId}`)
    .on('broadcast', { event: 'typing' }, ({ payload }) => {
      onTyping(payload)
    })
    .subscribe()

  return channel
}

export const sendConversationTyping = async (channel, { userId, typing }) => {
  if (!channel) return

  await channel.send({
    type: 'broadcast',
    event: 'typing',
    payload: {
      userId,
      typing
    }
  })
}

export const unsubscribeFromConversationTyping = async (channel) => {
  if (!channel) return

  await supabase.removeChannel(channel)
}

export const sendGifMessage = async ({ conversationId, gif }) => {
  if (!conversationId) {
    throw new Error('Conversation is required.')
  }

  if (!gif?.url || !gif?.id) {
    throw new Error('A valid GIF is required.')
  }

  const {
    data: { user },
    error: userError
  } = await supabase.auth.getUser()

  if (userError) throw userError
  if (!user) throw new Error('You must be signed in to send a GIF.')

  const { data, error } = await supabase
    .from('messages')
    .insert({
      conversation_id: conversationId,
      sender_id: user.id,
      body: null,
      message_type: 'gif',
      media_url: gif.url,
      media_preview_url: gif.previewUrl || gif.url,
      media_provider: gif.provider || 'klipy',
      media_id: String(gif.id)
    })
    .select()
    .single()

  if (error) throw error

  return data
}
