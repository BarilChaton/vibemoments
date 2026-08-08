import { useState } from 'react'
import { signIn, signInWithGoogle, signUp } from '../../services/auth.js'
import { FcGoogle } from 'react-icons/fc'

const AuthScreen = () => {
  const [mode, setMode] = useState('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  const isRegister = mode === 'register'

  const handleSubmit = async (e) => {
    e.preventDefault()

    setError('')
    setMessage('')
    setLoading(true)

    try {
      if (isRegister) {
        const data = await signUp(email, password)

        if (!data.session) {
          setMessage('Check your email to confirm your account.')
        }
      } else {
        await signIn(email, password)
      }
    } catch (error) {
      setError(error.message)
    } finally {
      setLoading(false)
    }
  }

  const handleGoogle = async () => {
    setError('')

    try {
      await signInWithGoogle()
    } catch (error) {
      setError(error.message)
    }
  }

  const switchMode = () => {
    setMode(isRegister ? 'login' : 'register')
    setError('')
    setMessage('')
  }

  return (
    <main className="flex min-h-dvh flex-col bg-vibe-bg px-6 pb-8 pt-[calc(env(safe-area-inset-top)+3rem)] text-vibe-text">
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col">
        <header className="mb-12">
          <h1 className="text-4xl font-black tracking-tight text-vibe-petrol">VibeMoments</h1>
          <p className="mt-3 text-lg text-vibe-muted">See what's happening around you. Right now.</p>
        </header>

        <div className="flex-1">
          <h2 className="text-2xl font-bold text-vibe-text">{isRegister ? 'Create your account' : 'Welcome back'}</h2>

          <p className="mt-2 text-vibe-muted">
            {isRegister ? 'Join the vibes happening around you.' : "Log in to see what's happening nearby."}
          </p>

          <button
            className="mt-8 flex w-full items-center justify-center gap-3 rounded-2xl border border-vibe-petrol/10 bg-vibe-surface px-5 py-4 font-semibold text-vibe-text shadow-sm transition hover:border-vibe-petrol/25 active:scale-[0.98]"
            type="button"
            onClick={handleGoogle}>
            <FcGoogle className="text-xl" />
            Continue with Google
          </button>

          <div className="my-6 flex items-center gap-4">
            <div className="h-px flex-1 bg-vibe-petrol/15" />
            <span className="text-sm text-vibe-muted/70">or</span>
            <div className="h-px flex-1 bg-vibe-petrol/15" />
          </div>

          <form className="space-y-4" onSubmit={handleSubmit}>
            <input
              className="w-full rounded-2xl border border-vibe-petrol/15 bg-vibe-surface px-5 py-4 text-vibe-text outline-none transition placeholder:text-vibe-muted/60 focus:border-vibe-petrol focus:ring-2 focus:ring-vibe-petrol/10"
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              required
            />

            <input
              className="w-full rounded-2xl border border-vibe-petrol/15 bg-vibe-surface px-5 py-4 text-vibe-text outline-none transition placeholder:text-vibe-muted/60 focus:border-vibe-petrol focus:ring-2 focus:ring-vibe-petrol/10"
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={isRegister ? 'new-password' : 'current-password'}
              minLength={6}
              required
            />

            {error && <p className="text-sm font-medium text-red-500">{error}</p>}
            {message && <p className="text-sm font-medium text-vibe-petrol">{message}</p>}

            <button
              className="w-full rounded-2xl bg-vibe-petrol px-5 py-4 font-bold text-vibe-surface shadow-lg shadow-vibe-petrol/15 transition hover:bg-vibe-petrol-light active:scale-[0.98] disabled:opacity-50"
              type="submit"
              disabled={loading}>
              {loading ? 'Please wait...' : isRegister ? 'Create account' : 'Log in'}
            </button>
          </form>
        </div>

        <div className="pt-8 text-center text-sm text-vibe-muted">
          {isRegister ? 'Already have an account?' : 'New to VibeMoments?'}

          <button className="ml-2 font-semibold text-vibe-apricot transition active:opacity-60" type="button" onClick={switchMode}>
            {isRegister ? 'Log in' : 'Create account'}
          </button>
        </div>
      </div>
    </main>
  )
}

export default AuthScreen
