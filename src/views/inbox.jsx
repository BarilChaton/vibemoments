import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { getConversations, getIncomingConnectionRequests } from '../services/connections.js'
import ConnectionRequestCard from '../components/inbox/ConnectionRequestCard.jsx'
import Conversation from './conversation.jsx'

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

const formatConversationTime = (createdAt, language) => {
  if (!createdAt) return ''

  const date = new Date(createdAt)
  const now = new Date()

  const sameDay = date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth() && date.getDate() === now.getDate()

  if (sameDay) {
    return new Intl.DateTimeFormat(language, {
      hour: '2-digit',
      minute: '2-digit'
    }).format(date)
  }

  return new Intl.DateTimeFormat(language, {
    month: 'short',
    day: 'numeric'
  }).format(date)
}

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

const Inbox = ({ initialConversationId = null }) => {
  const { t, i18n } = useTranslation()
  const queryClient = useQueryClient()

  const [activeTab, setActiveTab] = useState('chats')
  const [activeConversationId, setActiveConversationId] = useState(initialConversationId)

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

  const unreadConversationCount = conversations.filter((conversation) => Number(conversation.unread_count || 0) > 0).length

  const language = i18n.resolvedLanguage || i18n.language

  // ---------------------------------------------------------------------------
  // Conversation navigation
  // ---------------------------------------------------------------------------

  const handleOpenConversation = (conversationId) => {
    if (!conversationId) return

    setActiveConversationId(conversationId)
    setActiveTab('chats')
  }

  const handleCloseConversation = () => {
    setActiveConversationId(null)
    setActiveTab('chats')
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
      }),

      queryClient.invalidateQueries({
        queryKey: ['total-unread-messages']
      })
    ])

    if (conversationId) {
      setActiveConversationId(conversationId)
    }

    setActiveTab('chats')
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
      <header className="shrink-0 px-6 pb-4 pt-5">
        <p className="text-sm font-semibold text-vibe-apricot-dark">{t('inbox.eyebrow')}</p>

        <h1 className="mt-1 text-3xl font-black text-vibe-petrol">{t('inbox.title')}</h1>

        <p className="mt-2 text-sm text-vibe-muted">{t('inbox.description')}</p>
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
            {t('inbox.tabs.requests')}
            {requests.length > 0 && ` (${requests.length})`}
          </button>

          <button
            className={`flex-1 rounded-xl px-4 py-2.5 text-sm font-semibold transition ${
              activeTab === 'chats' ? 'bg-vibe-petrol text-vibe-surface' : 'text-vibe-muted'
            }`}
            type="button"
            onClick={() => setActiveTab('chats')}>
            {t('inbox.tabs.chats')}
            {unreadConversationCount > 0 && ` (${unreadConversationCount})`}
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
                <p className="text-sm font-medium text-red-500">{t('inbox.requests.loadError')}</p>
              </div>
            )}

            {!requestsLoading && !requestsError && requests.length === 0 && (
              <div className="py-16 text-center">
                <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-vibe-apricot/15">
                  <div className="size-3 rounded-full bg-vibe-apricot" />
                </div>

                <p className="mt-4 font-semibold text-vibe-petrol">{t('inbox.requests.emptyTitle')}</p>

                <p className="mx-auto mt-2 max-w-xs text-sm leading-6 text-vibe-muted">{t('inbox.requests.emptyDescription')}</p>
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
                <p className="text-sm font-medium text-red-500">{t('inbox.chats.loadError')}</p>
              </div>
            )}

            {!conversationsLoading && !conversationsError && conversations.length === 0 && (
              <div className="py-16 text-center">
                <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-vibe-petrol/10">
                  <div className="size-3 rounded-full bg-vibe-petrol" />
                </div>

                <p className="mt-4 font-semibold text-vibe-petrol">{t('inbox.chats.emptyTitle')}</p>

                <p className="mx-auto mt-2 max-w-xs text-sm leading-6 text-vibe-muted">{t('inbox.chats.emptyDescription')}</p>
              </div>
            )}

            {!conversationsLoading && !conversationsError && conversations.length > 0 && (
              <div className="space-y-2">
                {conversations.map((conversation) => {
                  const displayName = conversation.otherUser?.display_name || t('common.conversationFallback')
                  const initial = displayName.slice(0, 1).toUpperCase()
                  const unreadCount = Number(conversation.unread_count || 0)

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
                          <p className={`truncate text-vibe-petrol ${unreadCount > 0 ? 'font-black' : 'font-bold'}`}>{displayName}</p>

                          {unreadCount > 0 && <div className="size-2 shrink-0 rounded-full bg-vibe-apricot" />}
                        </div>

                        <div className="mt-1 flex items-center gap-2">
                          <p
                            className={`min-w-0 flex-1 truncate text-xs ${
                              unreadCount > 0 ? 'font-semibold text-vibe-text' : 'text-vibe-muted'
                            }`}>
                            {conversation.last_message_type === 'gif'
                              ? t('inbox.chats.sentGif')
                              : conversation.last_message_body || t('inbox.chats.unlocked')}
                          </p>

                          {conversation.last_message_at && (
                            <span
                              className={`shrink-0 text-[11px] ${
                                unreadCount > 0 ? 'font-semibold text-vibe-apricot-dark' : 'text-vibe-muted'
                              }`}>
                              {formatConversationTime(conversation.last_message_at, language)}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Unread badge */}
                      {unreadCount > 0 ? (
                        <div className="flex min-w-6 shrink-0 items-center justify-center rounded-full bg-vibe-apricot px-2 py-1 text-[11px] font-black text-vibe-text">
                          {unreadCount > 99 ? '99+' : unreadCount}
                        </div>
                      ) : (
                        <span className="shrink-0 text-xl text-vibe-muted">›</span>
                      )}
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
