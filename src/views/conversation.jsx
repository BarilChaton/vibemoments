import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { App } from '@capacitor/app'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { FiArrowLeft } from 'react-icons/fi'
import {
  getConversation,
  getConversationMessages,
  markConversationAsRead,
  sendConversationTyping,
  sendMessage,
  subscribeToConversationMessages,
  subscribeToConversationTyping,
  unsubscribeFromConversationMessages,
  unsubscribeFromConversationTyping
} from '../services/connections.js'
import { getFriendshipState, respondToFriendRequest, sendFriendRequest } from '../services/friends.js'
import useAuthStore from '../stores/useAuthStore.js'
import useChatStore from '../stores/useChatStore.js'
import ConversationHeader from '../components/conversation/conversationHeader.jsx'
import FriendRequestBanner from '../components/conversation/friendRequestBanner.jsx'
import MessageList from '../components/conversation/messageList.jsx'
import TypingIndicator from '../components/conversation/typingIndicator.jsx'
import MessageComposer from '../components/conversation/messageComposer.jsx'

const MAX_MESSAGE_LENGTH = 1000

const Conversation = ({ conversationId, onBack }) => {
  const { user } = useAuthStore()
  const { setActiveConversationId } = useChatStore()
  const queryClient = useQueryClient()

  const messagesEndRef = useRef(null)
  const inputRef = useRef(null)

  const initialScrollDoneRef = useRef(false)
  const previousMessageCountRef = useRef(0)

  const typingChannelRef = useRef(null)
  const typingTimeoutRef = useRef(null)
  const remoteTypingTimeoutRef = useRef(null)
  const typingRef = useRef(false)

  const [message, setMessage] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const [otherUserTyping, setOtherUserTyping] = useState(false)

  const [friendActionLoading, setFriendActionLoading] = useState(false)
  const [friendError, setFriendError] = useState('')

  // ---------------------------------------------------------------------------
  // Conversation
  // ---------------------------------------------------------------------------

  const {
    data: conversation,
    isLoading: conversationLoading,
    error: conversationError
  } = useQuery({
    queryKey: ['conversation', conversationId],
    queryFn: () => getConversation(conversationId),
    enabled: Boolean(conversationId),
    staleTime: 1000 * 60
  })

  // ---------------------------------------------------------------------------
  // Messages
  // ---------------------------------------------------------------------------

  const {
    data: messages = [],
    isLoading: messagesLoading,
    error: messagesError
  } = useQuery({
    queryKey: ['conversation-messages', conversationId],
    queryFn: () => getConversationMessages(conversationId),
    enabled: Boolean(conversationId),
    staleTime: Infinity
  })

  // ---------------------------------------------------------------------------
  // Friendship state
  // ---------------------------------------------------------------------------

  const {
    data: friendshipState = {
      state: 'locked',
      request_id: null
    },
    isLoading: friendshipLoading
  } = useQuery({
    queryKey: ['friendship-state', conversationId],
    queryFn: () => getFriendshipState(conversationId),
    enabled: Boolean(conversationId),
    staleTime: 0,
    refetchInterval: 2500,
    refetchIntervalInBackground: false,
    refetchOnMount: true
  })

  // ---------------------------------------------------------------------------
  // Scroll reset
  // ---------------------------------------------------------------------------

  useEffect(() => {
    initialScrollDoneRef.current = false
    previousMessageCountRef.current = 0
  }, [conversationId])

  // ---------------------------------------------------------------------------
  // Active conversation
  // ---------------------------------------------------------------------------

  useEffect(() => {
    if (!conversationId) return

    setActiveConversationId(conversationId)

    return () => {
      setActiveConversationId(null)
    }
  }, [conversationId, setActiveConversationId])

  // ---------------------------------------------------------------------------
  // Mark as read
  // ---------------------------------------------------------------------------

  useEffect(() => {
    if (!conversationId) return

    const markRead = async () => {
      try {
        await markConversationAsRead(conversationId)

        await Promise.all([
          queryClient.invalidateQueries({
            queryKey: ['conversations']
          }),

          queryClient.invalidateQueries({
            queryKey: ['total-unread-messages']
          })
        ])
      } catch (readError) {
        console.error('Failed to mark conversation as read:', readError)
      }
    }

    markRead()
  }, [conversationId, queryClient])

  // ---------------------------------------------------------------------------
  // App resume
  // ---------------------------------------------------------------------------

  useEffect(() => {
    if (!conversationId) return

    const refreshConversation = async () => {
      try {
        await queryClient.refetchQueries({
          queryKey: ['conversation-messages', conversationId],
          exact: true,
          type: 'active'
        })

        await markConversationAsRead(conversationId)

        await Promise.all([
          queryClient.invalidateQueries({
            queryKey: ['conversations']
          }),

          queryClient.invalidateQueries({
            queryKey: ['total-unread-messages']
          }),

          queryClient.invalidateQueries({
            queryKey: ['friendship-state', conversationId]
          })
        ])
      } catch (refreshError) {
        console.error('Failed to refresh conversation:', refreshError)
      }
    }

    let appStateListener
    let disposed = false

    const setupAppStateListener = async () => {
      const listener = await App.addListener('appStateChange', ({ isActive }) => {
        if (!isActive) return

        refreshConversation()
      })

      if (disposed) {
        listener.remove()
        return
      }

      appStateListener = listener
    }

    setupAppStateListener()

    return () => {
      disposed = true
      appStateListener?.remove()
    }
  }, [conversationId, queryClient])

  // ---------------------------------------------------------------------------
  // Send message
  // ---------------------------------------------------------------------------

  const handleSend = async () => {
    const trimmed = message.trim()

    if (!trimmed || sending || !conversationId || !user) return

    setSending(true)
    setError('')

    try {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current)
      }

      if (typingRef.current) {
        typingRef.current = false

        await sendConversationTyping(typingChannelRef.current, {
          userId: user.id,
          typing: false
        })
      }

      const newMessage = await sendMessage({
        conversationId,
        message: trimmed
      })

      setMessage('')

      queryClient.setQueryData(['conversation-messages', conversationId], (current = []) => {
        if (current.some((item) => item.id === newMessage.id)) return current

        return [...current, newMessage]
      })

      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ['conversations']
        }),

        queryClient.invalidateQueries({
          queryKey: ['total-unread-messages']
        }),

        queryClient.invalidateQueries({
          queryKey: ['friendship-state', conversationId]
        })
      ])

      requestAnimationFrame(() => {
        inputRef.current?.focus()
      })
    } catch (sendError) {
      console.error('Failed to send message:', sendError)
      setError(sendError.message || 'Could not send your message.')
    } finally {
      setSending(false)
    }
  }

  const handleKeyDown = (event) => {
    if (event.key !== 'Enter' || event.shiftKey) return

    event.preventDefault()
    handleSend()
  }

  // ---------------------------------------------------------------------------
  // Typing
  // ---------------------------------------------------------------------------

  const handleTyping = (value) => {
    setMessage(value)
    setError('')

    if (!user?.id || !typingChannelRef.current) return

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current)
    }

    if (value.trim()) {
      if (!typingRef.current) {
        typingRef.current = true

        sendConversationTyping(typingChannelRef.current, {
          userId: user.id,
          typing: true
        })
      }

      typingTimeoutRef.current = setTimeout(() => {
        typingRef.current = false

        sendConversationTyping(typingChannelRef.current, {
          userId: user.id,
          typing: false
        })
      }, 1200)
    } else if (typingRef.current) {
      typingRef.current = false

      sendConversationTyping(typingChannelRef.current, {
        userId: user.id,
        typing: false
      })
    }
  }

  // ---------------------------------------------------------------------------
  // Friendship
  // ---------------------------------------------------------------------------

  const handleSendFriendRequest = async () => {
    if (!conversationId || friendActionLoading) return

    setFriendActionLoading(true)
    setFriendError('')

    try {
      await sendFriendRequest(conversationId)

      await queryClient.invalidateQueries({
        queryKey: ['friendship-state', conversationId]
      })
    } catch (friendRequestError) {
      console.error('Failed to send friend request:', friendRequestError)
      setFriendError(friendRequestError.message || 'Could not send friend request.')
    } finally {
      setFriendActionLoading(false)
    }
  }

  const handleRespondToFriendRequest = async (accept) => {
    if (!friendshipState.request_id || friendActionLoading) return

    setFriendActionLoading(true)
    setFriendError('')

    try {
      await respondToFriendRequest({
        requestId: friendshipState.request_id,
        accept
      })

      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ['friendship-state', conversationId]
        }),

        queryClient.invalidateQueries({
          queryKey: ['friends']
        }),

        queryClient.invalidateQueries({
          queryKey: ['profile-stats']
        })
      ])
    } catch (friendResponseError) {
      console.error('Failed to respond to friend request:', friendResponseError)
      setFriendError(friendResponseError.message || 'Could not update friend request.')
    } finally {
      setFriendActionLoading(false)
    }
  }

  // ---------------------------------------------------------------------------
  // Realtime messages
  // ---------------------------------------------------------------------------

  useEffect(() => {
    if (!conversationId) return

    const channel = subscribeToConversationMessages(conversationId, async (newMessage) => {
      queryClient.setQueryData(['conversation-messages', conversationId], (current = []) => {
        if (current.some((item) => item.id === newMessage.id)) return current

        return [...current, newMessage]
      })

      await queryClient.invalidateQueries({
        queryKey: ['friendship-state', conversationId]
      })

      if (newMessage.sender_id !== user?.id) {
        try {
          await markConversationAsRead(conversationId)

          await Promise.all([
            queryClient.invalidateQueries({
              queryKey: ['conversations']
            }),

            queryClient.invalidateQueries({
              queryKey: ['total-unread-messages']
            })
          ])
        } catch (readError) {
          console.error('Failed to update read state:', readError)
        }
      }
    })

    return () => {
      unsubscribeFromConversationMessages(channel)
    }
  }, [conversationId, queryClient, user?.id])

  // ---------------------------------------------------------------------------
  // Realtime typing
  // ---------------------------------------------------------------------------

  useEffect(() => {
    if (!conversationId || !user?.id) return

    const channel = subscribeToConversationTyping(conversationId, (payload) => {
      if (payload.userId === user.id) return

      if (remoteTypingTimeoutRef.current) {
        clearTimeout(remoteTypingTimeoutRef.current)
      }

      setOtherUserTyping(payload.typing)

      if (payload.typing) {
        remoteTypingTimeoutRef.current = setTimeout(() => {
          setOtherUserTyping(false)
        }, 3000)
      }
    })

    typingChannelRef.current = channel

    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current)
      }

      if (remoteTypingTimeoutRef.current) {
        clearTimeout(remoteTypingTimeoutRef.current)
      }

      if (typingRef.current) {
        sendConversationTyping(channel, {
          userId: user.id,
          typing: false
        })
      }

      unsubscribeFromConversationTyping(channel)

      typingChannelRef.current = null
      typingRef.current = false
    }
  }, [conversationId, user?.id])

  // ---------------------------------------------------------------------------
  // Initial scroll
  // ---------------------------------------------------------------------------

  useLayoutEffect(() => {
    if (messagesLoading || !messages.length || initialScrollDoneRef.current) return

    messagesEndRef.current?.scrollIntoView({
      behavior: 'instant',
      block: 'end'
    })

    initialScrollDoneRef.current = true
    previousMessageCountRef.current = messages.length
  }, [messages, messagesLoading])

  // ---------------------------------------------------------------------------
  // New-message scroll
  // ---------------------------------------------------------------------------

  useEffect(() => {
    if (!initialScrollDoneRef.current) return

    const previousCount = previousMessageCountRef.current

    previousMessageCountRef.current = messages.length

    if (messages.length <= previousCount) return

    messagesEndRef.current?.scrollIntoView({
      behavior: 'smooth',
      block: 'end'
    })
  }, [messages])

  // ---------------------------------------------------------------------------
  // Loading
  // ---------------------------------------------------------------------------

  if (conversationLoading) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <div className="text-center">
          <div className="mx-auto size-3 animate-pulse rounded-full bg-vibe-lime" />
          <p className="mt-4 text-sm text-vibe-muted">Loading conversation...</p>
        </div>
      </div>
    )
  }

  // ---------------------------------------------------------------------------
  // Error
  // ---------------------------------------------------------------------------

  if (conversationError) {
    return (
      <div className="flex flex-1 flex-col">
        <header className="safe-top flex items-center gap-3 border-b border-vibe-petrol/10 bg-vibe-surface px-4 pb-3 pt-5">
          <button
            className="flex size-10 items-center justify-center rounded-full text-vibe-petrol transition active:scale-95"
            type="button"
            onClick={onBack}>
            <FiArrowLeft className="text-xl" />
          </button>

          <p className="font-bold text-vibe-petrol">Conversation</p>
        </header>

        <div className="flex flex-1 items-center justify-center px-6 text-center">
          <div>
            <p className="font-semibold text-vibe-text">Couldn't load this conversation.</p>
            <p className="mt-2 text-sm text-vibe-muted">{conversationError.message}</p>
          </div>
        </div>
      </div>
    )
  }

  const otherUser = conversation?.otherUser

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-vibe-bg">
      <ConversationHeader
        otherUser={otherUser}
        friendshipState={friendshipState}
        friendshipLoading={friendshipLoading}
        friendActionLoading={friendActionLoading}
        onBack={onBack}
        onSendFriendRequest={handleSendFriendRequest}
      />

      {friendshipState.state === 'incoming_pending' && (
        <FriendRequestBanner otherUser={otherUser} loading={friendActionLoading} onRespond={handleRespondToFriendRequest} />
      )}

      <MessageList
        messages={messages}
        messagesLoading={messagesLoading}
        messagesError={messagesError}
        userId={user?.id}
        messagesEndRef={messagesEndRef}
      />

      <TypingIndicator visible={otherUserTyping} displayName={otherUser?.display_name} />

      {friendError && <div className="shrink-0 px-4 py-2 text-center text-xs font-medium text-red-500">{friendError}</div>}

      {error && <div className="shrink-0 px-4 py-2 text-center text-xs font-medium text-red-500">{error}</div>}

      <MessageComposer
        inputRef={inputRef}
        message={message}
        sending={sending}
        maxLength={MAX_MESSAGE_LENGTH}
        onChange={handleTyping}
        onKeyDown={handleKeyDown}
        onSend={handleSend}
      />
    </div>
  )
}

export default Conversation
