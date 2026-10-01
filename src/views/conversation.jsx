import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { App } from '@capacitor/app'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { FiArrowLeft } from 'react-icons/fi'
import {
  getConversation,
  getConversationMessages,
  getOtherUserReadState,
  markConversationAsRead,
  sendConversationReadReceipt,
  sendConversationTyping,
  sendGifMessage,
  sendMessage,
  subscribeToConversationMessages,
  subscribeToConversationReadReceipts,
  subscribeToConversationReadState,
  subscribeToConversationTyping,
  unsubscribeFromConversationMessages,
  unsubscribeFromConversationReadReceipts,
  unsubscribeFromConversationReadState,
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
  const { t } = useTranslation()
  const { user } = useAuthStore()
  const userId = user?.id

  const { setActiveConversationId } = useChatStore()
  const queryClient = useQueryClient()

  const messagesEndRef = useRef(null)
  const messagesScrollRef = useRef(null)
  const messagesContentRef = useRef(null)
  const inputRef = useRef(null)
  const initialScrollDoneRef = useRef(false)
  const previousMessageCountRef = useRef(0)
  const typingChannelRef = useRef(null)
  const typingTimeoutRef = useRef(null)
  const remoteTypingTimeoutRef = useRef(null)
  const typingRef = useRef(false)
  const readReceiptChannelRef = useRef(null)
  const lastReadMarkedAtRef = useRef(null)

  const [message, setMessage] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const [otherUserTyping, setOtherUserTyping] = useState(false)
  const [friendActionLoading, setFriendActionLoading] = useState(false)
  const [friendError, setFriendError] = useState('')

  const markReadAndBroadcast = useCallback(
    async (readAt) => {
      if (!conversationId || !userId || !readAt) return

      await markConversationAsRead(conversationId, readAt)

      await sendConversationReadReceipt(readReceiptChannelRef.current, {
        userId,
        readAt
      })
    },
    [conversationId, userId]
  )

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
  // Other-user read state
  // ---------------------------------------------------------------------------

  const otherUserId = conversation?.otherUser?.id

  const { data: otherUserReadState = null } = useQuery({
    queryKey: ['conversation-read-state', conversationId, otherUserId],
    queryFn: () => getOtherUserReadState(conversationId, otherUserId),
    enabled: Boolean(conversationId && otherUserId),
    staleTime: Infinity
  })

  const otherUserReadAt = otherUserReadState?.last_read_at || null

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
  // Mark incoming messages as read
  // ---------------------------------------------------------------------------

  useEffect(() => {
    if (!conversationId || !userId || messagesLoading || !messages.length) return

    let latestIncomingMessage = null

    for (let index = messages.length - 1; index >= 0; index -= 1) {
      if (messages[index].sender_id !== userId) {
        latestIncomingMessage = messages[index]
        break
      }
    }

    if (!latestIncomingMessage?.created_at) return
    if (lastReadMarkedAtRef.current === latestIncomingMessage.created_at) return

    let cancelled = false

    const markRead = async () => {
      try {
        await markReadAndBroadcast(latestIncomingMessage.created_at)

        if (cancelled) return

        lastReadMarkedAtRef.current = latestIncomingMessage.created_at

        await Promise.all([
          queryClient.invalidateQueries({
            queryKey: ['conversations']
          }),

          queryClient.invalidateQueries({
            queryKey: ['total-unread-messages']
          })
        ])
      } catch (readError) {
        if (!cancelled) {
          console.error('Failed to mark conversation as read:', readError)
        }
      }
    }

    markRead()

    return () => {
      cancelled = true
    }
  }, [conversationId, markReadAndBroadcast, messages, messagesLoading, queryClient, userId])

  // ---------------------------------------------------------------------------
  // Realtime read receipts
  // ---------------------------------------------------------------------------

  useEffect(() => {
    if (!conversationId || !userId || !otherUserId) return

    const channel = subscribeToConversationReadReceipts(conversationId, (payload) => {
      if (!payload?.userId || payload.userId !== otherUserId) return
      if (!payload.readAt) return

      queryClient.setQueryData(['conversation-read-state', conversationId, otherUserId], (current) => ({
        ...(current || {}),
        conversation_id: conversationId,
        user_id: otherUserId,
        last_read_at: payload.readAt
      }))
    })

    readReceiptChannelRef.current = channel

    return () => {
      unsubscribeFromConversationReadReceipts(channel)

      if (readReceiptChannelRef.current === channel) {
        readReceiptChannelRef.current = null
      }
    }
  }, [conversationId, otherUserId, queryClient, userId])

  // ---------------------------------------------------------------------------
  // Persisted read-state fallback
  // ---------------------------------------------------------------------------

  useEffect(() => {
    if (!conversationId || !otherUserId) return

    const channel = subscribeToConversationReadState(conversationId, otherUserId, (readState) => {
      queryClient.setQueryData(['conversation-read-state', conversationId, otherUserId], readState)
    })

    return () => {
      unsubscribeFromConversationReadState(channel)
    }
  }, [conversationId, otherUserId, queryClient])

  // ---------------------------------------------------------------------------
  // App resume
  // ---------------------------------------------------------------------------

  useEffect(() => {
    if (!conversationId) return

    const refreshConversation = async () => {
      try {
        const refreshes = [
          queryClient.refetchQueries({
            queryKey: ['conversation-messages', conversationId],
            exact: true,
            type: 'active'
          }),

          queryClient.invalidateQueries({
            queryKey: ['conversations']
          }),

          queryClient.invalidateQueries({
            queryKey: ['total-unread-messages']
          }),

          queryClient.invalidateQueries({
            queryKey: ['friendship-state', conversationId]
          })
        ]

        if (otherUserId) {
          refreshes.push(
            queryClient.refetchQueries({
              queryKey: ['conversation-read-state', conversationId, otherUserId],
              exact: true,
              type: 'active'
            })
          )
        }

        await Promise.all(refreshes)
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
  }, [conversationId, otherUserId, queryClient])

  // ---------------------------------------------------------------------------
  // Optimistic messages
  // ---------------------------------------------------------------------------

  const replaceOptimisticMessage = (localId, serverMessage) => {
    queryClient.setQueryData(['conversation-messages', conversationId], (current = []) => {
      const replaced = current.map((item) => {
        if (item.id !== localId) return item

        return {
          ...serverMessage,
          delivery_status: 'sent'
        }
      })

      const seen = new Set()

      return replaced.filter((item) => {
        if (seen.has(item.id)) return false

        seen.add(item.id)
        return true
      })
    })
  }

  const markOptimisticMessageFailed = (localId) => {
    queryClient.setQueryData(['conversation-messages', conversationId], (current = []) =>
      current.map((item) =>
        item.id === localId
          ? {
              ...item,
              delivery_status: 'failed'
            }
          : item
      )
    )
  }

  const markOptimisticMessageSending = (localId) => {
    queryClient.setQueryData(['conversation-messages', conversationId], (current = []) =>
      current.map((item) =>
        item.id === localId
          ? {
              ...item,
              delivery_status: 'sending'
            }
          : item
      )
    )
  }

  // ---------------------------------------------------------------------------
  // Send message
  // ---------------------------------------------------------------------------

  const handleSend = async () => {
    const trimmed = message.trim()

    if (!trimmed || sending || !conversationId || !userId) return

    const localId = `local-${crypto.randomUUID()}`

    const optimisticMessage = {
      id: localId,
      conversation_id: conversationId,
      sender_id: userId,
      body: trimmed,
      created_at: new Date().toISOString(),
      message_type: 'text',
      media_url: null,
      media_preview_url: null,
      media_provider: null,
      media_id: null,
      delivery_status: 'sending',
      local: true
    }

    queryClient.setQueryData(['conversation-messages', conversationId], (current = []) => [...current, optimisticMessage])

    setMessage('')
    setSending(true)
    setError('')

    try {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current)
      }

      if (typingRef.current) {
        typingRef.current = false

        await sendConversationTyping(typingChannelRef.current, {
          userId,
          typing: false
        })
      }

      const newMessage = await sendMessage({
        conversationId,
        message: trimmed
      })

      replaceOptimisticMessage(localId, newMessage)

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

      markOptimisticMessageFailed(localId)
    } finally {
      setSending(false)
    }
  }

  // ---------------------------------------------------------------------------
  // Retry message
  // ---------------------------------------------------------------------------

  const handleRetryMessage = async (failedMessage) => {
    if (!failedMessage || sending || !conversationId || !userId) return

    const localId = failedMessage.id

    markOptimisticMessageSending(localId)
    setSending(true)
    setError('')

    try {
      let newMessage

      if (failedMessage.message_type === 'gif') {
        newMessage = await sendGifMessage({
          conversationId,
          gif: {
            id: failedMessage.media_id,
            url: failedMessage.media_url,
            previewUrl: failedMessage.media_preview_url,
            provider: failedMessage.media_provider
          }
        })
      } else {
        newMessage = await sendMessage({
          conversationId,
          message: failedMessage.body
        })
      }

      replaceOptimisticMessage(localId, newMessage)

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
    } catch (retryError) {
      console.error('Failed to retry message:', retryError)

      markOptimisticMessageFailed(localId)
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
  // Send GIF
  // ---------------------------------------------------------------------------

  const handleSendGif = async (gif) => {
    if (!conversationId || !userId || sending) return

    const localId = `local-${crypto.randomUUID()}`

    const optimisticMessage = {
      id: localId,
      conversation_id: conversationId,
      sender_id: userId,
      body: null,
      created_at: new Date().toISOString(),
      message_type: 'gif',
      media_url: gif.url,
      media_preview_url: gif.previewUrl || gif.url,
      media_provider: gif.provider || 'klipy',
      media_id: String(gif.id),
      delivery_status: 'sending',
      local: true
    }

    queryClient.setQueryData(['conversation-messages', conversationId], (current = []) => [...current, optimisticMessage])

    setSending(true)
    setError('')

    try {
      const newMessage = await sendGifMessage({
        conversationId,
        gif
      })

      replaceOptimisticMessage(localId, newMessage)

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
    } catch (gifError) {
      console.error('Failed to send GIF:', gifError)

      markOptimisticMessageFailed(localId)
    } finally {
      setSending(false)
    }
  }

  // ---------------------------------------------------------------------------
  // Typing
  // ---------------------------------------------------------------------------

  const handleTyping = (value) => {
    setMessage(value)
    setError('')

    if (!userId || !typingChannelRef.current) return

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current)
    }

    if (value.trim()) {
      if (!typingRef.current) {
        typingRef.current = true

        sendConversationTyping(typingChannelRef.current, {
          userId,
          typing: true
        })
      }

      typingTimeoutRef.current = setTimeout(() => {
        typingRef.current = false

        sendConversationTyping(typingChannelRef.current, {
          userId,
          typing: false
        })
      }, 1200)
    } else if (typingRef.current) {
      typingRef.current = false

      sendConversationTyping(typingChannelRef.current, {
        userId,
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
      setFriendError(t('conversation.friendship.sendError'))
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
      setFriendError(t('conversation.friendship.respondError'))
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
    })

    return () => {
      unsubscribeFromConversationMessages(channel)
    }
  }, [conversationId, queryClient])

  // ---------------------------------------------------------------------------
  // Realtime typing
  // ---------------------------------------------------------------------------

  useEffect(() => {
    if (!conversationId || !userId) return

    const channel = subscribeToConversationTyping(conversationId, (payload) => {
      if (payload.userId === userId) return

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
          userId,
          typing: false
        })
      }

      unsubscribeFromConversationTyping(channel)

      typingChannelRef.current = null
      typingRef.current = false
    }
  }, [conversationId, userId])

  // ---------------------------------------------------------------------------
  // Reset conversation refs
  // ---------------------------------------------------------------------------

  useLayoutEffect(() => {
    initialScrollDoneRef.current = false
    previousMessageCountRef.current = 0
    lastReadMarkedAtRef.current = null
  }, [conversationId])

  // ---------------------------------------------------------------------------
  // Initial scroll to latest
  // ---------------------------------------------------------------------------

  useEffect(() => {
    if (conversationLoading || messagesLoading || !messages.length || initialScrollDoneRef.current) return

    const container = messagesScrollRef.current
    const content = messagesContentRef.current

    if (!container || !content) return

    let disposed = false
    let settleTimer = null

    const scrollToBottom = () => {
      if (disposed) return

      container.scrollTop = container.scrollHeight
    }

    const scheduleSettled = () => {
      clearTimeout(settleTimer)

      settleTimer = setTimeout(() => {
        if (disposed) return

        scrollToBottom()

        initialScrollDoneRef.current = true
        previousMessageCountRef.current = messages.length
      }, 400)
    }

    scrollToBottom()

    requestAnimationFrame(() => {
      scrollToBottom()

      requestAnimationFrame(() => {
        scrollToBottom()
      })
    })

    const observer = new ResizeObserver(() => {
      scrollToBottom()
      scheduleSettled()
    })

    observer.observe(content)

    const timers = [
      setTimeout(scrollToBottom, 50),
      setTimeout(scrollToBottom, 150),
      setTimeout(scrollToBottom, 300),
      setTimeout(scrollToBottom, 600),
      setTimeout(scrollToBottom, 1000)
    ]

    scheduleSettled()

    return () => {
      disposed = true

      observer.disconnect()
      clearTimeout(settleTimer)

      timers.forEach((timer) => {
        clearTimeout(timer)
      })
    }
  }, [conversationId, conversationLoading, messages, messagesLoading])

  // ---------------------------------------------------------------------------
  // New-message scroll
  // ---------------------------------------------------------------------------

  useEffect(() => {
    if (!initialScrollDoneRef.current) return

    const previousCount = previousMessageCountRef.current

    previousMessageCountRef.current = messages.length

    if (messages.length <= previousCount) return

    const container = messagesScrollRef.current

    if (!container) return

    requestAnimationFrame(() => {
      container.scrollTo({
        top: container.scrollHeight,
        behavior: 'smooth'
      })
    })
  }, [messages])

  // ---------------------------------------------------------------------------
  // Media layout correction
  // ---------------------------------------------------------------------------

  const handleMessageMediaLoad = () => {
    if (!initialScrollDoneRef.current) return

    const container = messagesScrollRef.current

    if (!container) return

    const distanceFromBottom = container.scrollHeight - container.scrollTop - container.clientHeight

    if (distanceFromBottom > 150) return

    requestAnimationFrame(() => {
      container.scrollTop = container.scrollHeight
    })
  }

  // ---------------------------------------------------------------------------
  // Loading
  // ---------------------------------------------------------------------------

  if (conversationLoading) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <div className="text-center">
          <div className="mx-auto size-3 animate-pulse rounded-full bg-vibe-lime" />

          <p className="mt-4 text-sm text-vibe-muted">{t('conversation.loading')}</p>
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
        <header className="flex items-center gap-3 border-b border-vibe-petrol/10 bg-vibe-surface px-4 pb-3 pt-5">
          <button
            className="flex size-10 items-center justify-center rounded-full text-vibe-petrol transition active:scale-95"
            type="button"
            onClick={onBack}>
            <FiArrowLeft className="text-xl" />
          </button>

          <p className="font-bold text-vibe-petrol">{t('common.conversation')}</p>
        </header>

        <div className="flex flex-1 items-center justify-center px-6 text-center">
          <div>
            <p className="font-semibold text-vibe-text">{t('conversation.loadError')}</p>
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
        userId={userId}
        otherUserReadAt={otherUserReadAt}
        scrollContainerRef={messagesScrollRef}
        messagesContentRef={messagesContentRef}
        messagesEndRef={messagesEndRef}
        onMediaLoad={handleMessageMediaLoad}
        onRetry={handleRetryMessage}
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
        onGifSelect={handleSendGif}
      />
    </div>
  )
}

export default Conversation
