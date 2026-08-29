import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { prepareCameraStartup } from '../../src/services/cameraStartup.js'

describe('Camera startup performance', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('opens the camera immediately without waiting for secure capture preparation', async () => {
    const events = []

    const registerCaptureDevice = vi.fn(
      () =>
        new Promise((resolve) => {
          setTimeout(() => {
            events.push({
              event: 'device-ready',
              time: Date.now()
            })

            resolve({
              identity: {
                deviceId: 'test-device'
              }
            })
          }, 500)
        })
    )

    const createCaptureSession = vi.fn(
      () =>
        new Promise((resolve) => {
          setTimeout(() => {
            events.push({
              event: 'session-ready',
              time: Date.now()
            })

            resolve({
              captureSessionId: 'test-session',
              nonce: 'test-nonce'
            })
          }, 700)
        })
    )

    const onCameraOpen = vi.fn(() => {
      events.push({
        event: 'camera-open',
        time: Date.now()
      })
    })

    const onDeviceReady = vi.fn()
    const onSessionReady = vi.fn()

    const startedAt = Date.now()

    const startupPromise = prepareCameraStartup({
      registerCaptureDevice,
      createCaptureSession,
      onCameraOpen,
      onDeviceReady,
      onSessionReady
    })

    /*
     * Camera should open synchronously, before either of the simulated
     * security/network operations has completed.
     */
    expect(onCameraOpen).toHaveBeenCalledTimes(1)
    expect(registerCaptureDevice).toHaveBeenCalledTimes(1)

    const cameraOpenTime = events.find((event) => event.event === 'camera-open').time - startedAt

    expect(cameraOpenTime).toBe(0)

    /*
     * After 499 ms the device registration should still not be complete.
     */
    await vi.advanceTimersByTimeAsync(499)

    expect(onDeviceReady).not.toHaveBeenCalled()
    expect(createCaptureSession).not.toHaveBeenCalled()

    /*
     * At 500 ms the device identity becomes available.
     */
    await vi.advanceTimersByTimeAsync(1)

    expect(onDeviceReady).toHaveBeenCalledWith('test-device')
    expect(createCaptureSession).toHaveBeenCalledTimes(1)

    /*
     * Capture session takes another 700 ms.
     */
    await vi.advanceTimersByTimeAsync(699)

    expect(onSessionReady).not.toHaveBeenCalled()

    await vi.advanceTimersByTimeAsync(1)

    const result = await startupPromise

    expect(onSessionReady).toHaveBeenCalledWith({
      captureSessionId: 'test-session',
      nonce: 'test-nonce'
    })

    expect(result.session.captureSessionId).toBe('test-session')

    const sessionReadyTime = events.find((event) => event.event === 'session-ready').time - startedAt

    console.log('')
    console.log('Camera startup timing:')
    console.log(`Camera opened:      ${cameraOpenTime} ms`)
    console.log(`Security completed: ${sessionReadyTime} ms`)
    console.log(`Time saved:         ${sessionReadyTime - cameraOpenTime} ms`)
    console.log('')

    expect(sessionReadyTime).toBe(1200)

    /*
     * Main regression assertion:
     *
     * The camera must become visible before secure capture preparation
     * finishes.
     */
    expect(cameraOpenTime).toBeLessThan(sessionReadyTime)
  })
})
