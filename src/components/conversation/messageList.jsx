import { useTranslation } from 'react-i18next'
import { formatMessageTime, renderMessageBody } from '../../utils/conversationMessages.jsx'
import GifMessage from './gifMessage.jsx'

const MessageList = ({
  messages,
  messagesLoading,
  messagesError,
  userId,
  scrollContainerRef,
  messagesContentRef,
  messagesEndRef,
  onMediaLoad
}) => {
  const { t } = useTranslation()

  return (
    <div ref={scrollContainerRef} className="min-h-0 min-w-0 flex-1 overflow-x-hidden overflow-y-auto px-4 pb-5 pt-7">
      <div ref={messagesContentRef}>
        {messagesLoading && (
          <div className="flex justify-center py-10">
            <div className="size-3 animate-pulse rounded-full bg-vibe-lime" />
          </div>
        )}

        {messagesError && (
          <div className="py-10 text-center">
            <p className="text-sm font-medium text-red-500">{t('conversation.messages.loadError')}</p>
          </div>
        )}

        {!messagesLoading && !messagesError && messages.length === 0 && (
          <div className="py-12 text-center">
            <p className="font-semibold text-vibe-petrol">{t('conversation.messages.emptyTitle')}</p>

            <p className="mx-auto mt-2 max-w-xs text-sm leading-6 text-vibe-muted">{t('conversation.messages.emptyDescription')}</p>
          </div>
        )}

        <div className="flex min-w-0 flex-col gap-2">
          {messages.map((item, index) => {
            const mine = item.sender_id === userId
            const previousMessage = messages[index - 1]
            const previousMine = previousMessage?.sender_id === item.sender_id

            return (
              <div key={item.id} className={`flex min-w-0 ${mine ? 'justify-end' : 'justify-start'} ${previousMine ? 'mt-0' : 'mt-3'}`}>
                <div className={`flex min-w-0 max-w-[82%] flex-col ${mine ? 'items-end' : 'items-start'}`}>
                  {item.message_type === 'gif' ? (
                    <GifMessage message={item} onLoad={onMediaLoad} />
                  ) : (
                    <div
                      className={`min-w-0 max-w-full overflow-hidden rounded-2xl px-4 py-2.5 ${
                        mine ? 'rounded-br-md bg-vibe-petrol text-vibe-surface' : 'rounded-bl-md bg-vibe-surface text-vibe-text'
                      }`}>
                      <p className="min-w-0 whitespace-pre-wrap wrap-anywhere text-sm leading-5">{renderMessageBody(item.body || '')}</p>
                    </div>
                  )}

                  <span className="mt-1 px-1 text-[10px] text-vibe-muted">{formatMessageTime(item.created_at)}</span>
                </div>
              </div>
            )
          })}
        </div>

        <div ref={messagesEndRef} />
      </div>
    </div>
  )
}

export default MessageList
