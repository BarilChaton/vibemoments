const GifMessage = ({ message, onLoad }) => {
  const url = message.media_url || message.media_preview_url

  if (!url) return null

  return (
    <div className="max-w-full overflow-hidden rounded-2xl bg-vibe-surface">
      <img className="block max-h-72 w-full object-cover" src={url} alt="GIF" loading="lazy" onLoad={onLoad} />
    </div>
  )
}

export default GifMessage
