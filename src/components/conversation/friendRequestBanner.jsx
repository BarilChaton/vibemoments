import { FiCheck, FiX } from 'react-icons/fi'
import { useTranslation } from 'react-i18next'

const FriendRequestBanner = ({ otherUser, loading, onRespond }) => {
  const { t } = useTranslation()

  const displayName = otherUser?.display_name || t('common.thisPerson')

  return (
    <div className="shrink-0 border-b border-vibe-petrol/10 bg-vibe-apricot/15 px-4 py-3">
      <div className="flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-vibe-petrol">{t('conversation.friendship.requestTitle')}</p>

          <p className="mt-0.5 text-xs leading-5 text-vibe-muted">
            {t('conversation.friendship.requestDescription', { name: displayName })}
          </p>
        </div>

        <button
          className="flex size-10 shrink-0 items-center justify-center rounded-full bg-vibe-bg text-vibe-muted transition active:scale-95 disabled:opacity-50"
          type="button"
          title={t('conversation.friendship.decline')}
          disabled={loading}
          onClick={() => onRespond(false)}>
          <FiX />
        </button>

        <button
          className="flex size-10 shrink-0 items-center justify-center rounded-full bg-vibe-apricot text-vibe-text transition active:scale-95 disabled:opacity-50"
          type="button"
          title={t('conversation.friendship.accept')}
          disabled={loading}
          onClick={() => onRespond(true)}>
          <FiCheck />
        </button>
      </div>
    </div>
  )
}

export default FriendRequestBanner
