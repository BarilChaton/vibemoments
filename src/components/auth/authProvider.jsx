import { useEffect } from 'react'
import { supabase } from '../../services/supabase.js'
import { getProfile } from '../../services/auth.js'
import useAuthStore from '../../stores/useAuthStore.js'

const AuthProvider = ({ children }) => {
  const { setSession, setProfile, setInitialized } = useAuthStore()

  useEffect(() => {
    const loadSession = async () => {
      const { data } = await supabase.auth.getSession()
      const session = data.session

      setSession(session)

      if (session?.user) {
        try {
          const profile = await getProfile(session.user.id)
          setProfile(profile)
        } catch (error) {
          console.error('Failed to load profile:', error)
        }
      }

      setInitialized(true)
    }

    loadSession()

    const { data: authListener } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setSession(session)

      if (session?.user) {
        try {
          const profile = await getProfile(session.user.id)
          setProfile(profile)
        } catch (error) {
          console.error('Failed to load profile:', error)
        }
      } else {
        setProfile(null)
      }
    })

    return () => authListener.subscription.unsubscribe()
  }, [setSession, setProfile, setInitialized])

  return children
}

export default AuthProvider
