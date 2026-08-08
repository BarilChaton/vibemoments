import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import useAuthStore from './stores/useAuthStore.js'
import AuthScreen from './components/auth/authScreen.jsx'
import Onboarding from './components/onboarding/onboarding.jsx'
import BottomNavigation from './components/navigation/BottomNavigation.jsx'
import Home from './views/Home.jsx'
import CreateVibe from './views/CreateVibe.jsx'
import Profile from './views/Profile.jsx'
import Friends from './views/Friends.jsx'
import Inbox from './views/Inbox.jsx'

const App = () => {
  const { user, profile, initialized } = useAuthStore()
  const queryClient = useQueryClient()
  const [activeView, setActiveView] = useState('home')

  const handleVibePublished = async () => {
    await queryClient.invalidateQueries({
      queryKey: ['nearby-vibes']
    })

    setActiveView('home')
  }

  if (!initialized) {
    return (
      <main className="flex min-h-dvh items-center justify-center bg-vibe-bg text-vibe-text">
        <p className="text-xl font-bold text-vibe-petrol">VibeMoments</p>
      </main>
    )
  }

  if (!user) return <AuthScreen />

  if (!profile?.onboarding_completed) return <Onboarding />

  return (
    <main className="flex h-dvh flex-col overflow-hidden bg-vibe-bg text-vibe-text">
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
        {activeView === 'home' && <Home />}
        {activeView === 'friends' && <Friends />}
        {activeView === 'create' && <CreateVibe onPublished={handleVibePublished} />}
        {activeView === 'inbox' && <Inbox />}
        {activeView === 'profile' && <Profile />}
      </div>

      <BottomNavigation activeView={activeView} onChange={setActiveView} />
    </main>
  )
}

export default App
