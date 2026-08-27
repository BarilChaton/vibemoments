import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const CAPTURE_PROOF_VERSION = 'vibemoments-capture-v1'
const SIGNATURE_ALGORITHM = 'ECDSA_P256_SHA256'
const STORAGE_BUCKET = 'vibes'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
}

const jsonResponse = (body: unknown, status = 200) => {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json'
    }
  })
}

// -----------------------------------------------------------------------------
// Encoding helpers
// -----------------------------------------------------------------------------

const base64ToBytes = (value: string) => {
  const binary = atob(value)

  return Uint8Array.from(binary, (character) => character.charCodeAt(0))
}

const bytesToHex = (bytes: Uint8Array) => {
  return Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
}

// -----------------------------------------------------------------------------
// ECDSA signature conversion
// -----------------------------------------------------------------------------

/*
 * Android's:
 *
 * Signature.getInstance("SHA256withECDSA")
 *
 * produces an ASN.1 DER encoded ECDSA signature.
 *
 * WebCrypto expects the P-256 signature as:
 *
 * r || s
 *
 * where r and s are each 32 bytes.
 */
const derEcdsaToRaw = (der: Uint8Array) => {
  let offset = 0

  if (der[offset++] !== 0x30) {
    throw new Error('Invalid ECDSA DER signature')
  }

  let sequenceLength = der[offset++]

  if (sequenceLength & 0x80) {
    const lengthBytes = sequenceLength & 0x7f

    sequenceLength = 0

    for (let i = 0; i < lengthBytes; i++) {
      sequenceLength = (sequenceLength << 8) | der[offset++]
    }
  }

  if (der[offset++] !== 0x02) {
    throw new Error('Invalid ECDSA signature R value')
  }

  const rLength = der[offset++]
  let r = der.slice(offset, offset + rLength)

  offset += rLength

  if (der[offset++] !== 0x02) {
    throw new Error('Invalid ECDSA signature S value')
  }

  const sLength = der[offset++]
  let s = der.slice(offset, offset + sLength)

  /*
   * ASN.1 integers may include a leading 0x00 byte to keep the integer
   * positive. Remove that before constructing the fixed-width P-256 value.
   */
  while (r.length > 32 && r[0] === 0) {
    r = r.slice(1)
  }

  while (s.length > 32 && s[0] === 0) {
    s = s.slice(1)
  }

  if (r.length > 32 || s.length > 32) {
    throw new Error('Invalid ECDSA signature size')
  }

  const raw = new Uint8Array(64)

  raw.set(r, 32 - r.length)
  raw.set(s, 64 - s.length)

  return raw
}

// -----------------------------------------------------------------------------
// SHA-256
// -----------------------------------------------------------------------------

const sha256 = async (bytes: ArrayBuffer) => {
  const digest = await crypto.subtle.digest('SHA-256', bytes)

  return bytesToHex(new Uint8Array(digest))
}

// -----------------------------------------------------------------------------
// Capture payload
// -----------------------------------------------------------------------------

const createCapturePayload = ({
  captureSessionId,
  nonce,
  mediaType,
  mediaSha256,
  deviceId
}: {
  captureSessionId: string
  nonce: string
  mediaType: string
  mediaSha256: string
  deviceId: string
}) => {
  /*
   * MUST exactly match CaptureSigner.kt:
   *
   * listOf(
   *   PROOF_VERSION,
   *   captureSessionId,
   *   nonce,
   *   mediaType,
   *   sha256.lowercase(),
   *   deviceId
   * ).joinToString("\n")
   */
  return [
    CAPTURE_PROOF_VERSION,
    captureSessionId,
    nonce,
    mediaType,
    mediaSha256.toLowerCase(),
    deviceId
  ].join('\n')
}

