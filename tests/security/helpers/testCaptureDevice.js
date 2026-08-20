import { createHash, generateKeyPairSync, sign } from 'node:crypto'

const PROOF_VERSION = 'vibemoments-capture-v1'
const SIGNATURE_ALGORITHM = 'ECDSA_P256_SHA256'

const toBase64Spki = (publicKey) => {
  const der = publicKey.export({
    type: 'spki',
    format: 'der'
  })

  return der.toString('base64')
}

const createPayload = ({ captureSessionId, nonce, mediaType, sha256, deviceId }) => {
  return [PROOF_VERSION, captureSessionId, nonce, mediaType, sha256.toLowerCase(), deviceId].join('\n')
}

export const createTestCaptureDevice = () => {
  const { publicKey, privateKey } = generateKeyPairSync('ec', {
    namedCurve: 'prime256v1'
  })

  const deviceId = crypto.randomUUID()
  const publicKeyBase64 = toBase64Spki(publicKey)

  const getIdentity = () => {
    return {
      deviceId,
      publicKey: publicKeyBase64,
      algorithm: SIGNATURE_ALGORITHM,
      proofVersion: PROOF_VERSION
    }
  }

  const hashBytes = (bytes) => {
    return createHash('sha256').update(bytes).digest('hex')
  }

  const signCapture = ({ captureSessionId, nonce, mediaType, sha256 }) => {
    const payload = createPayload({
      captureSessionId,
      nonce,
      mediaType,
      sha256,
      deviceId
    })

    const signature = sign('sha256', Buffer.from(payload, 'utf8'), {
      key: privateKey,
      dsaEncoding: 'der'
    })

    return {
      captureSignature: signature.toString('base64'),
      deviceId,
      proofVersion: PROOF_VERSION,
      signatureAlgorithm: SIGNATURE_ALGORITHM
    }
  }

  const createProof = ({ captureSessionId, nonce, mediaType, mediaBytes }) => {
    const sha256 = hashBytes(mediaBytes)

    const signed = signCapture({
      captureSessionId,
      nonce,
      mediaType,
      sha256
    })

    return {
      captureSessionId,
      nonce,
      mediaType,
      mediaSha256: sha256,
      deviceId: signed.deviceId,
      captureSignature: signed.captureSignature,
      proofVersion: signed.proofVersion,
      signatureAlgorithm: signed.signatureAlgorithm
    }
  }

  return {
    deviceId,
    getIdentity,
    hashBytes,
    signCapture,
    createProof
  }
}
