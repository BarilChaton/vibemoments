import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createClient } from '@supabase/supabase-js'
import { loadEnv } from 'vite'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { createTestCaptureDevice } from './helpers/testCaptureDevice.js'

const env = loadEnv('test', process.cwd(), '')

const supabaseUrl = env.TEST_SUPABASE_URL
const supabaseAnonKey = env.TEST_SUPABASE_ANON_KEY
const testEmail = env.TEST_SECURITY_EMAIL
const testPassword = env.TEST_SECURITY_PASSWORD

if (!supabaseUrl) throw new Error('TEST_SUPABASE_URL is missing.')
if (!supabaseAnonKey) throw new Error('TEST_SUPABASE_ANON_KEY is missing.')
if (!testEmail) throw new Error('TEST_SECURITY_EMAIL is missing.')
if (!testPassword) throw new Error('TEST_SECURITY_PASSWORD is missing.')

const supabase = createClient(supabaseUrl, supabaseAnonKey)

const fakeImagePath = fileURLToPath(new URL('../fixtures/fake-ai-image.jpg', import.meta.url))

describe('Capture replay protection', () => {
  let user
  let storagePath

  beforeAll(async () => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: testEmail,
      password: testPassword
    })

    if (error) {
      throw new Error(`Could not authenticate security test user: ${error.message}`)
    }

    if (!data.user) {
      throw new Error('Security test user was not returned.')
    }

    user = data.user

    console.log('Authenticated security test user:', user.id)
  })

  afterAll(async () => {
    if (storagePath) {
      const { error } = await supabase.storage.from('vibes').remove([storagePath])

      if (error) {
        console.warn('Could not clean up replay test media:', error.message)
      }
    }

    await supabase.auth.signOut()
  })

  it('rejects a capture proof after the session has already been consumed', async () => {
    // -------------------------------------------------------------------------
    // Create fake cryptographic capture device
    // -------------------------------------------------------------------------

    const device = createTestCaptureDevice()
    const identity = device.getIdentity()

    console.log('Test capture device:', identity.deviceId)

    // -------------------------------------------------------------------------
    // Register device
    // -------------------------------------------------------------------------

    const registration = await supabase.functions.invoke('register-capture-device', {
      body: identity
    })

    if (registration.error) {
      console.error('Device registration response:', registration.error)

      throw registration.error
    }

    expect(registration.data?.registered).toBe(true)

    // -------------------------------------------------------------------------
    // Create fresh capture session
    // -------------------------------------------------------------------------

    const sessionResponse = await supabase.functions.invoke('create-capture-session', {
      body: {
        mediaType: 'photo',
        deviceId: identity.deviceId
      }
    })

    if (sessionResponse.error) {
      console.error('Capture session response:', sessionResponse.error)

      throw sessionResponse.error
    }

    const session = sessionResponse.data

    expect(session?.captureSessionId).toBeTruthy()
    expect(session?.nonce).toBeTruthy()

    console.log('Capture session:', session.captureSessionId)

    // -------------------------------------------------------------------------
    // Load our synthetic image
    // -------------------------------------------------------------------------

    const imageBytes = await readFile(fakeImagePath)

    // -------------------------------------------------------------------------
    // Create a valid cryptographic proof
    // -------------------------------------------------------------------------

    const proof = device.createProof({
      captureSessionId: session.captureSessionId,
      nonce: session.nonce,
      mediaType: 'photo',
      mediaBytes: imageBytes
    })

    // -------------------------------------------------------------------------
    // Upload exact bytes that were signed
    // -------------------------------------------------------------------------

    storagePath = `${user.id}/security-tests/${crypto.randomUUID()}/original.jpg`

    const imageBlob = new Blob([imageBytes], {
      type: 'image/jpeg'
    })

    const { error: uploadError } = await supabase.storage.from('vibes').upload(storagePath, imageBlob, {
      contentType: 'image/jpeg',
      upsert: false
    })

    if (uploadError) {
      throw new Error(`Could not upload security fixture: ${uploadError.message}`)
    }

    // -------------------------------------------------------------------------
    // First verification
    // -------------------------------------------------------------------------

    const requestBody = {
      ...proof,
      storagePath
    }

    const first = await supabase.functions.invoke('verify-capture-proof', {
      body: requestBody
    })

    console.log('First verification:', first.data)

    if (first.error) {
      console.error('First verification error:', first.error)

      throw first.error
    }

    expect(first.data?.valid).toBe(true)

    // -------------------------------------------------------------------------
    // Replay exact same signed capture
    // -------------------------------------------------------------------------

    const second = await supabase.functions.invoke('verify-capture-proof', {
      body: requestBody
    })

    let replayBody = second.data

    /*
     * Supabase returns non-2xx Edge Function responses as FunctionsHttpError.
     * Read the actual JSON response so we can assert the security error code.
     */
    if (second.error?.context) {
      try {
        replayBody = await second.error.context.json()
      } catch {
        replayBody = null
      }
    }

    console.log('Replay verification:', replayBody)

    expect(second.error).not.toBeNull()

    expect(replayBody?.valid).toBe(false)

    expect(replayBody?.code).toBe('CAPTURE_SESSION_ALREADY_USED')
  })
})
