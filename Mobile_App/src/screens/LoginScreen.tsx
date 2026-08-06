import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  ScrollView, KeyboardAvoidingView, Platform, Dimensions,
  ActivityIndicator, Alert, TextInput
} from 'react-native';
import Svg, { Line } from 'react-native-svg';
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
const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

function GridBackground() {
  const gridSize = SCREEN_W / 4;
  const numHorizontalLines = Math.ceil(SCREEN_H / gridSize);
  return (
    <View style={StyleSheet.absoluteFill}>
      <Svg width="100%" height="100%">
        {Array.from({ length: 5 }).map((_, i) => (
          <Line key={`v-${i}`} x1={i * gridSize} y1={0} x2={i * gridSize} y2={SCREEN_H} stroke="#EBE9E0" strokeWidth="1" />
        ))}
        {Array.from({ length: numHorizontalLines }).map((_, i) => (
          <Line key={`h-${i}`} x1={0} y1={i * gridSize} x2={SCREEN_W} y2={i * gridSize} stroke="#EBE9E0" strokeWidth="1" />
        ))}
      </Svg>
    </View>
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
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [focusedInput, setFocusedInput] = useState<string | null>(null);

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
    } catch (err: any) {
      Alert.alert('Sign in failed', err?.message ?? 'Could not reach the server. Try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleSignIn = () => {
    Alert.alert('Not implemented', 'Email sign in is not yet supported. Please continue with Google.');
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <StatusBar style="dark" />
      <GridBackground />

      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top + 60, paddingBottom: insets.bottom + 20 }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        bounces={false}
      >
        <View style={styles.header}>
          <View style={styles.logoContainer}>
            <View style={styles.logoOuter}>
              <View style={styles.logoInner} />
            </View>
          </View>
          
          <Text style={styles.headline}>Welcome back,{'\n'}let's clock in.</Text>
          <Text style={styles.subtitle}>INTERACTIVE DIGITAL GROUP</Text>
        </View>

        <View style={styles.formContainer}>
          <TextInput
            style={[styles.input, focusedInput === 'email' && styles.inputFocused]}
            placeholder="Work email"
            placeholderTextColor="#8B8982"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            onFocus={() => setFocusedInput('email')}
            onBlur={() => setFocusedInput(null)}
          />

          <View style={[styles.passwordContainer, focusedInput === 'password' && styles.inputFocused]}>
            <TextInput
              style={styles.passwordInput}
              placeholder="Password"
              placeholderTextColor="#8B8982"
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
              onFocus={() => setFocusedInput('password')}
              onBlur={() => setFocusedInput(null)}
            />
            <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.showButton}>
              <Text style={styles.showButtonText}>{showPassword ? 'Hide' : 'Show'}</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity style={styles.signInBtn} onPress={handleSignIn} activeOpacity={0.8}>
            <Text style={styles.signInBtnText}>Sign in</Text>
          </TouchableOpacity>

          <View style={styles.dividerContainer}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>OR</Text>
            <View style={styles.dividerLine} />
          </View>

          {googleConfigured && (
            <TouchableOpacity
              style={[styles.googleBtn, loading && { opacity: 0.6 }]}
              onPress={handleGoogleSignIn}
              activeOpacity={0.8}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#1A1A1A" />
              ) : (
                <Text style={styles.googleBtnText}>Continue with Google</Text>
              )}
            </TouchableOpacity>
          )}

          <View style={styles.footer}>
            <TouchableOpacity>
              <Text style={styles.footerText}>Forgot password?</Text>
            </TouchableOpacity>
            <TouchableOpacity>
              <Text style={styles.footerTextRed}>Scan QR instead</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F6F5F2' },
  scrollContent: { flexGrow: 1, paddingHorizontal: 32 },
  
  /* Header */
  header: { marginBottom: 40 },
  logoContainer: { marginBottom: 20 },
  logoOuter: {
    width: 44, height: 44,
    borderRadius: 22,
    borderWidth: 2,
    borderColor: '#C71F3B',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoInner: {
    width: 12, height: 12,
    borderRadius: 6,
    backgroundColor: '#C71F3B',
  },
  headline: {
    fontSize: 38,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#1A1A1A',
    lineHeight: 42,
    letterSpacing: -1.2,
    marginBottom: 16,
  },
  subtitle: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#8B8982',
    letterSpacing: 2,
    textTransform: 'uppercase',
  },

  /* Form */
  formContainer: { gap: 20 },
  input: {
    height: 60,
    backgroundColor: '#FFFFFF',
    borderRadius: 30,
    borderWidth: 1,
    borderColor: '#E2E0D8',
    paddingHorizontal: 24,
    fontSize: 16,
    fontFamily: 'PlusJakartaSans_400Regular',
    color: '#1A1A1A',
  },
  inputFocused: {
    borderWidth: 2,
    borderColor: '#1A1A1A',
  },
  passwordContainer: {
    height: 60,
    backgroundColor: '#FFFFFF',
    borderRadius: 30,
    borderWidth: 1,
    borderColor: '#E2E0D8',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  passwordInput: {
    flex: 1,
    fontSize: 16,
    fontFamily: 'PlusJakartaSans_400Regular',
    color: '#1A1A1A',
  },
  showButton: {
    paddingLeft: 12,
  },
  showButtonText: {
    color: '#C71F3B',
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_700Bold',
  },
  signInBtn: {
    height: 60,
    backgroundColor: '#C71F3B',
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#C71F3B',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 8,
    marginTop: 4,
  },
  signInBtnText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontFamily: 'PlusJakartaSans_700Bold',
  },

  /* Divider */
  dividerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 4,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#E2E0D8',
  },
  dividerText: {
    marginHorizontal: 16,
    color: '#A09E96',
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_600SemiBold',
  },

  /* Google Button */
  googleBtn: {
    height: 60,
    backgroundColor: '#FFFFFF',
    borderRadius: 30,
    borderWidth: 1,
    borderColor: '#E2E0D8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  googleBtnText: {
    color: '#1A1A1A',
    fontSize: 16,
    fontFamily: 'PlusJakartaSans_700Bold',
  },

  /* Footer */
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 12,
    paddingHorizontal: 8,
  },
  footerText: {
    color: '#8B8982',
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_600SemiBold',
  },
  footerTextRed: {
    color: '#C71F3B',
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_700Bold',
  },
});
