import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { getConversations, getIncomingConnectionRequests } from '../services/connections.js'
import ConnectionRequestCard from '../components/inbox/ConnectionRequestCard.jsx'
import Conversation from './Conversation.jsx'

const Inbox = () => {
  const queryClient = useQueryClient()

  const [activeTab, setActiveTab] = useState('requests')
  const [activeConversationId, setActiveConversationId] = useState(null)

  // ---------------------------------------------------------------------------
  // Requests
  // ---------------------------------------------------------------------------

  const {
    data: requests = [],
    isLoading: requestsLoading,
    error: requestsError
  } = useQuery({
    queryKey: ['incoming-connection-requests'],
    queryFn: getIncomingConnectionRequests,
    staleTime: 1000 * 15
  })

  // ---------------------------------------------------------------------------
  // Conversations
  // ---------------------------------------------------------------------------

  const {
    data: conversations = [],
    isLoading: conversationsLoading,
    error: conversationsError
  } = useQuery({
    queryKey: ['conversations'],
    queryFn: getConversations,
    staleTime: 1000 * 15
  })

  // ---------------------------------------------------------------------------
  // Open conversation
  // ---------------------------------------------------------------------------

  const handleOpenConversation = (conversationId) => {
    if (!conversationId) return

    setActiveConversationId(conversationId)
  }

  const handleCloseConversation = () => {
    setActiveConversationId(null)
  }

  // ---------------------------------------------------------------------------
  // Connection accepted
  // ---------------------------------------------------------------------------

  const handleAccepted = async (conversationId) => {
    await Promise.all([
      queryClient.invalidateQueries({
        queryKey: ['incoming-connection-requests']
      }),
      queryClient.invalidateQueries({
        queryKey: ['conversations']
      })
    ])

    if (conversationId) {
      setActiveConversationId(conversationId)
    } else {
      setActiveTab('chats')
    }
  }

  // ---------------------------------------------------------------------------
  // Conversation view
  // ---------------------------------------------------------------------------

  if (activeConversationId) {
    return <Conversation conversationId={activeConversationId} onBack={handleCloseConversation} />
  }

  // ---------------------------------------------------------------------------
  // Inbox
  // ---------------------------------------------------------------------------

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* Header */}
      <header className="safe-top shrink-0 px-6 pb-4 pt-5">
        <p className="text-sm font-semibold text-vibe-apricot-dark">CONNECTIONS</p>
        <h1 className="mt-1 text-3xl font-black text-vibe-petrol">Inbox</h1>
        <p className="mt-2 text-sm text-vibe-muted">Requests and conversations started through nearby Vibes.</p>
      </header>

      {/* Tabs */}
      <div className="shrink-0 px-6">
        <div className="flex rounded-2xl bg-vibe-surface p-1">
          <button
            className={`flex-1 rounded-xl px-4 py-2.5 text-sm font-semibold transition ${
              activeTab === 'requests' ? 'bg-vibe-apricot text-vibe-text' : 'text-vibe-muted'
            }`}
            type="button"
            onClick={() => setActiveTab('requests')}>
            Requests
            {requests.length > 0 && ` (${requests.length})`}
          </button>

          <button
            className={`flex-1 rounded-xl px-4 py-2.5 text-sm font-semibold transition ${
              activeTab === 'chats' ? 'bg-vibe-petrol text-vibe-surface' : 'text-vibe-muted'
            }`}
            type="button"
            onClick={() => setActiveTab('chats')}>
            Chats
            {conversations.length > 0 && ` (${conversations.length})`}
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-24 pt-5">
        {/* Requests */}
        {activeTab === 'requests' && (
          <>
            {requestsLoading && (
              <div className="flex justify-center py-12">
                <div className="size-3 animate-pulse rounded-full bg-vibe-lime" />
              </div>
            )}

            {requestsError && (
              <div className="py-10 text-center">
                <p className="text-sm font-medium text-red-500">Could not load your requests.</p>
                <p className="mt-2 text-xs text-vibe-muted">{requestsError.message}</p>
              </div>
            )}

            {!requestsLoading && !requestsError && requests.length === 0 && (
              <div className="py-16 text-center">
                <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-vibe-apricot/15">
                  <div className="size-3 rounded-full bg-vibe-apricot" />
                </div>

                <p className="mt-4 font-semibold text-vibe-petrol">No requests right now</p>

                <p className="mx-auto mt-2 max-w-xs text-sm leading-6 text-vibe-muted">
                  If someone swipes right on one of your Vibes and sends a message, it will appear here.
                </p>
              </div>
            )}

            {!requestsLoading && !requestsError && requests.length > 0 && (
              <div className="space-y-3">
                {requests.map((request) => (
                  <ConnectionRequestCard key={request.id} request={request} onAccepted={handleAccepted} />
                ))}
              </div>
            )}
          </>
        )}

        {/* Chats */}
        {activeTab === 'chats' && (
          <>
            {conversationsLoading && (
              <div className="flex justify-center py-12">
                <div className="size-3 animate-pulse rounded-full bg-vibe-lime" />
              </div>
            )}

            {conversationsError && (
              <div className="py-10 text-center">
                <p className="text-sm font-medium text-red-500">Could not load your conversations.</p>
                <p className="mt-2 text-xs text-vibe-muted">{conversationsError.message}</p>
              </div>
            )}

            {!conversationsLoading && !conversationsError && conversations.length === 0 && (
              <div className="py-16 text-center">
                <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-vibe-petrol/10">
                  <div className="size-3 rounded-full bg-vibe-petrol" />
                </div>

                <p className="mt-4 font-semibold text-vibe-petrol">No conversations yet</p>

                <p className="mx-auto mt-2 max-w-xs text-sm leading-6 text-vibe-muted">
                  Conversations appear here after a Vibe creator replies to a connection request.
                </p>
              </div>
            )}

            {!conversationsLoading && !conversationsError && conversations.length > 0 && (
              <div className="space-y-2">
                {conversations.map((conversation) => {
                  const displayName = conversation.otherUser?.display_name || 'Conversation'
                  const initial = displayName.slice(0, 1).toUpperCase()

                  return (
                    <button
                      className="flex w-full items-center gap-3 rounded-2xl bg-vibe-surface p-4 text-left transition active:scale-[0.99]"
                      key={conversation.id}
                      type="button"
                      onClick={() => handleOpenConversation(conversation.id)}>
                      {/* Avatar */}
                      <div className="flex size-12 shrink-0 items-center justify-center rounded-full bg-vibe-petrol font-black text-vibe-surface">
                        {initial}
                      </div>

                      {/* Information */}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="truncate font-bold text-vibe-petrol">{displayName}</p>
                          <div className="size-1.5 shrink-0 rounded-full bg-vibe-lime" />
                        </div>

                        <p className="mt-1 truncate text-xs text-vibe-muted">Chat unlocked through a Vibe</p>
                      </div>

                      {/* Arrow */}
                      <span className="shrink-0 text-xl text-vibe-muted">›</span>
                    </button>
                  )
                })}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

export default Inbox
