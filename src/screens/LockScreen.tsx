import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as LocalAuthentication from 'expo-local-authentication';
import { HugeiconsIcon } from '@hugeicons/react-native';
import { FingerPrintIcon, FaceIdIcon, Logout01Icon } from '@hugeicons/core-free-icons';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useApp } from '../context/AppContext';

export default function LockScreen() {
  const insets = useSafeAreaInsets();
  const { user, unlock, signOut } = useApp();

  const [biometricType, setBiometricType] = useState<'face' | 'fingerprint' | 'none'>('none');
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    (async () => {
      const types = await LocalAuthentication.supportedAuthenticationTypesAsync();
      if (types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) {
        setBiometricType('face');
      } else if (types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) {
        setBiometricType('fingerprint');
      }
    })();
  }, []);

  const prompt = useCallback(async () => {
    setFailed(false);
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: 'Unlock Clockit',
      fallbackLabel: 'Use passcode',
      cancelLabel: 'Cancel',
      disableDeviceFallback: false,
    });

    if (result.success) {
      unlock();
    } else {
      setFailed(true);
    }
  }, [unlock]);

  // Auto-prompt as soon as the screen mounts
  useEffect(() => {
    prompt();
  }, []);

  const handleSignOut = () => {
    Alert.alert(
      'Sign out',
      'You will need to sign in again with Google.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Sign out', style: 'destructive', onPress: signOut },
      ],
    );
  };

  const icon = biometricType === 'face' ? FaceIdIcon : FingerPrintIcon;
  const label = biometricType === 'face' ? 'Unlock with Face ID' : 'Unlock with fingerprint';

  return (
    <LinearGradient
      colors={['#1E1B4B', '#312E81', '#4338CA']}
      style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}
      start={{ x: 0.2, y: 0 }}
      end={{ x: 0.9, y: 1 }}
    >
      <StatusBar style="light" />

      <View style={styles.circleA} />
      <View style={styles.circleB} />

      <View style={styles.body}>
        {/* Avatar */}
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{user?.initials ?? '?'}</Text>
        </View>

        <Text style={styles.greeting}>Welcome back,</Text>
        <Text style={styles.name}>{user?.name?.split(' ')[0]}</Text>

        {/* Biometric button */}
        <TouchableOpacity style={styles.lockBtn} onPress={prompt} activeOpacity={0.8}>
          <HugeiconsIcon icon={icon} size={32} color="#fff" />
        </TouchableOpacity>

        <Text style={[styles.hint, failed && styles.hintFailed]}>
          {failed ? 'Authentication failed — tap to try again' : label}
        </Text>
      </View>

      {/* Sign out escape hatch */}
      <TouchableOpacity style={styles.signOutBtn} onPress={handleSignOut} activeOpacity={0.7}>
        <HugeiconsIcon icon={Logout01Icon} size={15} color="rgba(255,255,255,0.5)" />
        <Text style={styles.signOutText}>Sign out</Text>
      </TouchableOpacity>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'space-between' },

  circleA: {
    position: 'absolute', width: 340, height: 340, borderRadius: 170,
    backgroundColor: 'rgba(255,255,255,0.06)', top: -80, right: -80,
  },
  circleB: {
    position: 'absolute', width: 220, height: 220, borderRadius: 110,
    backgroundColor: 'rgba(255,255,255,0.04)', bottom: 60, left: -80,
  },

  body: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 0 },

  avatar: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderWidth: 2, borderColor: 'rgba(255,255,255,0.3)',
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 20,
  },
  avatarText: { fontSize: 28, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#fff' },

  greeting: {
    fontSize: 16, fontFamily: 'PlusJakartaSans_400Regular',
    color: 'rgba(255,255,255,0.7)', marginBottom: 4,
  },
  name: {
    fontSize: 28, fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#fff', letterSpacing: -0.5, marginBottom: 48,
  },

  lockBtn: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.25)',
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 16,
  },

  hint: {
    fontSize: 14, fontFamily: 'PlusJakartaSans_500Medium',
    color: 'rgba(255,255,255,0.55)', textAlign: 'center',
  },
  hintFailed: { color: '#FCA5A5' },

  signOutBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingVertical: 16,
  },
  signOutText: {
    fontSize: 13, fontFamily: 'PlusJakartaSans_500Medium',
    color: 'rgba(255,255,255,0.5)',
  },
});
