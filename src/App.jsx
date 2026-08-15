import { useEffect, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import useAuthStore from './stores/useAuthStore.js'
import { registerPushNotifications } from './services/notifications.js'
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
  const [conversationToOpen, setConversationToOpen] = useState(null)
  const [cameraOpen, setCameraOpen] = useState(false)

  // ---------------------------------------------------------------------------
  // Push notifications
  // ---------------------------------------------------------------------------

  useEffect(() => {
    if (!initialized || !user?.id) return

    registerPushNotifications(user.id).catch((error) => {
      console.error('Failed to initialize push notifications:', error)
    })
  }, [initialized, user?.id])

  // ---------------------------------------------------------------------------
  // Conversation navigation
  // ---------------------------------------------------------------------------

  const handleOpenConversation = (conversationId) => {
    if (!conversationId) return

    setConversationToOpen(conversationId)
    setActiveView('inbox')
  }

  const handleInitialConversationOpened = () => {
    setConversationToOpen(null)
  }

  // ---------------------------------------------------------------------------
  // Navigation
  // ---------------------------------------------------------------------------

  const handleViewChange = (view) => {
    setConversationToOpen(null)
    setActiveView(view)
  }

  // ---------------------------------------------------------------------------
  // Vibe published
  // ---------------------------------------------------------------------------

  const handleVibePublished = async () => {
    await queryClient.invalidateQueries({
      queryKey: ['nearby-vibes']
    })

    setConversationToOpen(null)
    setActiveView('home')
  }

  // ---------------------------------------------------------------------------
  // Loading
  // ---------------------------------------------------------------------------

  if (!initialized) {
    return (
      <main className="flex min-h-dvh items-center justify-center bg-vibe-bg text-vibe-text">
        <p className="text-xl font-bold text-vibe-petrol">VibeMoments</p>
      </main>
    )
  }

  // ---------------------------------------------------------------------------
  // Authentication
  // ---------------------------------------------------------------------------

  if (!user) return <AuthScreen />

  // ---------------------------------------------------------------------------
  // Onboarding
  // ---------------------------------------------------------------------------

  if (!profile?.onboarding_completed) return <Onboarding />

  // ---------------------------------------------------------------------------
  // App
  // ---------------------------------------------------------------------------

  return (
    <main className={`flex h-dvh flex-col overflow-hidden text-vibe-text ${cameraOpen ? 'bg-transparent' : 'bg-vibe-bg'}`}>
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
        {activeView === 'home' && <Home onOpenConversation={handleOpenConversation} />}

        {activeView === 'friends' && <Friends onOpenConversation={handleOpenConversation} />}

        {activeView === 'create' && <CreateVibe onPublished={handleVibePublished} onCameraOpenChange={setCameraOpen} />}

        {activeView === 'inbox' && (
          <Inbox initialConversationId={conversationToOpen} onInitialConversationOpened={handleInitialConversationOpened} />
        )}

        {activeView === 'profile' && <Profile />}
      </div>

      {!cameraOpen && <BottomNavigation activeView={activeView} onChange={handleViewChange} />}
    </main>
  )
}

export default App
