export function validateCaptureProof({ media, captureSession }) {
  if (!media) {
    return {
      valid: false,
      reason: 'MISSING_MEDIA'
    }
  }

  if (!captureSession) {
    return {
      valid: false,
      reason: 'MISSING_CAPTURE_SESSION'
    }
  }

  if (!media.captureSessionId) {
    return {
      valid: false,
      reason: 'MISSING_CAPTURE_SESSION_ID'
    }
  }

  if (!media.nonce) {
    return {
      valid: false,
      reason: 'MISSING_NONCE'
    }
  }

  if (!media.sha256) {
    return {
      valid: false,
      reason: 'MISSING_SHA256'
    }
  }

  if (media.captureSessionId !== captureSession.captureSessionId) {
    return {
      valid: false,
      reason: 'CAPTURE_SESSION_MISMATCH'
    }
  }

  if (media.nonce !== captureSession.nonce) {
    return {
      valid: false,
      reason: 'NONCE_MISMATCH'
    }
  }

  return {
    valid: true,
    reason: null
  }
}