// -----------------------------------------------------------------------------
// Function
// -----------------------------------------------------------------------------

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: corsHeaders
    })
  }

  if (req.method !== 'POST') {
    return jsonResponse(
      {
        valid: false,
        error: 'Method not allowed'
      },
      405
    )
  }

  try {
    // -------------------------------------------------------------------------
    // Environment
    // -------------------------------------------------------------------------

    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

    if (!supabaseUrl || !supabaseAnonKey || !serviceRoleKey) {
      console.error('Missing required Supabase environment variables')

      return jsonResponse(
        {
          valid: false,
          error: 'Server configuration error'
        },
        500
      )
    }

    // -------------------------------------------------------------------------
    // Authentication
    // -------------------------------------------------------------------------

    const authorization = req.headers.get('Authorization')

    if (!authorization) {
      return jsonResponse(
        {
          valid: false,
          error: 'Missing authorization'
        },
        401
      )
    }

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: {
          Authorization: authorization
        }
      }
    })

    const {
      data: { user },
      error: userError
    } = await userClient.auth.getUser()

    if (userError || !user) {
      return jsonResponse(
        {
          valid: false,
          error: 'Invalid authorization'
        },
        401
      )
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false
      }
    })

    // -------------------------------------------------------------------------
    // Request
    // -------------------------------------------------------------------------

    let body: {
      captureSessionId?: string
      nonce?: string
      mediaType?: string
      mediaSha256?: string
      deviceId?: string
      captureSignature?: string
      proofVersion?: string
      signatureAlgorithm?: string
      storagePath?: string
    }

    try {
      body = await req.json()
    } catch {
      return jsonResponse(
        {
          valid: false,
          error: 'Invalid JSON body'
        },
        400
      )
    }

    const captureSessionId = body.captureSessionId?.trim()
    const nonce = body.nonce?.trim()
    const mediaType = body.mediaType?.trim()
    const mediaSha256 = body.mediaSha256?.trim().toLowerCase()
    const deviceId = body.deviceId?.trim()
    const captureSignature = body.captureSignature?.trim()
    const proofVersion = body.proofVersion?.trim()
    const signatureAlgorithm = body.signatureAlgorithm?.trim()
    const storagePath = body.storagePath?.trim()

    if (
      !captureSessionId ||
      !nonce ||
      !mediaType ||
      !mediaSha256 ||
      !deviceId ||
      !captureSignature ||
      !proofVersion ||
      !signatureAlgorithm ||
      !storagePath
    ) {
      return jsonResponse(
        {
          valid: false,
          error: 'Missing capture proof fields',
          code: 'INCOMPLETE_CAPTURE_PROOF'
        },
        400
      )
    }

    if (mediaType !== 'photo' && mediaType !== 'video') {
      return jsonResponse(
        {
          valid: false,
          error: 'Invalid media type',
          code: 'INVALID_MEDIA_TYPE'
        },
        400
      )
    }

    if (!/^[a-f0-9]{64}$/.test(mediaSha256)) {
      return jsonResponse(
        {
          valid: false,
          error: 'Invalid SHA-256 fingerprint',
          code: 'INVALID_SHA256'
        },
        400
      )
    }

    if (proofVersion !== CAPTURE_PROOF_VERSION) {
      return jsonResponse(
        {
          valid: false,
          error: 'Unsupported capture proof version',
          code: 'UNSUPPORTED_PROOF_VERSION'
        },
        400
      )
    }

    if (signatureAlgorithm !== SIGNATURE_ALGORITHM) {
      return jsonResponse(
        {
          valid: false,
          error: 'Unsupported signature algorithm',
          code: 'UNSUPPORTED_SIGNATURE_ALGORITHM'
        },
        400
      )
    }

    // -------------------------------------------------------------------------
    // Capture session
    // -------------------------------------------------------------------------

    const { data: session, error: sessionError } = await adminClient
      .from('capture_sessions')
      .select('id, user_id, device_id, nonce, media_type, status, expires_at, consumed_at')
      .eq('id', captureSessionId)
      .eq('user_id', user.id)
      .maybeSingle()

    if (sessionError) {
      console.error('Unable to load capture session:', sessionError)

      return jsonResponse(
        {
          valid: false,
          error: 'Could not verify capture session'
        },
        500
      )
    }

    if (!session) {
      return jsonResponse(
        {
          valid: false,
          error: 'Capture session not found',
          code: 'CAPTURE_SESSION_NOT_FOUND'
        },
        403
      )
    }

    if (session.status !== 'pending') {
      return jsonResponse(
        {
          valid: false,
          error: 'Capture session has already been used',
          code: 'CAPTURE_SESSION_ALREADY_USED'
        },
        403
      )
    }

    if (session.consumed_at) {
      return jsonResponse(
        {
          valid: false,
          error: 'Capture session has already been consumed',
          code: 'CAPTURE_SESSION_ALREADY_USED'
        },
        403
      )
    }

    if (new Date(session.expires_at).getTime() <= Date.now()) {
      return jsonResponse(
        {
          valid: false,
          error: 'Capture session has expired',
          code: 'CAPTURE_SESSION_EXPIRED'
        },
        403
      )
    }

    if (session.device_id !== deviceId) {
      return jsonResponse(
        {
          valid: false,
          error: 'Capture device does not match capture session',
          code: 'CAPTURE_DEVICE_MISMATCH'
        },
        403
      )
    }

    if (session.nonce !== nonce) {
      return jsonResponse(
        {
          valid: false,
          error: 'Capture nonce does not match',
          code: 'CAPTURE_NONCE_MISMATCH'
        },
        403
      )
    }

    if (session.media_type !== mediaType) {
      return jsonResponse(
        {
          valid: false,
          error: 'Capture media type does not match',
          code: 'CAPTURE_MEDIA_TYPE_MISMATCH'
        },
        403
      )
    }

    // -------------------------------------------------------------------------
    // Registered device
    // -------------------------------------------------------------------------

    const { data: device, error: deviceError } = await adminClient
      .from('capture_devices')
      .select('device_id, public_key, algorithm, proof_version, revoked_at')
      .eq('user_id', user.id)
      .eq('device_id', deviceId)
      .maybeSingle()

    if (deviceError) {
      console.error('Unable to load capture device:', deviceError)

      return jsonResponse(
        {
          valid: false,
          error: 'Could not verify capture device'
        },
        500
      )
    }

    if (!device) {
      return jsonResponse(
        {
          valid: false,
          error: 'Capture device is not registered',
          code: 'DEVICE_NOT_REGISTERED'
        },
        403
      )
    }

    if (device.revoked_at) {
      return jsonResponse(
        {
          valid: false,
          error: 'Capture device has been revoked',
          code: 'DEVICE_REVOKED'
        },
        403
      )
    }

    if (
      device.algorithm !== SIGNATURE_ALGORITHM ||
      device.proof_version !== CAPTURE_PROOF_VERSION
    ) {
      return jsonResponse(
        {
          valid: false,
          error: 'Capture device cryptographic configuration does not match',
          code: 'DEVICE_CRYPTO_MISMATCH'
        },
        403
      )
    }

    // -------------------------------------------------------------------------
    // Download actual uploaded media
    // -------------------------------------------------------------------------

    const { data: mediaBlob, error: downloadError } = await adminClient.storage
      .from(STORAGE_BUCKET)
      .download(storagePath)

    if (downloadError || !mediaBlob) {
      console.error('Unable to download capture media:', downloadError)

      return jsonResponse(
        {
          valid: false,
          error: 'Could not read uploaded capture media',
          code: 'MEDIA_NOT_FOUND'
        },
        400
      )
    }

    const mediaBytes = await mediaBlob.arrayBuffer()

    // -------------------------------------------------------------------------
    // Hash actual uploaded bytes
    // -------------------------------------------------------------------------

    const serverSha256 = await sha256(mediaBytes)

    if (serverSha256 !== mediaSha256) {
      console.warn(
        `Capture media hash mismatch: session=${captureSessionId}`
      )

      return jsonResponse(
        {
          valid: false,
          error: 'Uploaded media does not match captured media',
          code: 'MEDIA_HASH_MISMATCH'
        },
        403
      )
    }

    // -------------------------------------------------------------------------
    // Build canonical signed payload
    // -------------------------------------------------------------------------

    const capturePayload = createCapturePayload({
      captureSessionId,
      nonce,
      mediaType,
      mediaSha256,
      deviceId
    })

    // -------------------------------------------------------------------------
    // Import registered public key
    // -------------------------------------------------------------------------

    const publicKeyBytes = base64ToBytes(device.public_key)

    let publicKey: CryptoKey

    try {
      publicKey = await crypto.subtle.importKey(
        'spki',
        publicKeyBytes,
        {
          name: 'ECDSA',
          namedCurve: 'P-256'
        },
        false,
        ['verify']
      )
    } catch (error) {
      console.error('Unable to import capture public key:', error)

      return jsonResponse(
        {
          valid: false,
          error: 'Capture device public key is invalid',
          code: 'INVALID_DEVICE_PUBLIC_KEY'
        },
        500
      )
    }

    // -------------------------------------------------------------------------
    // Verify native Android signature
    // -------------------------------------------------------------------------

    let signatureBytes: Uint8Array

    try {
      const derSignature = base64ToBytes(captureSignature)

      signatureBytes = derEcdsaToRaw(derSignature)
    } catch (error) {
      console.warn('Malformed capture signature:', error)

      return jsonResponse(
        {
          valid: false,
          error: 'Capture signature is malformed',
          code: 'INVALID_CAPTURE_SIGNATURE'
        },
        403
      )
    }

    const payloadBytes = new TextEncoder().encode(capturePayload)

    const signatureValid = await crypto.subtle.verify(
      {
        name: 'ECDSA',
        hash: 'SHA-256'
      },
      publicKey,
      signatureBytes,
      payloadBytes
    )

    if (!signatureValid) {
      console.warn(
        `Invalid capture signature: user=${user.id} device=${deviceId} session=${captureSessionId}`
      )

      return jsonResponse(
        {
          valid: false,
          error: 'Capture signature could not be verified',
          code: 'INVALID_CAPTURE_SIGNATURE'
        },
        403
      )
    }

    // -------------------------------------------------------------------------
    // Atomically consume capture session
    // -------------------------------------------------------------------------

    const { data: consumed, error: consumeError } = await adminClient.rpc(
      'consume_capture_session',
      {
        p_session_id: captureSessionId,
        p_user_id: user.id,
        p_device_id: deviceId,
        p_nonce: nonce,
        p_media_type: mediaType
      }
    )

    if (consumeError) {
      console.error('Unable to consume capture session:', consumeError)

      return jsonResponse(
        {
          valid: false,
          error: 'Could not consume capture session',
          code: 'CAPTURE_SESSION_CONSUME_FAILED'
        },
        500
      )
    }

    if (consumed !== true) {
      console.warn(
        `Capture session replay prevented: user=${user.id} device=${deviceId} session=${captureSessionId}`
      )

      return jsonResponse(
        {
          valid: false,
          error: 'Capture session has already been used or expired',
          code: 'CAPTURE_SESSION_ALREADY_USED'
        },
        409
      )
    }

    // -------------------------------------------------------------------------
    // Success
    // -------------------------------------------------------------------------

    return jsonResponse({
      valid: true,
      captureSessionId,
      deviceId,
      mediaType,
      sha256: serverSha256
    })
  } catch (error) {
    console.error('verify-capture-proof failed:', error)

    return jsonResponse(
      {
        valid: false,
        error: 'Could not verify capture proof'
      },
      500
    )
  }
})