export interface ClockLocation {
  latitude?: number | null
  longitude?: number | null
  location_accuracy_m?: number | null
}

/** Best-effort GPS read — never blocks clock-in. Resolves to {} on denial,
 * timeout, or an unsupported browser. Shared by /dashboard/me and /scan. */
export function getLocation(): Promise<ClockLocation> {
  return new Promise((resolve) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      resolve({})
      return
    }
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        resolve({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          location_accuracy_m: pos.coords.accuracy,
        }),
      () => resolve({}),
      { timeout: 5000, maximumAge: 60_000 },
    )
  })
}
