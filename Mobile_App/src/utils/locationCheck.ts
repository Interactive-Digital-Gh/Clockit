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
