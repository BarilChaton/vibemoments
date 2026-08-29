export const prepareCameraStartup = async ({
  registerCaptureDevice,
  createCaptureSession,
  onCameraOpen,
  onDeviceReady,
  onSessionReady
}) => {
  /*
   * Opening the camera must happen immediately.
   * Security preparation continues afterwards.
   */
  onCameraOpen()

  const { identity } = await registerCaptureDevice()

  onDeviceReady?.(identity.deviceId)

  const session = await createCaptureSession('photo', identity.deviceId)

  onSessionReady?.(session)

  return {
    identity,
    session
  }
}
