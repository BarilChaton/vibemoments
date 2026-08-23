import { FiMapPin, FiPlus, FiX } from 'react-icons/fi'
import { MAX_VIDEO_DURATION } from '../../utils/vibeMedia.js'

const VibeComposer = ({
  media,
  caption,
  publishing,
  error,
  userInterests,
  otherInterests,
  selectedInterests,
  customInterest,
  creatingInterest,
  maxInterests,
  onCaptionChange,
  onCustomInterestChange,
  onCreateInterest,
  onToggleInterest,
  onRemoveMedia,
  onPublish
}) => {
  return (
    <div className="flex flex-1 flex-col">
      <header className="flex items-center justify-between px-6 pb-4 pt-5">
        <div>
          <p className="text-sm font-semibold text-vibe-apricot-dark">{media.type === 'video' ? 'NEW VIDEO VIBE' : 'NEW VIBE'}</p>

          <h1 className="mt-1 text-3xl font-black text-vibe-petrol">Looking good?</h1>
        </div>

        <button
          className="flex size-10 items-center justify-center rounded-full bg-vibe-surface text-vibe-muted transition active:scale-95"
          type="button"
          disabled={publishing}
          onClick={onRemoveMedia}>
          <FiX className="text-xl" />
        </button>
      </header>

      <div className="flex-1 overflow-y-auto px-6 pb-6">
        {/* Media preview */}
        <div className="relative overflow-hidden rounded-3xl bg-black">
          {media.type === 'photo' && <img className="aspect-4/5 w-full object-cover" src={media.webPath} alt="Your Vibe" />}

          {media.type === 'video' && (
            <>
              {media.thumbnailUrl && <img className="absolute inset-0 h-full w-full object-cover" src={media.thumbnailUrl} alt="" />}

              <video
                className="relative aspect-4/5 w-full object-cover"
                src={media.webPath}
                poster={media.thumbnailUrl || undefined}
                autoPlay
                loop
                playsInline
                preload="auto"
                controls
              />

              <div className="pointer-events-none absolute right-3 top-3 rounded-full bg-black/50 px-3 py-1.5 text-xs font-semibold text-white backdrop-blur-md">
                {Math.min(media.duration || 0, MAX_VIDEO_DURATION).toFixed(1)}s
              </div>
            </>
          )}
        </div>

        {/* Caption */}
        <div className="mt-5">
          <textarea
            className="min-h-24 w-full resize-none rounded-2xl border border-vibe-petrol/10 bg-vibe-surface px-4 py-4 text-vibe-text outline-none transition placeholder:text-vibe-muted/60 focus:border-vibe-petrol/40"
            placeholder="What's happening?"
            value={caption}
            maxLength={280}
            disabled={publishing}
            onChange={(event) => onCaptionChange(event.target.value)}
          />

          <div className="mt-2 flex justify-end">
            <span className="text-xs text-vibe-muted">{caption.length}/280</span>
          </div>
        </div>

        {/* Location */}
        <div className="mt-4 flex items-center gap-3 rounded-2xl bg-vibe-surface px-4 py-4">
          <div className="flex size-10 items-center justify-center rounded-full bg-vibe-lime/20">
            <FiMapPin className="text-lg text-vibe-petrol" />
          </div>

          <div>
            <p className="text-sm font-semibold text-vibe-text">General area only</p>

            <p className="mt-0.5 text-xs text-vibe-muted">Only the district and city are shown. Your exact location remains private.</p>
          </div>
        </div>

        {/* Interests */}
        <div className="mt-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-bold text-vibe-text">Add interests</h3>

              <p className="mt-1 text-xs text-vibe-muted">Choose existing interests or create one if it's missing.</p>
            </div>

            <span className="text-xs font-semibold text-vibe-muted">
              {selectedInterests.length}/{maxInterests}
            </span>
          </div>

          {/* Custom interest */}
          <div className="mt-5 flex gap-2">
            <input
              className="min-w-0 flex-1 rounded-2xl border border-vibe-petrol/15 bg-vibe-surface px-4 py-3 text-sm text-vibe-text outline-none transition placeholder:text-vibe-muted/60 focus:border-vibe-apricot"
              type="text"
              placeholder="Add another interest..."
              value={customInterest}
              maxLength={40}
              disabled={creatingInterest || selectedInterests.length >= maxInterests}
              onChange={(event) => onCustomInterestChange(event.target.value)}
              onKeyDown={(event) => {
                if (event.key !== 'Enter') return

                event.preventDefault()
                onCreateInterest()
              }}
            />

            <button
              className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-vibe-apricot text-xl text-vibe-text transition active:scale-95 disabled:opacity-30"
              type="button"
              disabled={customInterest.trim().length < 2 || creatingInterest || selectedInterests.length >= maxInterests}
              onClick={onCreateInterest}>
              <FiPlus />
            </button>
          </div>

          {/* User interests */}
          {userInterests.length > 0 && (
            <div className="mt-5">
              <p className="mb-3 text-xs font-semibold uppercase tracking-[0.15em] text-vibe-apricot-dark">Your interests</p>

              <div className="flex flex-wrap gap-2">
                {userInterests.map((interest) => {
                  const active = selectedInterests.includes(interest.id)

                  return (
                    <button
                      key={interest.id}
                      className={`rounded-full border px-3 py-2 text-sm font-semibold transition active:scale-95 ${
                        active
                          ? 'border-vibe-petrol bg-vibe-petrol text-vibe-surface'
                          : 'border-vibe-petrol/15 bg-vibe-surface text-vibe-muted hover:border-vibe-petrol/40'
                      }`}
                      type="button"
                      disabled={!active && selectedInterests.length >= maxInterests}
                      onClick={() => onToggleInterest(interest.id)}>
                      {interest.name}
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {/* Other interests */}
          {otherInterests.length > 0 && (
            <div className="mt-6">
              <p className="mb-3 text-xs font-semibold uppercase tracking-[0.15em] text-vibe-muted">Discover more</p>

              <div className="flex flex-wrap gap-2">
                {otherInterests.map((interest) => {
                  const active = selectedInterests.includes(interest.id)

                  return (
                    <button
                      key={interest.id}
                      className={`rounded-full border px-3 py-2 text-sm font-semibold transition active:scale-95 ${
                        active
                          ? 'border-vibe-apricot bg-vibe-apricot text-vibe-text'
                          : 'border-vibe-petrol/15 bg-vibe-surface text-vibe-muted hover:border-vibe-apricot/60'
                      }`}
                      type="button"
                      disabled={!active && selectedInterests.length >= maxInterests}
                      onClick={() => onToggleInterest(interest.id)}>
                      {interest.name}
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {selectedInterests.length >= maxInterests && (
            <p className="mt-3 text-xs text-vibe-muted">You can attach up to {maxInterests} interests to a Vibe.</p>
          )}
        </div>

        {error && <p className="mt-5 text-sm font-medium text-red-500">{error}</p>}
      </div>

      {/* Publish */}
      <div className="border-t border-vibe-petrol/10 bg-vibe-bg px-6 pb-[calc(env(safe-area-inset-bottom)+1rem)] pt-4">
        <button
          className="w-full rounded-2xl bg-vibe-apricot px-5 py-4 font-bold text-vibe-text shadow-lg shadow-vibe-apricot/20 transition active:scale-[0.98] disabled:opacity-50"
          type="button"
          disabled={publishing}
          onClick={onPublish}>
          {publishing ? 'Sharing Vibe...' : 'Share Vibe'}
        </button>
      </div>
    </div>
  )
}

export default VibeComposer
