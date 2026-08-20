import { Camera } from '@barilchaton/vibemoments-camera'
import { supabase } from './supabase.js'

export const registerCaptureDevice = async () => {
  const identity = await Camera.getCaptureIdentity()

  if (!identity?.deviceId) {
    throw new Error('VibeCamera did not return a device ID.')
  }

  if (!identity?.publicKey) {
    throw new Error('VibeCamera did not return a capture public key.')
  }

  const { data, error } = await supabase.functions.invoke('register-capture-device', {
    body: {
      deviceId: identity.deviceId,
      publicKey: identity.publicKey,
      algorithm: identity.algorithm,
      proofVersion: identity.proofVersion
    }
  })

  if (error) {
    console.error('Capture device registration failed:', error)

    throw error
  }

  if (!data?.registered) {
    throw new Error('Capture device could not be registered.')
  }

  return {
    identity,
    registration: data
  }
}

export const verifyCaptureProof = async ({
  captureSessionId,
  nonce,
  mediaType,
  mediaSha256,
  deviceId,
  captureSignature,
  proofVersion,
  signatureAlgorithm,
  storagePath
}) => {
  const { data, error } = await supabase.functions.invoke('verify-capture-proof', {
    body: {
      captureSessionId,
      nonce,
      mediaType,
      mediaSha256,
      deviceId,
      captureSignature,
      proofVersion,
      signatureAlgorithm,
      storagePath
    }
  })

  if (error) {
    throw error
  }

  if (!data?.valid) {
    throw new Error(data?.error || 'Capture proof could not be verified.')
  }

  return data
}
