import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { App } from '@capacitor/app'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { FiArrowLeft, FiCheck, FiSend, FiUserPlus, FiUsers, FiX } from 'react-icons/fi'
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

const MAX_MESSAGE_LENGTH = 1000
const LINK_REGEX = /((?:https?:\/\/|www\.)[^\s]+)/gi

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

const formatMessageTime = (createdAt) => {
  return new Intl.DateTimeFormat(undefined, {
    hour: '2-digit',
    minute: '2-digit'
  }).format(new Date(createdAt))
}

const renderMessageBody = (body) => {
  const parts = body.split(LINK_REGEX)

  return parts.map((part, index) => {
    if (!part.match(LINK_REGEX)) {
      return part
    }

    const href = part.toLowerCase().startsWith('www.') ? `https://${part}` : part

    return (
      <a
        key={`${part}-${index}`}
        className="break-all underline underline-offset-2"
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        onClick={(event) => event.stopPropagation()}>
        {part}
      </a>
    )
  })
}

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

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
  // Reset scroll state
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
  // Mark conversation as read
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
      } catch (error) {
        console.error('Failed to mark conversation as read:', error)
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
      } catch (error) {
        console.error('Failed to refresh conversation:', error)
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
    } catch (error) {
      console.error('Failed to send message:', error)
      setError(error.message || 'Could not send your message.')
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
  // Friend request
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
    } catch (error) {
      console.error('Failed to send friend request:', error)
      setFriendError(error.message || 'Could not send friend request.')
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
    } catch (error) {
      console.error('Failed to respond to friend request:', error)
      setFriendError(error.message || 'Could not update friend request.')
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
        } catch (error) {
          console.error('Failed to update read state:', error)
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
  // Initial scroll to latest
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
  // New message scroll
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
  // Conversation error
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
      {/* Header */}
      <header className="safe-top z-20 flex shrink-0 items-center gap-3 border-b border-vibe-petrol/10 bg-vibe-surface px-4 pb-3 pt-5">
        <button
          className="flex size-10 shrink-0 items-center justify-center rounded-full text-vibe-petrol transition active:scale-95"
          type="button"
          onClick={onBack}>
          <FiArrowLeft className="text-xl" />
        </button>

        <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-vibe-petrol font-black text-vibe-surface">
          {otherUser?.display_name?.slice(0, 1)?.toUpperCase() || '?'}
        </div>

        <div className="min-w-0 flex-1">
          <p className="truncate font-bold text-vibe-petrol">{otherUser?.display_name || 'Conversation'}</p>

          <div className="mt-0.5 flex items-center gap-1.5">
            <div className="size-1.5 rounded-full bg-vibe-lime" />

            <span className="text-xs text-vibe-muted">{friendshipState.state === 'friends' ? 'Friends' : 'Connected through a Vibe'}</span>
          </div>
        </div>

        {!friendshipLoading && friendshipState.state === 'eligible' && (
          <button
            className="flex shrink-0 items-center gap-1.5 rounded-full bg-vibe-apricot px-3 py-2 text-xs font-bold text-vibe-text transition active:scale-95 disabled:opacity-50"
            type="button"
            disabled={friendActionLoading}
            onClick={handleSendFriendRequest}>
            <FiUserPlus />
            {friendActionLoading ? 'Sending...' : 'Add friend'}
          </button>
        )}

        {!friendshipLoading && friendshipState.state === 'outgoing_pending' && (
          <div className="shrink-0 rounded-full bg-vibe-bg px-3 py-2 text-xs font-semibold text-vibe-muted">Request sent</div>
        )}

        {!friendshipLoading && friendshipState.state === 'friends' && (
          <div className="flex shrink-0 items-center gap-1.5 rounded-full bg-vibe-lime/20 px-3 py-2 text-xs font-bold text-vibe-petrol">
            <FiUsers />
            Friends
          </div>
        )}
      </header>

      {/* Incoming friend request */}
      {friendshipState.state === 'incoming_pending' && (
        <div className="shrink-0 border-b border-vibe-petrol/10 bg-vibe-apricot/15 px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-vibe-petrol">Friend request</p>

              <p className="mt-0.5 text-xs leading-5 text-vibe-muted">
                {otherUser?.display_name || 'This person'} would like to add you as a friend.
              </p>
            </div>

            <button
              className="flex size-10 shrink-0 items-center justify-center rounded-full bg-vibe-bg text-vibe-muted transition active:scale-95 disabled:opacity-50"
              type="button"
              title="Decline"
              disabled={friendActionLoading}
              onClick={() => handleRespondToFriendRequest(false)}>
              <FiX />
            </button>

            <button
              className="flex size-10 shrink-0 items-center justify-center rounded-full bg-vibe-apricot text-vibe-text transition active:scale-95 disabled:opacity-50"
              type="button"
              title="Accept"
              disabled={friendActionLoading}
              onClick={() => handleRespondToFriendRequest(true)}>
              <FiCheck />
            </button>
          </div>
        </div>
      )}

      {/* Messages */}
      <div className="min-h-0 min-w-0 flex-1 overflow-x-hidden overflow-y-auto px-4 pb-5 pt-7">
        {messagesLoading && (
          <div className="flex justify-center py-10">
            <div className="size-3 animate-pulse rounded-full bg-vibe-lime" />
          </div>
        )}

        {messagesError && (
          <div className="py-10 text-center">
            <p className="text-sm font-medium text-red-500">Could not load messages.</p>
          </div>
        )}

        {!messagesLoading && !messagesError && messages.length === 0 && (
          <div className="py-12 text-center">
            <p className="font-semibold text-vibe-petrol">Conversation unlocked</p>

            <p className="mx-auto mt-2 max-w-xs text-sm leading-6 text-vibe-muted">
              You connected through a Vibe. Messages between you will appear here.
            </p>
          </div>
        )}

        <div className="flex min-w-0 flex-col gap-2">
          {messages.map((item, index) => {
            const mine = item.sender_id === user?.id

            const previousMessage = messages[index - 1]
            const previousMine = previousMessage?.sender_id === item.sender_id

            return (
              <div key={item.id} className={`flex min-w-0 ${mine ? 'justify-end' : 'justify-start'} ${previousMine ? 'mt-0' : 'mt-3'}`}>
                <div className={`flex min-w-0 max-w-[82%] flex-col ${mine ? 'items-end' : 'items-start'}`}>
                  <div
                    className={`min-w-0 max-w-full overflow-hidden rounded-2xl px-4 py-2.5 ${
                      mine ? 'rounded-br-md bg-vibe-petrol text-vibe-surface' : 'rounded-bl-md bg-vibe-surface text-vibe-text'
                    }`}>
                    <p className="min-w-0 whitespace-pre-wrap wrap-anywhere text-sm leading-5">{renderMessageBody(item.body)}</p>
                  </div>

                  <span className="mt-1 px-1 text-[10px] text-vibe-muted">{formatMessageTime(item.created_at)}</span>
                </div>
              </div>
            )
          })}
        </div>

        <div ref={messagesEndRef} />
      </div>

      {/* Typing indicator */}
      <div className="h-6 shrink-0 px-5">
        <div
          className={`flex items-center gap-1.5 text-xs font-medium text-vibe-muted transition-opacity duration-200 ${
            otherUserTyping ? 'opacity-100' : 'opacity-0'
          }`}>
          <div className="flex gap-1">
            <span className="size-1.5 animate-bounce rounded-full bg-vibe-apricot" />
            <span className="size-1.5 animate-bounce rounded-full bg-vibe-apricot [animation-delay:150ms]" />
            <span className="size-1.5 animate-bounce rounded-full bg-vibe-apricot [animation-delay:300ms]" />
          </div>

          <span>{otherUser?.display_name || 'Someone'} is typing...</span>
        </div>
      </div>

      {/* Friendship error */}
      {friendError && <div className="shrink-0 px-4 py-2 text-center text-xs font-medium text-red-500">{friendError}</div>}

      {/* Message error */}
      {error && <div className="shrink-0 px-4 py-2 text-center text-xs font-medium text-red-500">{error}</div>}

      {/* Composer */}
      <div className="shrink-0 border-t border-vibe-petrol/10 bg-vibe-surface px-3 pb-8 pt-3">
        <div className="flex min-w-0 items-end gap-2">
          <textarea
            ref={inputRef}
            className="max-h-32 min-h-11 min-w-0 flex-1 resize-none rounded-3xl border border-vibe-petrol/10 bg-vibe-bg px-4 py-3 text-sm leading-5 text-vibe-text outline-none transition placeholder:text-vibe-muted/60 focus:border-vibe-petrol/30"
            placeholder="Message..."
            value={message}
            maxLength={MAX_MESSAGE_LENGTH}
            rows={1}
            disabled={sending}
            onChange={(event) => handleTyping(event.target.value)}
            onKeyDown={handleKeyDown}
          />

          <button
            className="flex size-11 shrink-0 items-center justify-center rounded-full bg-vibe-apricot text-vibe-text transition active:scale-90 disabled:opacity-30"
            type="button"
            disabled={!message.trim() || sending}
            onClick={handleSend}>
            <FiSend className="text-lg" />
          </button>
        </div>
      </div>
    </div>
  )
}

export default Conversation
