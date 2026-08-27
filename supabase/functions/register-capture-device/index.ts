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
    // Authorization
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
      console.error('Unable to authenticate capture device registration:', userError)

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
      deviceId?: string
      publicKey?: string
      algorithm?: string
      proofVersion?: string
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

    const deviceId = body.deviceId?.trim()
    const publicKey = body.publicKey?.trim()
    const algorithm = body.algorithm?.trim()
    const proofVersion = body.proofVersion?.trim()

    // -------------------------------------------------------------------------
    // Validation
    // -------------------------------------------------------------------------

    if (!deviceId) {
      return jsonResponse(
        {
          error: 'Missing deviceId'
        },
        400
      )
    }

    if (!publicKey) {
      return jsonResponse(
        {
          error: 'Missing publicKey'
        },
        400
      )
    }

    if (algorithm !== 'ECDSA_P256_SHA256') {
      return jsonResponse(
        {
          error: 'Unsupported capture signature algorithm'
        },
        400
      )
    }

    if (proofVersion !== 'vibemoments-capture-v1') {
      return jsonResponse(
        {
          error: 'Unsupported capture proof version'
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

    /*
     * X.509 SubjectPublicKeyInfo encoded P-256 public keys are relatively
     * small. This upper bound prevents somebody from submitting enormous
     * arbitrary payloads as a "public key".
     */
    if (publicKey.length < 50 || publicKey.length > 2048) {
      return jsonResponse(
        {
          error: 'Invalid public key'
        },
        400
      )
    }

    // -------------------------------------------------------------------------
    // Service-role database client
    // -------------------------------------------------------------------------

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false
      }
    })

    // -------------------------------------------------------------------------
    // Check existing device
    // -------------------------------------------------------------------------

    const { data: existingDevice, error: existingDeviceError } = await adminClient
      .from('capture_devices')
      .select('id, public_key, revoked_at')
      .eq('user_id', user.id)
      .eq('device_id', deviceId)
      .maybeSingle()

    if (existingDeviceError) {
      console.error('Unable to check capture device:', existingDeviceError)

      return jsonResponse(
        {
          error: 'Could not register capture device'
        },
        500
      )
    }

    // -------------------------------------------------------------------------
    // Existing device
    // -------------------------------------------------------------------------

    if (existingDevice) {
      if (existingDevice.revoked_at) {
        return jsonResponse(
          {
            error: 'Capture device has been revoked',
            code: 'DEVICE_REVOKED'
          },
          403
        )
      }

      /*
       * A device ID must not silently change cryptographic identities.
       *
       * If Android's private key changes, we want an explicit new registration
       * flow instead of allowing arbitrary key replacement.
       */
      if (existingDevice.public_key !== publicKey) {
        console.warn(
          `Capture device key mismatch for user=${user.id} device=${deviceId}`
        )

        return jsonResponse(
          {
            error: 'Capture device key does not match registered key',
            code: 'DEVICE_KEY_MISMATCH'
          },
          409
        )
      }

      const { error: updateError } = await adminClient
        .from('capture_devices')
        .update({
          last_seen_at: new Date().toISOString()
        })
        .eq('id', existingDevice.id)

      if (updateError) {
        console.error('Unable to update capture device:', updateError)

        return jsonResponse(
          {
            error: 'Could not update capture device'
          },
          500
        )
      }

      return jsonResponse({
        registered: true,
        existing: true,
        deviceId
      })
    }

    // -------------------------------------------------------------------------
    // New device
    // -------------------------------------------------------------------------

    const { data: registeredDevice, error: insertError } = await adminClient
      .from('capture_devices')
      .insert({
        user_id: user.id,
        device_id: deviceId,
        public_key: publicKey,
        algorithm,
        proof_version: proofVersion
      })
      .select('id, device_id, created_at')
      .single()

    if (insertError) {
      console.error('Unable to register capture device:', insertError)

      return jsonResponse(
        {
          error: 'Could not register capture device'
        },
        500
      )
    }

    return jsonResponse(
      {
        registered: true,
        existing: false,
        deviceId: registeredDevice.device_id,
        registeredAt: registeredDevice.created_at
      },
      201
    )
  } catch (error) {
    console.error('register-capture-device failed:', error)

    return jsonResponse(
      {
        error: 'Could not register capture device'
      },
      500
    )
  }
})