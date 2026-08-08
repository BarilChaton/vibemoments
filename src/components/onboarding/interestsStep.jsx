import { useEffect, useState } from 'react'
import { FiArrowLeft, FiPlus } from 'react-icons/fi'
import { getRandomInterests, saveUserInterests } from '../../services/onboarding.js'
import { createInterest } from '../../services/interests.js'
import useAuthStore from '../../stores/useAuthStore.js'

const MIN_INTERESTS = 3

const InterestsStep = ({ onBack, onNext }) => {
  const { user } = useAuthStore()

  const [interests, setInterests] = useState([])
  const [selected, setSelected] = useState([])
  const [customInterest, setCustomInterest] = useState('')
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const loadInterests = async () => {
      try {
        const data = await getRandomInterests()
        setInterests(data)
      } catch (error) {
        setError(error.message)
      } finally {
        setLoading(false)
      }
    }

    loadInterests()
  }, [])

  const refreshInterests = async () => {
    setLoading(true)
    setError('')

    try {
      const data = await getRandomInterests()

      setInterests((current) => {
        const selectedInterests = current.filter((interest) => selected.includes(interest.id))
        const newInterests = data.filter((interest) => !selected.includes(interest.id))

        return [...selectedInterests, ...newInterests].slice(0, 15)
      })
    } catch (error) {
      setError(error.message)
    } finally {
      setLoading(false)
    }
  }

  const toggleInterest = (interestId) => {
    setSelected((current) => (current.includes(interestId) ? current.filter((id) => id !== interestId) : [...current, interestId]))
    setError('')
  }

  const handleCreateInterest = async () => {
    const name = customInterest.trim()

    if (name.length < 2) return

    setCreating(true)
    setError('')

    try {
      const interest = await createInterest(user.id, name)

      setInterests((current) => {
        if (current.some((item) => item.id === interest.id)) return current

        return [...current, interest].sort((a, b) => a.name.localeCompare(b.name))
      })

      setSelected((current) => (current.includes(interest.id) ? current : [...current, interest.id]))
      setCustomInterest('')
    } catch (error) {
      setError(error.message)
    } finally {
      setCreating(false)
    }
  }

  const handleContinue = async () => {
    if (selected.length < MIN_INTERESTS) return

    setSaving(true)
    setError('')

    try {
      await saveUserInterests(user.id, selected)
      onNext()
    } catch (error) {
      setError(error.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex flex-1 flex-col">
      <button
        className="mb-6 flex w-fit items-center gap-2 text-sm font-medium text-vibe-muted transition hover:text-vibe-petrol active:opacity-50"
        type="button"
        onClick={onBack}>
        <FiArrowLeft />
        Back
      </button>

      <div>
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-vibe-apricot">Step 2 of 3</p>

        <h1 className="mt-3 text-3xl font-black text-vibe-text">What's your vibe?</h1>

        <p className="mt-3 leading-6 text-vibe-muted">
          Choose at least {MIN_INTERESTS} things you're into. Can't find something? Add your own.
        </p>
      </div>

      <div className="mt-8 flex gap-2">
        <input
          className="min-w-0 flex-1 rounded-2xl border border-vibe-petrol/15 bg-vibe-surface px-4 py-3 text-vibe-text outline-none transition placeholder:text-vibe-muted/50 focus:border-vibe-apricot focus:ring-2 focus:ring-vibe-apricot/15"
          type="text"
          placeholder="Add an interest..."
          value={customInterest}
          maxLength={40}
          onChange={(e) => {
            setCustomInterest(e.target.value)
            setError('')
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleCreateInterest()
          }}
        />

        <button
          className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-vibe-apricot text-xl text-vibe-text shadow-lg shadow-vibe-apricot/15 transition hover:bg-vibe-apricot-dark hover:text-vibe-surface active:scale-95 disabled:opacity-30"
          type="button"
          disabled={customInterest.trim().length < 2 || creating}
          onClick={handleCreateInterest}>
          <FiPlus />
        </button>
      </div>

      {loading ? (
        <div className="flex flex-1 items-center justify-center">
          <p className="text-sm text-vibe-muted">Loading interests...</p>
        </div>
      ) : (
        <>
          <div className="mt-6 flex flex-wrap gap-2">
            {interests.map((interest) => {
              const active = selected.includes(interest.id)

              return (
                <button
                  key={interest.id}
                  className={`rounded-full border px-4 py-2.5 text-sm font-semibold transition active:scale-95 ${
                    active
                      ? 'border-vibe-petrol bg-vibe-petrol text-vibe-surface shadow-md shadow-vibe-petrol/10'
                      : 'border-vibe-petrol/15 bg-vibe-surface text-vibe-muted hover:border-vibe-apricot hover:bg-vibe-apricot/10 hover:text-vibe-text'
                  }`}
                  type="button"
                  onClick={() => toggleInterest(interest.id)}>
                  {interest.name}
                </button>
              )
            })}
          </div>

          <button
            className="mt-5 w-fit text-sm font-semibold text-vibe-apricot-dark transition hover:text-vibe-apricot active:opacity-50 disabled:opacity-30"
            type="button"
            disabled={loading}
            onClick={refreshInterests}>
            Show different interests
          </button>
        </>
      )}

      {error && <p className="mt-4 text-sm font-medium text-red-500">{error}</p>}

      <div className="mt-auto pt-8">
        <p className="mb-3 text-center text-sm text-vibe-muted">
          <span className={selected.length >= MIN_INTERESTS ? 'font-semibold text-vibe-petrol' : ''}>{selected.length} selected</span>

          {selected.length < MIN_INTERESTS && ` · ${MIN_INTERESTS - selected.length} more needed`}
        </p>

        <button
          className="w-full rounded-2xl bg-vibe-petrol px-5 py-4 font-bold text-vibe-surface shadow-lg shadow-vibe-petrol/15 transition hover:bg-vibe-petrol-light active:scale-[0.98] disabled:opacity-30"
          type="button"
          disabled={selected.length < MIN_INTERESTS || saving || loading}
          onClick={handleContinue}>
          {saving ? 'Saving...' : 'Continue'}
        </button>
      </div>
    </div>
  )
}

export default InterestsStep
