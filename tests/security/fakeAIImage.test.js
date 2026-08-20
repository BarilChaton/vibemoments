import { describe, expect, it } from 'vitest'
import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { validateCaptureProof } from '../../src/utils/captureProof.js'

const fakeAiImagePath = fileURLToPath(new URL('../fixtures/fake-ai-image.jpg', import.meta.url))

describe('Synthetic media security', () => {
  it('rejects an arbitrary image that bypassed VibeCamera', () => {
    const fakeAiImage = {
      type: 'photo',
      path: '/attacker/generated-image.jpg',
      mimeType: 'image/jpeg'
    }

    const captureSession = {
      captureSessionId: 'test-session-123',
      nonce: 'test-nonce-456'
    }

    const result = validateCaptureProof({
      media: fakeAiImage,
      captureSession
    })

    expect(result.valid).toBe(false)
    expect(result.reason).toBe('MISSING_CAPTURE_SESSION_ID')
  })

  it('demonstrates that a smart attacker can forge the current client-side proof', async () => {
    const imageBytes = await readFile(fakeAiImagePath)

    const sha256 = createHash('sha256').update(imageBytes).digest('hex')

    const captureSession = {
      captureSessionId: 'test-session-attack-2',
      nonce: 'valid-looking-server-nonce'
    }

    const forgedAiCapture = {
      type: 'photo',
      path: fakeAiImagePath,
      mimeType: 'image/jpeg',

      captureSessionId: captureSession.captureSessionId,
      nonce: captureSession.nonce,

      // The attacker calculates the real hash of the AI image.
      sha256
    }

    const result = validateCaptureProof({
      media: forgedAiCapture,
      captureSession
    })

    console.log('Attack #2 fake AI image SHA-256:', sha256)
    console.log('Attack #2 validation result:', result)

    expect(sha256).toMatch(/^[a-f0-9]{64}$/)

    // This SHOULD currently be true.
    //
    // That demonstrates the weakness:
    // our current validator only checks whether the supplied values agree.
    // It cannot prove VibeCamera actually generated them.
    expect(result.valid).toBe(true)
  })
})
