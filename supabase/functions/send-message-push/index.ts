import { createClient } from 'jsr:@supabase/supabase-js@2'
import { SignJWT, importPKCS8 } from 'npm:jose'

type MessageRecord = {
  id: string
  conversation_id: string
  sender_id: string
  body: string
  created_at: string
}

type WebhookPayload = {
  type: 'INSERT'
  table: string
  schema: string
  record: MessageRecord
  old_record: null
}

// -----------------------------------------------------------------------------
// Google access token
// -----------------------------------------------------------------------------

const getGoogleAccessToken = async () => {
  const clientEmail = Deno.env.get('FIREBASE_CLIENT_EMAIL')
  const privateKey = Deno.env.get('FIREBASE_PRIVATE_KEY')

  if (!clientEmail || !privateKey) {
    throw new Error('Firebase credentials are missing.')
  }

  const formattedPrivateKey = privateKey.replace(/\\n/g, '\n')

  const key = await importPKCS8(formattedPrivateKey, 'RS256')

  const now = Math.floor(Date.now() / 1000)

  const jwt = await new SignJWT({
    scope: 'https://www.googleapis.com/auth/firebase.messaging'
  })
    .setProtectedHeader({
      alg: 'RS256',
      typ: 'JWT'
    })
    .setIssuer(clientEmail)
    .setSubject(clientEmail)
    .setAudience('https://oauth2.googleapis.com/token')
    .setIssuedAt(now)
    .setExpirationTime(now + 3600)
    .sign(key)

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt
    })
  })

  if (!response.ok) {
    const body = await response.text()

    throw new Error(`Failed to obtain Google access token: ${body}`)
  }

  const data = await response.json()

  return data.access_token as string
}

// -----------------------------------------------------------------------------
// Function
// -----------------------------------------------------------------------------

Deno.serve(async (req) => {
  try {
    const payload = (await req.json()) as WebhookPayload
    const message = payload.record

    if (!message?.conversation_id || !message?.sender_id) {
      return Response.json(
        {
          error: 'Invalid webhook payload'
        },
        {
          status: 400
        }
      )
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // -------------------------------------------------------------------------
    // Find conversation
    // -------------------------------------------------------------------------

    const { data: conversation, error: conversationError } = await supabase
      .from('conversations')
      .select('id, user_a_id, user_b_id')
      .eq('id', message.conversation_id)
      .single()

    if (conversationError) throw conversationError

    const recipientId =
      conversation.user_a_id === message.sender_id
        ? conversation.user_b_id
        : conversation.user_a_id

    // -------------------------------------------------------------------------
    // Find sender
    // -------------------------------------------------------------------------

    const { data: sender, error: senderError } = await supabase
      .from('profiles')
      .select('display_name')
      .eq('id', message.sender_id)
      .single()

    if (senderError) throw senderError

    // -------------------------------------------------------------------------
    // Find recipient push tokens
    // -------------------------------------------------------------------------

    const { data: pushTokens, error: pushTokensError } = await supabase
      .from('push_tokens')
      .select('token')
      .eq('user_id', recipientId)

    if (pushTokensError) throw pushTokensError

    if (!pushTokens?.length) {
      return Response.json({
        sent: 0,
        reason: 'Recipient has no push tokens.'
      })
    }

    // -------------------------------------------------------------------------
    // Send FCM notifications
    // -------------------------------------------------------------------------

    const projectId = Deno.env.get('FIREBASE_PROJECT_ID')

    if (!projectId) {
      throw new Error('FIREBASE_PROJECT_ID is missing.')
    }

    const accessToken = await getGoogleAccessToken()

    const results = await Promise.all(
      pushTokens.map(async ({ token }) => {
        const response = await fetch(
          `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`,
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${accessToken}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              message: {
                token,

                notification: {
                  title: sender.display_name || 'VibeMoments',
                  body: message.body
                },

                data: {
                  type: 'message',
                  conversationId: message.conversation_id,
                  senderId: message.sender_id
                },

                android: {
                  priority: 'high'
                }
              }
            })
          }
        )

        const responseBody = await response.text()

        // -----------------------------------------------------------------------
        // Successful delivery
        // -----------------------------------------------------------------------

        if (response.ok) {
          return {
            success: true,
            status: response.status,
            tokenRemoved: false
          }
        }

        // -----------------------------------------------------------------------
        // Parse Firebase error
        // -----------------------------------------------------------------------

        let firebaseError = null

        try {
          firebaseError = JSON.parse(responseBody)
        } catch {
          console.error('Could not parse FCM error response:', responseBody)
        }

        const errorStatus = firebaseError?.error?.status

        const fcmError = firebaseError?.error?.details?.find(
          (detail: { '@type'?: string; errorCode?: string }) =>
            detail['@type'] === 'type.googleapis.com/google.firebase.fcm.v1.FcmError'
        )

        const errorCode = fcmError?.errorCode

        // -----------------------------------------------------------------------
        // Remove invalid token
        // -----------------------------------------------------------------------

        const invalidToken =
          errorStatus === 'UNREGISTERED' ||
          errorCode === 'UNREGISTERED'

        if (invalidToken) {
          console.log('Removing invalid FCM token.')

          const { error: deleteError } = await supabase
            .from('push_tokens')
            .delete()
            .eq('token', token)

          if (deleteError) {
            console.error('Failed to remove invalid FCM token:', deleteError)
          }

          return {
            success: false,
            status: response.status,
            tokenRemoved: !deleteError,
            errorCode
          }
        }

        // -----------------------------------------------------------------------
        // Other FCM error
        // -----------------------------------------------------------------------

        console.error('FCM send failed:', firebaseError || responseBody)

        return {
          success: false,
          status: response.status,
          tokenRemoved: false,
          errorCode: errorCode || errorStatus || 'UNKNOWN'
        }
      })
    )

    return Response.json({
      sent: results.filter((result) => result.success).length,
      attempted: results.length,
      removedTokens: results.filter((result) => result.tokenRemoved).length,
      results
    })
  } catch (error) {
    console.error('Push notification failed:', error)

    return Response.json(
      {
        error: error instanceof Error ? error.message : String(error)
      },
      {
        status: 500
      }
    )
  }
})