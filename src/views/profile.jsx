import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { FiCheck, FiEdit3, FiLogOut, FiPlus, FiSettings, FiUser, FiX } from 'react-icons/fi'
import { signOut } from '../services/auth.js'
import { getProfileStats, updateProfile } from '../services/profile.js'
import { createInterest, getRandomInterests, getUserInterests, setUserInterests } from '../services/interests.js'
import useAuthStore from '../stores/useAuthStore.js'

const MAX_INTERESTS = 10

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

const formatMemberSince = (createdAt, language) => {
  if (!createdAt) return ''

  return new Intl.DateTimeFormat(language, {
    month: 'long',
    year: 'numeric'
  }).format(new Date(createdAt))
}

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

const Profile = ({ onOpenSettings }) => {
  const { t, i18n } = useTranslation()
  const { user, profile, setProfile } = useAuthStore()
  const queryClient = useQueryClient()

  const [editingProfile, setEditingProfile] = useState(false)
  const [editingInterests, setEditingInterests] = useState(false)

  const [displayName, setDisplayName] = useState(profile?.display_name || '')
  const [username, setUsername] = useState(profile?.username || '')
  const [bio, setBio] = useState(profile?.bio || '')

  const [selectedInterestIds, setSelectedInterestIds] = useState([])
  const [customInterest, setCustomInterest] = useState('')

  const [savingProfile, setSavingProfile] = useState(false)
  const [savingInterests, setSavingInterests] = useState(false)
  const [creatingInterest, setCreatingInterest] = useState(false)

  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const language = i18n.resolvedLanguage || i18n.language

  // ---------------------------------------------------------------------------
  // Profile stats
  // ---------------------------------------------------------------------------

  const {
    data: stats = {
      vibes: 0,
      chats: 0
    },
    isLoading: statsLoading
  } = useQuery({
    queryKey: ['profile-stats', user?.id],
    queryFn: () => getProfileStats(user.id),
    enabled: Boolean(user?.id),
    staleTime: 1000 * 30
  })

  // ---------------------------------------------------------------------------
  // Interests
  // ---------------------------------------------------------------------------

  const { data: userInterests = [], isLoading: interestsLoading } = useQuery({
    queryKey: ['user-interests', user?.id],
    queryFn: () => getUserInterests(user.id),
    enabled: Boolean(user?.id),
    staleTime: 1000 * 30
  })

  const { data: suggestedInterests = [] } = useQuery({
    queryKey: ['profile-interest-suggestions'],
    queryFn: () => getRandomInterests(20),
    staleTime: 1000 * 60
  })

  const visibleInterests = editingInterests
    ? suggestedInterests.filter((interest) => !userInterests.some((userInterest) => userInterest.id === interest.id))
    : []

  // ---------------------------------------------------------------------------
  // Profile editing
  // ---------------------------------------------------------------------------

  const startProfileEditing = () => {
    setDisplayName(profile?.display_name || '')
    setUsername(profile?.username || '')
    setBio(profile?.bio || '')
    setError('')
    setSuccess('')
    setEditingProfile(true)
  }

  const cancelProfileEditing = () => {
    setEditingProfile(false)
    setError('')
  }

  const handleSaveProfile = async () => {
    if (!user?.id || savingProfile) return

    setSavingProfile(true)
    setError('')
    setSuccess('')

    try {
      const updatedProfile = await updateProfile({
        userId: user.id,
        displayName,
        username,
        bio
      })

      setProfile(updatedProfile)
      setEditingProfile(false)
      setSuccess(t('profile.identity.updated'))
    } catch (profileError) {
      console.error('Failed to update profile:', profileError)
      setError(t('profile.updateError'))
    } finally {
      setSavingProfile(false)
    }
  }

  // ---------------------------------------------------------------------------
  // Interest editing
  // ---------------------------------------------------------------------------

  const startInterestEditing = () => {
    setSelectedInterestIds(userInterests.map((interest) => interest.id))
    setCustomInterest('')
    setError('')
    setSuccess('')
    setEditingInterests(true)
  }

  const cancelInterestEditing = () => {
    setEditingInterests(false)
    setSelectedInterestIds([])
    setCustomInterest('')
    setError('')
  }

  const toggleInterest = (interestId) => {
    setSelectedInterestIds((current) => {
      if (current.includes(interestId)) {
        return current.filter((id) => id !== interestId)
      }

      if (current.length >= MAX_INTERESTS) {
        return current
      }

      return [...current, interestId]
    })
  }

  const handleCreateInterest = async () => {
    const name = customInterest.trim()

    if (!name || !user?.id || creatingInterest) return

    setCreatingInterest(true)
    setError('')

    try {
      const interest = await createInterest(user.id, name)

      setSelectedInterestIds((current) => {
        if (current.includes(interest.id)) return current
        if (current.length >= MAX_INTERESTS) return current

        return [...current, interest.id]
      })

      queryClient.setQueryData(['profile-interest-suggestions'], (current = []) => {
        if (current.some((item) => item.id === interest.id)) return current

        return [interest, ...current]
      })

      setCustomInterest('')
    } catch (interestError) {
      console.error('Failed to create interest:', interestError)
      setError(t('profile.interests.createError'))
    } finally {
      setCreatingInterest(false)
    }
  }

  const handleSaveInterests = async () => {
    if (!user?.id || savingInterests) return

    setSavingInterests(true)
    setError('')
    setSuccess('')

    try {
      await setUserInterests({
        userId: user.id,
        interestIds: selectedInterestIds
      })

      await queryClient.invalidateQueries({
        queryKey: ['user-interests', user.id]
      })

      setEditingInterests(false)
      setSuccess(t('profile.interests.updated'))
    } catch (interestError) {
      console.error('Failed to update interests:', interestError)
      setError(t('profile.interests.updateError'))
    } finally {
      setSavingInterests(false)
    }
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  const displayInitial = profile?.display_name?.charAt(0)?.toUpperCase() || profile?.username?.charAt(0)?.toUpperCase() || '?'

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="shrink-0 px-6 pb-4 pt-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-vibe-apricot-dark">{t('profile.eyebrow')}</p>

            <h1 className="mt-1 text-3xl font-black text-vibe-petrol">{t('profile.title')}</h1>
          </div>

          <button
            className="flex size-11 shrink-0 items-center justify-center rounded-full bg-vibe-surface text-vibe-petrol shadow-sm transition active:scale-95"
            type="button"
            onClick={onOpenSettings}>
            <FiSettings className="text-xl" />
          </button>
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-28">
        {/* Identity */}
        <div className="mt-2 rounded-3xl bg-vibe-surface p-5 shadow-sm">
          {!editingProfile ? (
            <>
              <div className="flex items-start justify-between gap-4">
                <div className="flex size-18 shrink-0 items-center justify-center rounded-full bg-vibe-petrol text-2xl font-black text-vibe-surface">
                  {displayInitial}
                </div>

                <button
                  className="flex items-center gap-2 rounded-full bg-vibe-bg px-4 py-2 text-sm font-semibold text-vibe-petrol transition active:scale-95"
                  type="button"
                  onClick={startProfileEditing}>
                  <FiEdit3 />
                  {t('common.edit')}
                </button>
              </div>

              <h2 className="mt-4 text-xl font-black text-vibe-text">{profile?.display_name || t('profile.identity.vibeUser')}</h2>

              {profile?.username && <p className="mt-0.5 text-sm font-medium text-vibe-muted">@{profile.username}</p>}

              {profile?.bio ? (
                <p className="mt-4 text-sm leading-6 text-vibe-text">{profile.bio}</p>
              ) : (
                <p className="mt-4 text-sm text-vibe-muted">{t('profile.identity.addBio')}</p>
              )}

              {profile?.created_at && (
                <p className="mt-4 text-xs text-vibe-muted">
                  {t('profile.identity.memberSince', {
                    date: formatMemberSince(profile.created_at, language)
                  })}
                </p>
              )}
            </>
          ) : (
            <>
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-bold text-vibe-petrol">{t('profile.identity.editTitle')}</p>

                  <p className="mt-1 text-xs text-vibe-muted">{t('profile.identity.editDescription')}</p>
                </div>

                <button
                  className="flex size-9 items-center justify-center rounded-full bg-vibe-bg text-vibe-muted active:scale-95"
                  type="button"
                  disabled={savingProfile}
                  onClick={cancelProfileEditing}>
                  <FiX />
                </button>
              </div>

              <div className="mt-5">
                <label className="text-xs font-semibold text-vibe-muted">{t('profile.identity.displayName')}</label>

                <input
                  className="mt-2 w-full rounded-2xl border border-vibe-petrol/10 bg-vibe-bg px-4 py-3 text-vibe-text outline-none transition focus:border-vibe-petrol/40"
                  value={displayName}
                  maxLength={40}
                  disabled={savingProfile}
                  onChange={(event) => {
                    setDisplayName(event.target.value)
                    setError('')
                  }}
                />
              </div>

              <div className="mt-4">
                <label className="text-xs font-semibold text-vibe-muted">{t('profile.identity.username')}</label>

                <div className="mt-2 flex items-center rounded-2xl border border-vibe-petrol/10 bg-vibe-bg focus-within:border-vibe-petrol/40">
                  <span className="pl-4 text-vibe-muted">@</span>

                  <input
                    className="min-w-0 flex-1 bg-transparent px-1 py-3 pr-4 text-vibe-text outline-none"
                    value={username}
                    maxLength={30}
                    autoCapitalize="none"
                    autoCorrect="off"
                    disabled={savingProfile}
                    onChange={(event) => {
                      setUsername(event.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))
                      setError('')
                    }}
                  />
                </div>

                <p className="mt-2 text-xs text-vibe-muted">{t('profile.identity.usernameHint')}</p>
              </div>

              <div className="mt-4">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-vibe-muted">{t('profile.identity.bio')}</label>

                  <span className="text-xs text-vibe-muted">{bio.length}/160</span>
                </div>

                <textarea
                  className="mt-2 min-h-28 w-full resize-none rounded-2xl border border-vibe-petrol/10 bg-vibe-bg px-4 py-3 text-sm leading-6 text-vibe-text outline-none transition placeholder:text-vibe-muted/50 focus:border-vibe-petrol/40"
                  placeholder={t('profile.identity.bioPlaceholder')}
                  value={bio}
                  maxLength={160}
                  disabled={savingProfile}
                  onChange={(event) => {
                    setBio(event.target.value)
                    setError('')
                  }}
                />
              </div>

              <button
                className="mt-5 flex w-full items-center justify-center gap-2 rounded-2xl bg-vibe-apricot px-5 py-3.5 font-bold text-vibe-text transition active:scale-[0.98] disabled:opacity-50"
                type="button"
                disabled={savingProfile}
                onClick={handleSaveProfile}>
                <FiCheck />
                {savingProfile ? t('profile.identity.saving') : t('profile.identity.save')}
              </button>
            </>
          )}
        </div>

        {/* Activity */}
        <div className="mt-6">
          <h3 className="font-black text-vibe-petrol">{t('profile.activity.title')}</h3>

          <div className="mt-3 grid grid-cols-2 gap-3">
            <div className="rounded-2xl bg-vibe-surface p-4">
              <p className="text-2xl font-black text-vibe-petrol">{statsLoading ? '—' : stats.vibes}</p>
              <p className="mt-1 text-xs font-semibold text-vibe-muted">{t('profile.activity.activeVibes')}</p>
            </div>

            <div className="rounded-2xl bg-vibe-surface p-4">
              <p className="text-2xl font-black text-vibe-petrol">{statsLoading ? '—' : stats.chats}</p>
              <p className="mt-1 text-xs font-semibold text-vibe-muted">{t('profile.activity.chats')}</p>
            </div>
          </div>
        </div>

        {/* Interests */}
        <div className="mt-7">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="font-black text-vibe-petrol">{t('profile.interests.title')}</h3>
              <p className="mt-1 text-xs text-vibe-muted">{t('profile.interests.description')}</p>
            </div>

            {!editingInterests && (
              <button
                className="rounded-full bg-vibe-surface px-4 py-2 text-xs font-bold text-vibe-petrol active:scale-95"
                type="button"
                onClick={startInterestEditing}>
                {t('common.edit')}
              </button>
            )}
          </div>

          {interestsLoading ? (
            <div className="mt-4">
              <div className="size-3 animate-pulse rounded-full bg-vibe-lime" />
            </div>
          ) : !editingInterests ? (
            <div className="mt-4 flex flex-wrap gap-2">
              {userInterests.length > 0 ? (
                userInterests.map((interest) => (
                  <span key={interest.id} className="rounded-full bg-vibe-petrol/10 px-3 py-2 text-sm font-semibold text-vibe-petrol">
                    {interest.name}
                  </span>
                ))
              ) : (
                <p className="text-sm text-vibe-muted">{t('profile.interests.none')}</p>
              )}
            </div>
          ) : (
            <div className="mt-4 rounded-3xl bg-vibe-surface p-4">
              <div className="flex items-center justify-between">
                <p className="text-sm font-bold text-vibe-text">{t('profile.interests.choose')}</p>

                <span className="text-xs font-semibold text-vibe-muted">
                  {selectedInterestIds.length}/{MAX_INTERESTS}
                </span>
              </div>

              {userInterests.length > 0 && (
                <div className="mt-4 flex flex-wrap gap-2">
                  {userInterests.map((interest) => {
                    const active = selectedInterestIds.includes(interest.id)

                    return (
                      <button
                        key={interest.id}
                        className={`rounded-full border px-3 py-2 text-sm font-semibold transition active:scale-95 ${
                          active
                            ? 'border-vibe-petrol bg-vibe-petrol text-vibe-surface'
                            : 'border-vibe-petrol/10 bg-vibe-bg text-vibe-muted'
                        }`}
                        type="button"
                        onClick={() => toggleInterest(interest.id)}>
                        {interest.name}
                      </button>
                    )
                  })}
                </div>
              )}

              {visibleInterests.length > 0 && (
                <>
                  <p className="mt-5 text-xs font-semibold uppercase tracking-[0.15em] text-vibe-muted">
                    {t('profile.interests.discoverMore')}
                  </p>

                  <div className="mt-3 flex flex-wrap gap-2">
                    {visibleInterests.map((interest) => {
                      const active = selectedInterestIds.includes(interest.id)

                      return (
                        <button
                          key={interest.id}
                          className={`rounded-full border px-3 py-2 text-sm font-semibold transition active:scale-95 ${
                            active
                              ? 'border-vibe-apricot bg-vibe-apricot text-vibe-text'
                              : 'border-vibe-petrol/10 bg-vibe-bg text-vibe-muted'
                          }`}
                          type="button"
                          disabled={!active && selectedInterestIds.length >= MAX_INTERESTS}
                          onClick={() => toggleInterest(interest.id)}>
                          {interest.name}
                        </button>
                      )
                    })}
                  </div>
                </>
              )}

              <div className="mt-5 flex gap-2">
                <input
                  className="min-w-0 flex-1 rounded-2xl border border-vibe-petrol/10 bg-vibe-bg px-4 py-3 text-sm text-vibe-text outline-none placeholder:text-vibe-muted/50 focus:border-vibe-petrol/40"
                  placeholder={t('profile.interests.createPlaceholder')}
                  value={customInterest}
                  maxLength={40}
                  disabled={creatingInterest || selectedInterestIds.length >= MAX_INTERESTS}
                  onChange={(event) => setCustomInterest(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key !== 'Enter') return

                    event.preventDefault()
                    handleCreateInterest()
                  }}
                />

                <button
                  className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-vibe-apricot text-xl text-vibe-text active:scale-95 disabled:opacity-30"
                  type="button"
                  disabled={customInterest.trim().length < 2 || creatingInterest || selectedInterestIds.length >= MAX_INTERESTS}
                  onClick={handleCreateInterest}>
                  <FiPlus />
                </button>
              </div>

              <div className="mt-5 flex gap-2">
                <button
                  className="flex-1 rounded-2xl border border-vibe-petrol/10 bg-vibe-bg px-4 py-3 text-sm font-semibold text-vibe-muted active:scale-[0.98]"
                  type="button"
                  disabled={savingInterests}
                  onClick={cancelInterestEditing}>
                  {t('common.cancel')}
                </button>

                <button
                  className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-vibe-apricot px-4 py-3 text-sm font-bold text-vibe-text active:scale-[0.98] disabled:opacity-50"
                  type="button"
                  disabled={savingInterests}
                  onClick={handleSaveInterests}>
                  <FiCheck />
                  {savingInterests ? t('common.saving') : t('common.save')}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Status messages */}
        {error && <p className="mt-5 text-center text-sm font-medium text-red-500">{error}</p>}

        {success && <p className="mt-5 text-center text-sm font-semibold text-vibe-petrol">{success}</p>}

        {/* Account */}
        <div className="mt-8">
          <h3 className="font-black text-vibe-petrol">{t('profile.account.title')}</h3>

          <div className="mt-3 rounded-3xl bg-vibe-surface p-2">
            <div className="flex items-center gap-3 px-3 py-3">
              <div className="flex size-10 items-center justify-center rounded-full bg-vibe-petrol/10 text-vibe-petrol">
                <FiUser />
              </div>

              <div>
                <p className="text-sm font-semibold text-vibe-text">{t('profile.account.publicIdentity')}</p>
                <p className="mt-0.5 text-xs text-vibe-muted">{t('profile.account.publicIdentityDescription')}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Logout */}
        <button
          className="mt-6 flex w-full items-center justify-center gap-2 rounded-2xl border border-vibe-petrol/15 bg-vibe-surface px-5 py-4 font-semibold text-vibe-text transition active:scale-[0.98]"
          type="button"
          onClick={signOut}>
          <FiLogOut />
          {t('profile.account.logout')}
        </button>
      </div>
    </div>
  )
}

export default Profile
