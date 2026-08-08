import AuthScreen from './components/auth/authScreen.jsx'
import { signOut } from './services/auth.js'
import useAuthStore from './stores/useAuthStore.js'

const App = () => {
  const { user, profile, initialized } = useAuthStore()

  if (!initialized) {
    return (
      <main className="flex min-h-dvh items-center justify-center bg-black text-white">
        <p className="text-xl font-bold">VibeMoments</p>
      </main>
    )
  }

  if (!user) return <AuthScreen />

  if (!profile?.onboarding_completed) {
    return (
      <main className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-black text-white">
        <p>Onboarding coming next...</p>

        <button className="rounded-xl bg-white px-5 py-3 font-semibold text-black" onClick={signOut}>
          Log out
        </button>
      </main>
    )
  }

  return (
    <main className="flex min-h-dvh items-center justify-center bg-black text-white">
      <p>Nearby Vibes coming soon...</p>
    </main>
  )
}

export default App
