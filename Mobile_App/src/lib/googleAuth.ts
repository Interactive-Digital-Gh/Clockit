// Native Google Sign-In → Google ID token. The token is exchanged for our own
// JWT via POST /auth/google/employee (see attendanceService.googleSignInEmployee).
import { GoogleSignin } from '@react-native-google-signin/google-signin';

const WEB_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;
const IOS_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID;

export const googleConfigured = !!(WEB_CLIENT_ID && IOS_CLIENT_ID);

let configured = false;
function ensureConfigured() {
  if (configured) return;
  GoogleSignin.configure({
    webClientId: WEB_CLIENT_ID,
    iosClientId: IOS_CLIENT_ID,
  });
  configured = true;
}

export interface GoogleIdentity {
  idToken: string;
  email: string;
  name: string;
}

/**
 * Runs the native Google Sign-In flow. Returns null if the user cancelled;
 * throws on real errors.
 */
export async function googleSignIn(): Promise<GoogleIdentity | null> {
  ensureConfigured();
  await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
  const response = await GoogleSignin.signIn();
  if (response.type === 'cancelled') return null;
  const { idToken, user } = response.data;
  if (!idToken) throw new Error('Google did not return an ID token.');
  return { idToken, email: user.email, name: user.name ?? '' };
}
