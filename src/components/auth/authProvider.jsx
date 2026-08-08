import { App } from '@capacitor/app'
import { Browser } from '@capacitor/browser'
import { useEffect } from 'react'
import { supabase } from '../../services/supabase.js'
import { getProfile } from '../../services/auth.js'
import useAuthStore from '../../stores/useAuthStore.js'

const AuthProvider = ({ children }) => {
  const { setSession, setProfile, setInitialized } = useAuthStore()

  useEffect(() => {
    let appUrlListener

    const loadProfile = async (userId) => {
      try {
        const profile = await getProfile(userId)
        setProfile(profile)
      } catch (error) {
        console.error('Failed to load profile:', error)
      }
    }

    const loadSession = async () => {
      const { data } = await supabase.auth.getSession()
      const session = data.session

      setSession(session)

      if (session?.user) {
        await loadProfile(session.user.id)
      }

      setInitialized(true)
    }

    const handleDeepLink = async ({ url }) => {
      if (!url.startsWith('vibemoments://auth/callback')) return

      try {
        await Browser.close()

        const hash = url.split('#')[1]

        if (!hash) {
          console.error('OAuth callback did not contain authentication tokens.')
          return
        }

        const params = new URLSearchParams(hash)

        const accessToken = params.get('access_token')
        const refreshToken = params.get('refresh_token')

        if (!accessToken || !refreshToken) {
          console.error('OAuth callback is missing access or refresh token.')
          return
        }

        const { error } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken
        })

        if (error) throw error
      } catch (error) {
        console.error('Failed to handle OAuth callback:', error)
      }
    }

    loadSession()

    App.addListener('appUrlOpen', handleDeepLink).then((listener) => {
      appUrlListener = listener
    })

    const { data: authListener } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setSession(session)

      if (session?.user) {
        await loadProfile(session.user.id)
      } else {
        setProfile(null)
      }
    })

    return () => {
      authListener.subscription.unsubscribe()
      appUrlListener?.remove()
    }
  }, [setSession, setProfile, setInitialized])

  return children
}

export default AuthProvider
