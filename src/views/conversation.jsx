import { useEffect, useRef, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { FiArrowLeft, FiSend } from 'react-icons/fi'
import {
  getConversation,
  getConversationMessages,
  markConversationAsRead,
  sendMessage,
  subscribeToConversationMessages,
  unsubscribeFromConversationMessages
} from '../services/connections.js'
import useAuthStore from '../stores/useAuthStore.js'

const MAX_MESSAGE_LENGTH = 1000

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

const formatMessageTime = (createdAt) => {
  return new Intl.DateTimeFormat(undefined, {
    hour: '2-digit',
    minute: '2-digit'
  }).format(new Date(createdAt))
}

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

const Conversation = ({ conversationId, onBack }) => {
  const { user } = useAuthStore()
  const queryClient = useQueryClient()

  const messagesEndRef = useRef(null)
  const inputRef = useRef(null)

  const [message, setMessage] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')

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
  // Send message
  // ---------------------------------------------------------------------------

  const handleSend = async () => {
    const trimmed = message.trim()

    if (!trimmed || sending || !conversationId) return

    setSending(true)
    setError('')

    try {
      const newMessage = await sendMessage({
        conversationId,
        message: trimmed
      })

      setMessage('')

      queryClient.setQueryData(['conversation-messages', conversationId], (current = []) => {
        if (current.some((item) => item.id === newMessage.id)) return current

        return [...current, newMessage]
      })

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
  // Realtime messages
  // ---------------------------------------------------------------------------

  useEffect(() => {
    if (!conversationId) return

    const channel = subscribeToConversationMessages(conversationId, async (newMessage) => {
      queryClient.setQueryData(['conversation-messages', conversationId], (current = []) => {
        if (current.some((message) => message.id === newMessage.id)) return current

        return [...current, newMessage]
      })

      if (newMessage.sender_id !== user?.id) {
        try {
          await markConversationAsRead(conversationId)

          queryClient.invalidateQueries({
            queryKey: ['conversations']
          })
        } catch (error) {
          console.error('Failed to update read state:', error)
        }
      }
    })

    return () => {
      unsubscribeFromConversationMessages(channel)
    }
  }, [conversationId, queryClient, user?.id])

  useEffect(() => {
    if (!conversationId) return

    markConversationAsRead(conversationId).catch((error) => {
      console.error('Failed to mark conversation as read:', error)
    })

    queryClient.invalidateQueries({
      queryKey: ['conversations']
    })
  }, [conversationId, queryClient])

  // ---------------------------------------------------------------------------
  // Scroll to latest message
  // ---------------------------------------------------------------------------

  useEffect(() => {
    if (!messages.length) return

    messagesEndRef.current?.scrollIntoView({
      behavior: 'smooth'
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
        <header className="safe-top flex items-center gap-3 border-b border-vibe-petrol/10 bg-vibe-surface px-4 pb-3 pt-3">
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
    <div className="flex min-h-0 flex-1 flex-col bg-vibe-bg">
      {/* Header */}
      <header className="safe-top z-20 flex shrink-0 items-center gap-3 border-b px-4 pb-3 pt-3 border-vibe-petrol/10 bg-vibe-surface ">
        <button
          className="flex size-10 shrink-0 items-center justify-center rounded-full text-vibe-petrol transition active:scale-95"
          type="button"
          onClick={onBack}>
          <FiArrowLeft className="text-xl" />
        </button>

        <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-vibe-petrol font-black text-vibe-surface">
          {otherUser?.display_name?.slice(0, 1)?.toUpperCase() || '?'}
        </div>

        <div className="min-w-0">
          <p className="truncate font-bold text-vibe-petrol">{otherUser?.display_name || 'Conversation'}</p>

          <div className="mt-0.5 flex items-center gap-1.5">
            <div className="size-1.5 rounded-full bg-vibe-lime" />
            <span className="text-xs text-vibe-muted">Connected through a Vibe</span>
          </div>
        </div>
      </header>

      {/* Messages */}
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5">
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

        <div className="flex flex-col gap-2">
          {messages.map((item, index) => {
            const mine = item.sender_id === user?.id

            const previousMessage = messages[index - 1]
            const previousMine = previousMessage?.sender_id === item.sender_id

            return (
              <div key={item.id} className={`flex ${mine ? 'justify-end' : 'justify-start'} ${previousMine ? 'mt-0' : 'mt-3'}`}>
                <div className={`max-w-[82%] ${mine ? 'items-end' : 'items-start'} flex flex-col`}>
                  <div
                    className={`rounded-2xl px-4 py-2.5 ${
                      mine ? 'rounded-br-md bg-vibe-petrol text-vibe-surface' : 'rounded-bl-md bg-vibe-surface text-vibe-text'
                    }`}>
                    <p className="wrap-break-word whitespace-pre-wrap text-sm leading-5">{item.body}</p>
                  </div>

                  <span className="mt-1 px-1 text-[10px] text-vibe-muted">{formatMessageTime(item.created_at)}</span>
                </div>
              </div>
            )
          })}
        </div>

        <div ref={messagesEndRef} />
      </div>

      {/* Error */}
      {error && <div className="shrink-0 px-4 py-2 text-center text-xs font-medium text-red-500">{error}</div>}

      {/* Composer */}
      <div className="shrink-0 border-t border-vibe-petrol/10 bg-vibe-surface px-3 pb-8 pt-3">
        <div className="flex items-end gap-2">
          <textarea
            ref={inputRef}
            className="max-h-32 min-h-11 flex-1 resize-none rounded-3xl border border-vibe-petrol/10 bg-vibe-bg px-4 py-3 text-sm leading-5 text-vibe-text outline-none transition placeholder:text-vibe-muted/60 focus:border-vibe-petrol/30"
            placeholder="Message..."
            value={message}
            maxLength={MAX_MESSAGE_LENGTH}
            rows={1}
            disabled={sending}
            onChange={(event) => {
              setMessage(event.target.value)
              setError('')
            }}
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
