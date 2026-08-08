import { FiUsers } from 'react-icons/fi'

const Friends = () => {
  return (
    <div className="flex flex-1 flex-col">
      <header className="safe-top px-6 pb-4 pt-5">
        <p className="text-sm font-semibold text-vibe-apricot-dark">YOUR PEOPLE</p>
        <h1 className="mt-1 text-3xl font-black text-vibe-petrol">Friends</h1>
        <p className="mt-1 text-sm text-vibe-muted">People you've connected with through VibeMoments.</p>
      </header>

      <div className="flex flex-1 items-center justify-center px-6 text-center">
        <div>
          <div className="mx-auto flex size-20 items-center justify-center rounded-full bg-vibe-surface">
            <FiUsers className="text-3xl text-vibe-petrol" />
          </div>

          <h2 className="mt-5 text-xl font-bold text-vibe-text">No friends yet</h2>
          <p className="mx-auto mt-2 max-w-xs text-sm leading-6 text-vibe-muted">Connect with people you discover through nearby Vibes.</p>
        </div>
      </div>
    </div>
  )
}

export default Friends
