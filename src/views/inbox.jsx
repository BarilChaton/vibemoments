import { FiMessageCircle } from 'react-icons/fi'

const Inbox = () => {
  return (
    <div className="flex flex-1 flex-col">
      <header className="safe-top px-6 pb-4 pt-5">
        <p className="text-sm font-semibold text-vibe-apricot-dark">MESSAGES</p>
        <h1 className="mt-1 text-3xl font-black text-vibe-petrol">Inbox</h1>
        <p className="mt-1 text-sm text-vibe-muted">Chat with friends and people you've connected with.</p>
      </header>

      <div className="flex flex-1 items-center justify-center px-6 text-center">
        <div>
          <div className="mx-auto flex size-20 items-center justify-center rounded-full bg-vibe-surface">
            <FiMessageCircle className="text-3xl text-vibe-petrol" />
          </div>

          <h2 className="mt-5 text-xl font-bold text-vibe-text">No messages yet</h2>
          <p className="mx-auto mt-2 max-w-xs text-sm leading-6 text-vibe-muted">Your conversations will appear here.</p>
        </div>
      </div>
    </div>
  )
}

export default Inbox
