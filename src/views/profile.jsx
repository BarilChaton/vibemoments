import { FiLogOut } from 'react-icons/fi'
import { signOut } from '../services/auth.js'
import useAuthStore from '../stores/useAuthStore.js'

const Profile = () => {
  const { profile } = useAuthStore()

  return (
    <div className="flex flex-1 flex-col">
      <header className="safe-top px-6 pb-4 pt-5">
        <p className="text-sm font-semibold text-vibe-apricot-dark">YOUR VIBE</p>
        <h1 className="mt-1 text-3xl font-black text-vibe-petrol">Profile</h1>
      </header>

      <div className="px-6 pt-6">
        <div className="rounded-3xl bg-vibe-surface p-6 shadow-sm">
          <div className="flex size-16 items-center justify-center rounded-full bg-vibe-petrol text-2xl font-black text-vibe-surface">
            {profile?.display_name?.charAt(0)?.toUpperCase() || '?'}
          </div>

          <h2 className="mt-4 text-xl font-bold text-vibe-text">{profile?.display_name || 'Vibe user'}</h2>
          <p className="mt-1 text-sm text-vibe-muted">Your public VibeMoments identity.</p>
        </div>
      </div>

      <div className="mt-auto px-6 pb-6">
        <button
          className="flex w-full items-center justify-center gap-2 rounded-2xl border border-vibe-petrol/15 bg-vibe-surface px-5 py-4 font-semibold text-vibe-text active:scale-[0.98]"
          type="button"
          onClick={signOut}>
          <FiLogOut />
          Log out
        </button>
      </div>
    </div>
  )
}

export default Profile
