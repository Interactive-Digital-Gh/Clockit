import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  ScrollView, KeyboardAvoidingView, Platform, Dimensions,
  ActivityIndicator, Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { HugeiconsIcon } from '@hugeicons/react-native';
import Svg, { Path } from 'react-native-svg';
import { StatusBar } from 'expo-status-bar';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { RootStackParamList } from '../navigation/AppNavigator';
import { useApp } from '../context/AppContext';
import { googleSignInEmployee } from '../services/attendanceService';
import { googleConfigured } from '../lib/googleAuth';
import { EmployeeRecord } from '../services/attendanceService';

type NavProp = NativeStackNavigationProp<RootStackParamList>;
const { height: SCREEN_H } = Dimensions.get('window');
const HERO_H = SCREEN_H * 0.57;

function GoogleColorIcon({ size = 28 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 48 48">
      <Path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
      <Path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
      <Path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
      <Path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    </Svg>
  );
}

function getInitials(name: string): string {
  return name.split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2);
}

export default function LoginScreen() {
  const nav = useNavigation<NavProp>();
  const insets = useSafeAreaInsets();
  const { signUp } = useApp();
  const [loading, setLoading] = useState(false);

  // Shared post-login routing: established accounts go straight in,
  // brand-new ones collect name/department first.
  const enterApp = async (emp: EmployeeRecord, fallbackEmail: string, googleName = '') => {
    const established = !!(emp.emp_id || emp.job_title || emp.agency_id);
    if (established) {
      await signUp({
        id: emp.id,
        agencyId: emp.agency_id,
        name: emp.name,
        email: emp.email ?? fallbackEmail,
        department: emp.job_title ?? '',
        initials: getInitials(emp.name),
      });
    } else {
      nav.navigate('SignUp', { googleName, googleEmail: emp.email ?? fallbackEmail });
    }
  };

  const handleGoogleSignIn = async () => {
    if (loading) return;
    setLoading(true);
    try {
      const emp = await googleSignInEmployee();
      if (emp) await enterApp(emp, emp.email ?? '', emp.name);
      // null = user dismissed the Google sheet; nothing to do.
    } catch (err: any) {
      Alert.alert('Sign in failed', err?.message ?? 'Could not reach the server. Try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <StatusBar style="light" />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        bounces={false}
      >
        {/* ── Hero — pure gradient, no text ── */}
        <LinearGradient
          colors={['#1E1B4B', '#312E81', '#4338CA']}
          style={styles.hero}
          start={{ x: 0.2, y: 0 }}
          end={{ x: 0.9, y: 1 }}
        />

        {/* ── White card ── */}
        <View style={[styles.card, { paddingBottom: insets.bottom + 28 }]}>
        <View style={styles.cardTop}>
          <Text style={styles.headline}>Attendance,{'\n'}made effortless</Text>
          <Text style={styles.sub}>
            Sign in with your work Google account to clock in and track your attendance.
          </Text>
        </View>

        <View style={styles.cardBottom}>
          {googleConfigured && (
            <TouchableOpacity
              style={[styles.googleBtn, loading && { opacity: 0.4 }]}
              onPress={handleGoogleSignIn}
              activeOpacity={0.9}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#fff" style={{ flex: 1 }} />
              ) : (
                <>
                  <View style={styles.googleIconWrap}>
                    <GoogleColorIcon size={22} />
                  </View>
                  <Text style={styles.googleBtnText}>Continue with Google</Text>
                </>
              )}
            </TouchableOpacity>
          )}

          <Text style={styles.legal}>
            By continuing you agree to Interactive Digital's attendance &amp; data policy.
          </Text>
        </View>
      </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  scrollContent: { flexGrow: 1 },

  /* Hero */
  hero: { height: HERO_H, overflow: 'hidden' },

  /* Card */
  card: {
    flex: 1,
    backgroundColor: '#fff',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    marginTop: -32,
    paddingTop: 90,
    paddingHorizontal: 28,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.06,
    shadowRadius: 16,
    elevation: 10,
  },
  cardTop: { alignItems: 'center' },
  org: {
    fontSize: 13, fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#9AA3B8', letterSpacing: 0.5, marginBottom: 10,
    textAlign: 'center',
  },
  headline: {
    fontSize: 40, fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#1A1D2E', lineHeight: 46, letterSpacing: -0.8, marginBottom: 24,
    textAlign: 'center',
  },
  sub: {
    fontSize: 15, fontFamily: 'PlusJakartaSans_400Regular',
    color: '#707A91', lineHeight: 22, textAlign: 'center',
  },

  /* Bottom */
  cardBottom: { gap: 16, marginTop: 52 },
  googleBtn: {
    height: 56, borderRadius: 16, backgroundColor: '#4338CA',
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, gap: 0,
  },
  googleIconWrap: {
    width: 44, height: 44, borderRadius: 12,
    backgroundColor: '#fff',
    alignItems: 'center', justifyContent: 'center',
  },
  googleBtnText: {
    flex: 1, textAlign: 'center',
    fontSize: 16, fontFamily: 'PlusJakartaSans_700Bold', color: '#fff',
  },
  legal: {
    textAlign: 'center', fontSize: 12, color: '#9AA3B8',
    lineHeight: 18, fontFamily: 'PlusJakartaSans_400Regular',
  },
});
