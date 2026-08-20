import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: corsHeaders
    })
  }

  if (req.method !== 'POST') {
    return jsonResponse(
      {
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
      console.error('Unable to authenticate capture session request:', userError)

      return jsonResponse(
        {
          error: 'Invalid authorization'
        },
        401
      )
    }

    // -------------------------------------------------------------------------
    // Request body
    // -------------------------------------------------------------------------

    let body: {
      mediaType?: string
      deviceId?: string
    }

    try {
      body = await req.json()
    } catch {
      return jsonResponse(
        {
          error: 'Invalid JSON body'
        },
        400
      )
    }

    const mediaType = body.mediaType?.trim()
    const deviceId = body.deviceId?.trim()

    if (mediaType !== 'photo' && mediaType !== 'video') {
      return jsonResponse(
        {
          error: 'mediaType must be photo or video'
        },
        400
      )
    }

    if (!deviceId) {
      return jsonResponse(
        {
          error: 'Missing deviceId'
        },
        400
      )
    }

    if (deviceId.length > 128) {
      return jsonResponse(
        {
          error: 'Invalid deviceId'
        },
        400
      )
    }

    // -------------------------------------------------------------------------
    // Service-role client
    // -------------------------------------------------------------------------

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false
      }
    })

    // -------------------------------------------------------------------------
    // Verify registered capture device
    // -------------------------------------------------------------------------

    const { data: captureDevice, error: deviceError } = await adminClient
      .from('capture_devices')
      .select('id, device_id, algorithm, proof_version, revoked_at')
      .eq('user_id', user.id)
      .eq('device_id', deviceId)
      .maybeSingle()

    if (deviceError) {
      console.error('Unable to verify capture device:', deviceError)

      return jsonResponse(
        {
          error: 'Could not verify capture device'
        },
        500
      )
    }

    if (!captureDevice) {
      console.warn(`Unregistered capture device: user=${user.id} device=${deviceId}`)

      return jsonResponse(
        {
          error: 'Capture device is not registered',
          code: 'DEVICE_NOT_REGISTERED'
        },
        403
      )
    }

    if (captureDevice.revoked_at) {
      console.warn(`Revoked capture device attempted capture: user=${user.id} device=${deviceId}`)

      return jsonResponse(
        {
          error: 'Capture device has been revoked',
          code: 'DEVICE_REVOKED'
        },
        403
      )
    }

    if (captureDevice.algorithm !== 'ECDSA_P256_SHA256') {
      return jsonResponse(
        {
          error: 'Capture device uses an unsupported signature algorithm',
          code: 'UNSUPPORTED_DEVICE_ALGORITHM'
        },
        403
      )
    }

    if (captureDevice.proof_version !== 'vibemoments-capture-v1') {
      return jsonResponse(
        {
          error: 'Capture device uses an unsupported proof version',
          code: 'UNSUPPORTED_PROOF_VERSION'
        },
        403
      )
    }

    // -------------------------------------------------------------------------
    // Generate cryptographically secure nonce
    // -------------------------------------------------------------------------

    const nonceBytes = new Uint8Array(32)

    crypto.getRandomValues(nonceBytes)

    const nonce = Array.from(nonceBytes)
      .map((byte) => byte.toString(16).padStart(2, '0'))
      .join('')

    /*
     * Keep the capture window deliberately short.
     *
     * A new session should be used immediately for a camera capture rather
     * than being stored and reused later.
     */
    const expiresAt = new Date(Date.now() + 2 * 60 * 1000).toISOString()

    // -------------------------------------------------------------------------
    // Create capture session
    // -------------------------------------------------------------------------

    const { data: captureSession, error: insertError } = await adminClient
      .from('capture_sessions')
      .insert({
        user_id: user.id,
        device_id: deviceId,
        nonce,
        media_type: mediaType,
        status: 'pending',
        expires_at: expiresAt
      })
      .select('id, device_id, nonce, media_type, expires_at')
      .single()

    if (insertError) {
      console.error('Failed to create capture session:', insertError)

      return jsonResponse(
        {
          error: 'Could not create capture session'
        },
        500
      )
    }

    // -------------------------------------------------------------------------
    // Update device activity
    // -------------------------------------------------------------------------

    const { error: updateDeviceError } = await adminClient
      .from('capture_devices')
      .update({
        last_seen_at: new Date().toISOString()
      })
      .eq('id', captureDevice.id)

    if (updateDeviceError) {
      /*
       * Don't fail an otherwise valid capture session merely because updating
       * this informational timestamp failed.
       */
      console.warn('Unable to update capture device last_seen_at:', updateDeviceError)
    }

    console.log(
      `Capture session created: user=${user.id} device=${deviceId} session=${captureSession.id} type=${mediaType}`
    )

    return jsonResponse({
      captureSessionId: captureSession.id,
      deviceId: captureSession.device_id,
      nonce: captureSession.nonce,
      mediaType: captureSession.media_type,
      expiresAt: captureSession.expires_at
    })
  } catch (error) {
    console.error('create-capture-session failed:', error)

    return jsonResponse(
      {
        error: 'Could not create capture session'
      },
      500
    )
  }
})