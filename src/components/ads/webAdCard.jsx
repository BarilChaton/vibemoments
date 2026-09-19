import { useEffect, useRef, useState } from 'react'

const GPT_SCRIPT_URL = 'https://securepubads.g.doubleclick.net/tag/js/gpt.js'

// Google test inventory for development.
// Replace with your own VibeMoments ad unit later.
const TEST_AD_UNIT = '/6355419/Travel/Europe/France/Paris'

let gptPromise = null

const loadGooglePublisherTag = () => {
  if (window.googletag?.apiReady) {
    return Promise.resolve(window.googletag)
  }

  if (gptPromise) return gptPromise

  gptPromise = new Promise((resolve, reject) => {
    window.googletag = window.googletag || {
      cmd: []
    }

    const existingScript = document.querySelector(`script[src="${GPT_SCRIPT_URL}"]`)

    if (existingScript) {
      window.googletag.cmd.push(() => {
        resolve(window.googletag)
      })

      return
    }

    const script = document.createElement('script')

    script.src = GPT_SCRIPT_URL
    script.async = true
    script.crossOrigin = 'anonymous'

    script.onload = () => {
      window.googletag.cmd.push(() => {
        resolve(window.googletag)
      })
    }

    script.onerror = () => {
      gptPromise = null

      reject(new Error('Failed to load Google Publisher Tag'))
    }

    document.head.appendChild(script)
  })

  return gptPromise
}

const WebAdCard = ({ slotId }) => {
  const slotRef = useRef(null)
  const gptSlotRef = useRef(null)

  const [loaded, setLoaded] = useState(false)
  const [empty, setEmpty] = useState(false)
  const [renderedSize, setRenderedSize] = useState(null)

  const divId = `gpt-${slotId}`

  useEffect(() => {
    let cancelled = false
    let slotRenderHandler = null

    const setupAd = async () => {
      try {
        const googletag = await loadGooglePublisherTag()

        if (cancelled || !slotRef.current) {
          return
        }

        googletag.cmd.push(() => {
          if (cancelled) return

          const sizeMapping = googletag
            .sizeMapping()
            .addSize(
              [360, 0],
              [
                [320, 100],
                [320, 50],
                [300, 100],
                [300, 50]
              ]
            )
            .addSize(
              [0, 0],
              [
                [300, 100],
                [300, 50]
              ]
            )
            .build()

          const slot = googletag
            .defineSlot(
              TEST_AD_UNIT,
              [
                [320, 100],
                [320, 50],
                [300, 100],
                [300, 50]
              ],
              divId
            )
            ?.defineSizeMapping(sizeMapping)
            .addService(googletag.pubads())

          if (!slot) {
            setEmpty(true)
            return
          }

          gptSlotRef.current = slot

          slotRenderHandler = (event) => {
            if (event.slot !== slot) return

            if (event.isEmpty) {
              setEmpty(true)
              setLoaded(false)
              setRenderedSize(null)

              return
            }

            setEmpty(false)
            setLoaded(true)

            if (Array.isArray(event.size) && event.size.length === 2) {
              setRenderedSize({
                width: event.size[0],
                height: event.size[1]
              })
            }
          }

          googletag.pubads().addEventListener('slotRenderEnded', slotRenderHandler)

          if (!window.__vibeGptEnabled) {
            googletag.enableServices()

            window.__vibeGptEnabled = true
          }

          googletag.display(divId)
        })
      } catch (error) {
        console.error('Failed to load web ad:', error)

        if (!cancelled) {
          setEmpty(true)
        }
      }
    }

    setupAd()

    return () => {
      cancelled = true

      const googletag = window.googletag

      if (!googletag || !gptSlotRef.current) {
        return
      }

      googletag.cmd.push(() => {
        if (slotRenderHandler) {
          googletag.pubads().removeEventListener('slotRenderEnded', slotRenderHandler)
        }

        googletag.destroySlots([gptSlotRef.current])

        gptSlotRef.current = null
      })
    }
  }, [divId])

  if (empty) return null

  const adHeight = renderedSize?.height || 100

  return (
    <div ref={slotRef} className="col-span-2 overflow-hidden rounded-3xl bg-vibe-surface shadow-sm">
      <div className="px-3 pb-1 pt-2">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-vibe-muted">Sponsored</p>
      </div>

      <div
        className="relative flex w-full items-center justify-center overflow-hidden"
        style={{
          minHeight: `${adHeight}px`
        }}>
        {!loaded && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="size-3 animate-pulse rounded-full bg-vibe-lime" />
          </div>
        )}

        <div id={divId} className="flex w-full items-center justify-center" />
      </div>
    </div>
  )
}

export default WebAdCard
