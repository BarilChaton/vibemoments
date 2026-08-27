import { useTranslation } from 'react-i18next'

const TypingIndicator = ({ visible, displayName }) => {
  const { t } = useTranslation()

  const name = displayName || t('common.someone')

  return (
    <div className="h-6 shrink-0 px-5">
      <div
        className={`flex items-center gap-1.5 text-xs font-medium text-vibe-muted transition-opacity duration-200 ${
          visible ? 'opacity-100' : 'opacity-0'
        }`}>
        <div className="flex gap-1">
          <span className="size-1.5 animate-bounce rounded-full bg-vibe-apricot" />
          <span className="size-1.5 animate-bounce rounded-full bg-vibe-apricot [animation-delay:150ms]" />
          <span className="size-1.5 animate-bounce rounded-full bg-vibe-apricot [animation-delay:300ms]" />
        </div>

        <span>{t('conversation.typing', { name })}</span>
      </div>
    </div>
  )
}

export default TypingIndicator
