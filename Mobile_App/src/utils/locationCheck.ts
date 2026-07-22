import * as Location from 'expo-location';

export interface DeviceLocation {
  latitude: number;
  longitude: number;
  accuracyM: number | null;
}

/**
 * Device's current GPS position, sent to the server so it can check it
 * against the agency's geofence. Never blocks clock-in: returns null if
 * permission is denied, location services are off, or the read fails.
 */
export async function getDeviceLocation(): Promise<DeviceLocation | null> {
  try {
    const { status } = await Location.getForegroundPermissionsAsync();
    if (status !== Location.PermissionStatus.GRANTED) {
      const { status: requested } = await Location.requestForegroundPermissionsAsync();
      if (requested !== Location.PermissionStatus.GRANTED) return null;
    }

    const position = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    });
    return {
      latitude: position.coords.latitude,
      longitude: position.coords.longitude,
      accuracyM: position.coords.accuracy,
    };
  } catch {
    return null;
  }
}

/**
 * Reads GPS position only if the app already has background ("Always")
 * location permission — never prompts for it. Used as a bonus signal for
 * auto clock-in/out background checks: WiFi is the primary signal, this
 * only supplements it when the employee has already opted into background
 * location for some other reason.
 */
export async function getBackgroundLocationIfAvailable(): Promise<DeviceLocation | null> {
  try {
    const { status } = await Location.getBackgroundPermissionsAsync();
    if (status !== Location.PermissionStatus.GRANTED) return null;

    const position = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    });
    return {
      latitude: position.coords.latitude,
      longitude: position.coords.longitude,
      accuracyM: position.coords.accuracy,
    };
  } catch {
    return null;
  }
}

/** Great-circle distance in meters (haversine). */
export function distanceMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6_371_000;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}
