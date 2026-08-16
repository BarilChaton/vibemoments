const LINK_REGEX = /((?:https?:\/\/|www\.)[^\s]+)/gi

// -----------------------------------------------------------------------------
// Message time
// -----------------------------------------------------------------------------

export const formatMessageTime = (createdAt) => {
  return new Intl.DateTimeFormat(undefined, {
    hour: '2-digit',
    minute: '2-digit'
  }).format(new Date(createdAt))
}

// -----------------------------------------------------------------------------
// Message body
// -----------------------------------------------------------------------------

export const renderMessageBody = (body) => {
  const parts = body.split(LINK_REGEX)

  return parts.map((part, index) => {
    if (!part.match(LINK_REGEX)) {
      return part
    }

    const href = part.toLowerCase().startsWith('www.') ? `https://${part}` : part

    return (
      <a
        key={`${part}-${index}`}
        className="break-all underline underline-offset-2"
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        onClick={(event) => event.stopPropagation()}>
        {part}
      </a>
    )
  })
}
