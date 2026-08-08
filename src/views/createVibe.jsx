import { FiCamera, FiVideo } from 'react-icons/fi'

const CreateVibe = () => {
  return (
    <div className="flex flex-1 flex-col">
      <header className="safe-top px-6 pb-4 pt-5">
        <p className="text-sm font-semibold text-vibe-apricot-dark">CAPTURE THE MOMENT</p>
        <h1 className="mt-1 text-3xl font-black text-vibe-petrol">Create a Vibe</h1>
      </header>

      <div className="flex flex-1 flex-col justify-center gap-4 px-6">
        <button
          className="flex items-center gap-4 rounded-3xl bg-vibe-apricot p-6 text-left text-vibe-text shadow-lg shadow-vibe-apricot/15 active:scale-[0.98]"
          type="button">
          <FiCamera className="text-3xl" />

          <div>
            <p className="text-lg font-bold">Take a photo</p>
            <p className="mt-1 text-sm opacity-70">Share what's happening right now.</p>
          </div>
        </button>

        <button
          className="flex items-center gap-4 rounded-3xl bg-vibe-petrol p-6 text-left text-vibe-surface shadow-lg shadow-vibe-petrol/15 active:scale-[0.98]"
          type="button">
          <FiVideo className="text-3xl" />

          <div>
            <p className="text-lg font-bold">Record a Vibe</p>
            <p className="mt-1 text-sm opacity-70">Capture up to 10 seconds.</p>
          </div>
        </button>
      </div>
    </div>
  )
}

export default CreateVibe
