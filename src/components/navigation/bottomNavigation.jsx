import { FiHome, FiMessageCircle, FiPlus, FiUser, FiUsers } from 'react-icons/fi'

const BottomNavigation = ({ activeView, onChange }) => {
  const items = [
    { id: 'home', label: 'Vibes', icon: FiHome },
    { id: 'friends', label: 'Friends', icon: FiUsers },
    { id: 'create', label: 'Create', icon: FiPlus },
    { id: 'inbox', label: 'Inbox', icon: FiMessageCircle },
    { id: 'profile', label: 'Profile', icon: FiUser }
  ]

  return (
    <nav className="safe-bottom relative z-40 border-t border-vibe-petrol/10 bg-vibe-surface">
      <div className="mx-auto flex h-17 w-full max-w-md items-center justify-around px-2">
        {items.map((item) => {
          const Icon = item.icon
          const active = activeView === item.id
          const create = item.id === 'create'

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
              <Icon className="text-2xl" />
              <span className="text-[11px] font-semibold">{item.label}</span>
            </button>
          )
        })}
      </div>
    </nav>
  )
}

export default BottomNavigation
