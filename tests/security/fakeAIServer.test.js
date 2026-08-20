import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createClient } from '@supabase/supabase-js'
import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { loadEnv } from 'vite'
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

const fakeAiImagePath = fileURLToPath(new URL('../fixtures/fake-ai-image.jpg', import.meta.url))

const sha256 = (bytes) => {
  return createHash('sha256').update(bytes).digest('hex')
}

const readFunctionError = async (result) => {
  if (result.data) return result.data

  if (result.error?.context) {
    try {
      return await result.error.context.json()
    } catch {
      return null
    }
  }

  return null
}

describe('AI generated media server security', () => {
  let user
  let device

  const uploadedPaths = []

  beforeAll(async () => {
    // -----------------------------------------------------------------------
    // Authenticate dedicated security-test user
    // -----------------------------------------------------------------------

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

    // -----------------------------------------------------------------------
    // Create cryptographic test device
    // -----------------------------------------------------------------------

    device = createTestCaptureDevice()

    const identity = device.getIdentity()

    console.log('Security test device:', identity.deviceId)

    // -----------------------------------------------------------------------
    // Register public key with Supabase
    // -----------------------------------------------------------------------

    const registration = await supabase.functions.invoke('register-capture-device', {
      body: identity
    })

    if (registration.error) {
      throw registration.error
    }

    expect(registration.data?.registered).toBe(true)
  })

  afterAll(async () => {
    if (uploadedPaths.length > 0) {
      const { error } = await supabase.storage.from('vibes').remove(uploadedPaths)

      if (error) {
        console.warn('Could not clean up AI security test media:', error.message)
      }
    }

    await supabase.auth.signOut()
  })

  // -------------------------------------------------------------------------
  // Attack 1
  //
  // AI image + legitimate session, but attacker cannot create an authentic
  // capture signature.
  // -------------------------------------------------------------------------

  it('rejects an AI generated image without an authentic camera signature', async () => {
    const identity = device.getIdentity()

    // -----------------------------------------------------------------------
    // Obtain legitimate server-issued capture session
    // -----------------------------------------------------------------------

    const sessionResponse = await supabase.functions.invoke('create-capture-session', {
      body: {
        mediaType: 'photo',
        deviceId: identity.deviceId
      }
    })

    if (sessionResponse.error) {
      throw sessionResponse.error
    }

    const session = sessionResponse.data

    expect(session?.captureSessionId).toBeTruthy()
    expect(session?.nonce).toBeTruthy()

    // -----------------------------------------------------------------------
    // Load actual AI generated fixture
    // -----------------------------------------------------------------------

    const aiBytes = await readFile(fakeAiImagePath)
    const aiSha256 = sha256(aiBytes)

    console.log('Fake AI image SHA-256:', aiSha256)

    // -----------------------------------------------------------------------
    // Upload AI image
    // -----------------------------------------------------------------------

    const storagePath = `${user.id}/security-tests/${crypto.randomUUID()}/fake-ai.jpg`

    uploadedPaths.push(storagePath)

    const aiBlob = new Blob([aiBytes], {
      type: 'image/jpeg'
    })

    const { error: uploadError } = await supabase.storage.from('vibes').upload(storagePath, aiBlob, {
      contentType: 'image/jpeg',
      upsert: false
    })

    if (uploadError) {
      throw new Error(`Could not upload fake AI image: ${uploadError.message}`)
    }

    // -----------------------------------------------------------------------
    // Attacker knows everything except the private signing key.
    //
    // They therefore invent a fake signature.
    // -----------------------------------------------------------------------

    const forgedProof = {
      captureSessionId: session.captureSessionId,
      nonce: session.nonce,
      mediaType: 'photo',
      mediaSha256: aiSha256,

      deviceId: identity.deviceId,

      captureSignature: Buffer.from('this-is-not-a-real-camera-signature').toString('base64'),

      proofVersion: 'vibemoments-capture-v1',
      signatureAlgorithm: 'ECDSA_P256_SHA256',

      storagePath
    }

    // -----------------------------------------------------------------------
    // Attack server
    // -----------------------------------------------------------------------

    const result = await supabase.functions.invoke('verify-capture-proof', {
      body: forgedProof
    })

    const response = await readFunctionError(result)

    console.log('Forged AI capture response:', response)

    // -----------------------------------------------------------------------
    // Must be rejected
    // -----------------------------------------------------------------------

    expect(result.error).not.toBeNull()

    expect(response?.valid).toBe(false)

    expect(response?.code).toBe('INVALID_CAPTURE_SIGNATURE')
  })

  // -------------------------------------------------------------------------
  // Attack 2
  //
  // Attacker possesses a REAL valid signature for some captured bytes,
  // but substitutes an AI generated image afterward.
  // -------------------------------------------------------------------------

  it('rejects an AI image substituted after a valid capture was signed', async () => {
    const identity = device.getIdentity()

    // -----------------------------------------------------------------------
    // Obtain fresh legitimate capture session
    // -----------------------------------------------------------------------

    const sessionResponse = await supabase.functions.invoke('create-capture-session', {
      body: {
        mediaType: 'photo',
        deviceId: identity.deviceId
      }
    })

    if (sessionResponse.error) {
      throw sessionResponse.error
    }

    const session = sessionResponse.data

    expect(session?.captureSessionId).toBeTruthy()
    expect(session?.nonce).toBeTruthy()

    // -----------------------------------------------------------------------
    // Simulate bytes originally produced by VibeCamera
    //
    // They deliberately differ from our AI-generated image.
    // -----------------------------------------------------------------------

    const legitimateCameraBytes = Buffer.from(
      ['VibeMoments legitimate camera capture fixture', session.captureSessionId, crypto.randomUUID()].join(':'),
      'utf8'
    )

    // -----------------------------------------------------------------------
    // Let our test VibeCamera device genuinely sign those original bytes
    // -----------------------------------------------------------------------

    const legitimateProof = device.createProof({
      captureSessionId: session.captureSessionId,
      nonce: session.nonce,
      mediaType: 'photo',
      mediaBytes: legitimateCameraBytes
    })

    console.log('Legitimate signed SHA-256:', legitimateProof.mediaSha256)

    // -----------------------------------------------------------------------
    // Attacker swaps the captured file for the AI-generated image
    // -----------------------------------------------------------------------

    const aiBytes = await readFile(fakeAiImagePath)

    const aiSha256 = sha256(aiBytes)

    console.log('Substituted AI image SHA-256:', aiSha256)

    expect(aiSha256).not.toBe(legitimateProof.mediaSha256)

    // -----------------------------------------------------------------------
    // Upload the substituted AI image
    // -----------------------------------------------------------------------

    const storagePath = `${user.id}/security-tests/${crypto.randomUUID()}/substituted-ai.jpg`

    uploadedPaths.push(storagePath)

    const aiBlob = new Blob([aiBytes], {
      type: 'image/jpeg'
    })

    const { error: uploadError } = await supabase.storage.from('vibes').upload(storagePath, aiBlob, {
      contentType: 'image/jpeg',
      upsert: false
    })

    if (uploadError) {
      throw new Error(`Could not upload substituted AI image: ${uploadError.message}`)
    }

    // -----------------------------------------------------------------------
    // Submit REAL signature/proof...
    //
    // ...but point the server at DIFFERENT uploaded bytes.
    // -----------------------------------------------------------------------

    const substitutedProof = {
      ...legitimateProof,
      storagePath
    }

    const result = await supabase.functions.invoke('verify-capture-proof', {
      body: substitutedProof
    })

    const response = await readFunctionError(result)

    console.log('Post-capture substitution response:', response)

    // -----------------------------------------------------------------------
    // Server hashes actual uploaded AI image.
    //
    // That hash differs from the hash covered by the legitimate signature.
    // -----------------------------------------------------------------------

    expect(result.error).not.toBeNull()

    expect(response?.valid).toBe(false)

    expect(response?.code).toBe('MEDIA_HASH_MISMATCH')
  })
})
