const Home = () => {
  return (
    <div className="flex flex-1 flex-col">
      <header className="safe-top px-6 pb-4 pt-5">
        <p className="text-sm font-semibold text-vibe-apricot-dark">RIGHT NOW</p>
        <h1 className="mt-1 text-3xl font-black text-vibe-petrol">Nearby Vibes</h1>
        <p className="mt-1 text-sm text-vibe-muted">See what's happening around you.</p>
      </header>

      <div className="flex flex-1 items-center justify-center px-6 text-center">
        <div>
          <div className="mx-auto mb-5 size-3 rounded-full bg-vibe-lime shadow-lg shadow-vibe-lime/30" />
          <h2 className="text-xl font-bold text-vibe-text">Nothing nearby yet</h2>
          <p className="mx-auto mt-2 max-w-xs text-sm leading-6 text-vibe-muted">When people around you post Vibes, they'll appear here.</p>
        </div>
      </div>
    </div>
  )
}

export default Home
