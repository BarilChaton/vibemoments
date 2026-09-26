import { Capacitor } from '@capacitor/core'
import { Geolocation } from '@capacitor/geolocation'
import { PushNotifications } from '@capacitor/push-notifications'
import { Camera } from '@barilchaton/vibemoments-camera'

export const checkAppPermissions = async () => {
  if (!Capacitor.isNativePlatform()) {
    return {
      camera: 'granted',
      location: 'granted',
      notifications: 'granted'
    }
  }

  const [camera, location, notifications] = await Promise.all([
    Camera.checkPermissions(),
    Geolocation.checkPermissions(),
    PushNotifications.checkPermissions()
  ])

  return {
    camera: camera.camera,
    location: location.location === 'granted' || location.coarseLocation === 'granted' ? 'granted' : location.location,
    notifications: notifications.receive
  }
}

export const requestCameraPermission = async () => {
  return Camera.requestPermissions()
}

export const requestLocationPermission = async () => {
  return Geolocation.requestPermissions()
}

export const requestNotificationPermission = async () => {
  return PushNotifications.requestPermissions()
}
