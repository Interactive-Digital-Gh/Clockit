import * as LocalAuthentication from 'expo-local-authentication';

/**
 * Biometric identity check before clock-in: the person holding the phone must
 * pass Face ID / fingerprint (device passcode as fallback) so a colleague
 * can't clock in on someone else's behalf with a borrowed phone.
 *
 * Devices that can't verify (no biometric hardware, nothing enrolled) pass
 * through rather than block — the QR scan + server-side network/GPS
 * classification still apply, and locking those employees out of clock-in
 * entirely would be worse than the marginal risk.
 */
export async function confirmIdentityForClockIn(): Promise<boolean> {
  try {
    const hasHardware = await LocalAuthentication.hasHardwareAsync();
    if (!hasHardware) return true;

    const enrolled = await LocalAuthentication.isEnrolledAsync();
    if (!enrolled) return true;

    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: 'Confirm it’s you to clock in',
      fallbackLabel: 'Use passcode',
      cancelLabel: 'Cancel',
      disableDeviceFallback: false,
    });
    return result.success;
  } catch {
    // Treat unexpected auth-layer errors as "couldn't verify", not "verified".
    return false;
  }
}
