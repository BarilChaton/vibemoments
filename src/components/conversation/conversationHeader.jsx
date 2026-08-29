import { FiArrowLeft, FiUserPlus, FiUsers } from 'react-icons/fi'
import { useTranslation } from 'react-i18next'

const ConversationHeader = ({ otherUser, friendshipState, friendshipLoading, friendActionLoading, onBack, onSendFriendRequest }) => {
  const { t } = useTranslation()

  return (
    <header className="z-20 flex shrink-0 items-center gap-3 border-b border-vibe-petrol/10 bg-vibe-surface px-4 pb-3 pt-5">
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
        <p className="truncate font-bold text-vibe-petrol">{otherUser?.display_name || t('common.conversationFallback')}</p>

        <div className="mt-0.5 flex items-center gap-1.5">
          <div className="size-1.5 rounded-full bg-vibe-lime" />

          <span className="text-xs text-vibe-muted">
            {friendshipState.state === 'friends' ? t('conversation.friends') : t('conversation.connectedThroughVibe')}
          </span>
        </div>
      </div>

      {!friendshipLoading && friendshipState.state === 'eligible' && (
        <button
          className="flex shrink-0 items-center gap-1.5 rounded-full bg-vibe-apricot px-3 py-2 text-xs font-bold text-vibe-text transition active:scale-95 disabled:opacity-50"
          type="button"
          disabled={friendActionLoading}
          onClick={onSendFriendRequest}>
          <FiUserPlus />
          {friendActionLoading ? t('conversation.friendship.sending') : t('conversation.friendship.addFriend')}
        </button>
      )}

      {!friendshipLoading && friendshipState.state === 'outgoing_pending' && (
        <div className="shrink-0 rounded-full bg-vibe-bg px-3 py-2 text-xs font-semibold text-vibe-muted">
          {t('conversation.friendship.requestSent')}
        </div>
      )}

      {!friendshipLoading && friendshipState.state === 'friends' && (
        <div className="flex shrink-0 items-center gap-1.5 rounded-full bg-vibe-lime/20 px-3 py-2 text-xs font-bold text-vibe-petrol">
          <FiUsers />
          {t('conversation.friends')}
        </div>
      )}
    </header>
  )
}

export default ConversationHeader
