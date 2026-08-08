import useAuthStore from './stores/useAuthStore.js'
import AuthScreen from './components/auth/authScreen.jsx'
import Onboarding from './components/onboarding/onboarding.jsx'

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

  if (!profile?.onboarding_completed) return <Onboarding />

  return (
    <main className="flex min-h-dvh items-center justify-center bg-black text-white">
      <p>Nearby Vibes coming soon...</p>
    </main>
  )
}

export default App
