import { useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { FiHome, FiMessageCircle, FiPlus, FiUser, FiUsers } from 'react-icons/fi'
import { getTotalUnreadCount, subscribeToInboxMessages, unsubscribeFromInboxMessages } from '../../services/connections.js'
import useChatStore from '../../stores/useChatStore.js'

const BottomNavigation = ({ activeView, onChange }) => {
  const queryClient = useQueryClient()
  const { activeConversationId } = useChatStore()

  const items = [
    { id: 'home', label: 'Vibes', icon: FiHome },
    { id: 'friends', label: 'Friends', icon: FiUsers },
    { id: 'create', label: 'Create', icon: FiPlus },
    { id: 'inbox', label: 'Inbox', icon: FiMessageCircle },
    { id: 'profile', label: 'Profile', icon: FiUser }
  ]

  const { data: unreadCount = 0 } = useQuery({
    queryKey: ['total-unread-messages'],
    queryFn: getTotalUnreadCount,
    staleTime: 1000 * 15
  })

  useEffect(() => {
    const channel = subscribeToInboxMessages((newMessage) => {
      queryClient.invalidateQueries({
        queryKey: ['conversations']
      })

      if (newMessage.conversation_id !== activeConversationId) {
        queryClient.invalidateQueries({
          queryKey: ['total-unread-messages']
        })
      }
    })

    return () => {
      unsubscribeFromInboxMessages(channel)
    }
  }, [activeConversationId, queryClient])

  return (
    <nav className="safe-bottom relative z-40 border-t border-vibe-petrol/10 bg-vibe-surface">
      <div className="mx-auto flex h-17 w-full max-w-md items-center justify-around px-2">
        {items.map((item) => {
          const Icon = item.icon
          const active = activeView === item.id
          const create = item.id === 'create'
          const inbox = item.id === 'inbox'

          if (create) {
            return (
              <button
                className="relative flex h-full min-w-16 flex-col items-center justify-end pb-2"
                key={item.id}
                type="button"
                onClick={() => onChange(item.id)}>
                <div className="absolute -top-5 flex size-15 items-center justify-center rounded-full border-4 border-vibe-surface bg-vibe-apricot text-vibe-text shadow-lg shadow-vibe-apricot/20 transition active:scale-95">
                  <Icon className="text-3xl" />
                </div>

                <span className={`text-[11px] font-semibold ${active ? 'text-vibe-apricot-dark' : 'text-vibe-muted'}`}>{item.label}</span>
              </button>
            )
          }

          return (
            <button
              className={`flex h-full min-w-16 flex-col items-center justify-center gap-1 transition ${
                active ? 'text-vibe-petrol' : 'text-vibe-muted'
              }`}
              key={item.id}
              type="button"
              onClick={() => onChange(item.id)}>
              <div className="relative">
                <Icon className="text-2xl" />

                {inbox && unreadCount > 0 && (
                  <div className="absolute -right-2.5 -top-2 flex min-w-4.5 items-center justify-center rounded-full bg-vibe-apricot px-1 text-[9px] font-black leading-4.5 text-vibe-text shadow-sm">
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </div>
                )}
              </div>

              <span className="text-[11px] font-semibold">{item.label}</span>
            </button>
          )
        })}
      </div>
    </nav>
  )
}

export default BottomNavigation
