import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  TextInput, ScrollView, KeyboardAvoidingView, Platform, ActivityIndicator, Alert, Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { HugeiconsIcon } from '@hugeicons/react-native';
import { GoogleIcon, CheckmarkCircle01Icon } from '@hugeicons/core-free-icons';
import { StatusBar } from 'expo-status-bar';
import { useRoute, RouteProp } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useApp } from '../context/AppContext';
import { completeOnboarding } from '../services/attendanceService';
import { RootStackParamList } from '../navigation/AppNavigator';
import { COLORS } from '../constants/colors';

type SignUpRoute = RouteProp<RootStackParamList, 'SignUp'>;

const { height: SCREEN_H } = Dimensions.get('window');
const HERO_H = SCREEN_H * 0.38;

const DEPARTMENTS = ['Product Design', 'Engineering', 'Marketing', 'Operations', 'HR'];

function getInitials(name: string): string {
  return name.split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2);
}

export default function SignUpScreen() {
  const route = useRoute<SignUpRoute>();
  const insets = useSafeAreaInsets();
  const { signUp } = useApp();

  const [name, setName] = useState(route.params.googleName);
  const [department, setDepartment] = useState('');
  const [saving, setSaving] = useState(false);

  const canSubmit = name.trim().length > 0 && department.length > 0;

  const handleSubmit = async () => {
    if (!canSubmit || saving) return;
    setSaving(true);
    try {
      // Already signed in (Google or dev) when this screen shows — just
      // persist the profile. Saving the department is what marks the account
      // as onboarded so future sign-ins skip this screen.
      const employee = await completeOnboarding(name.trim(), department);
      await signUp({
        id: employee.id,
        agencyId: employee.agency_id,
        name: name.trim(),
        email: employee.email ?? route.params.googleEmail,
        department: employee.job_title ?? department,
        initials: getInitials(name.trim()),
      });
    } catch (err: any) {
      setSaving(false);
      Alert.alert(
        'Sign up failed',
        err?.message ?? 'Could not reach the server. Check your connection and try again.'
      );
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <StatusBar style="light" />

      {/* ── Hero ── */}
      <LinearGradient
        colors={['#1E1B4B', '#312E81', '#4338CA']}
        style={[styles.hero, { paddingTop: insets.top }]}
        start={{ x: 0.2, y: 0 }}
        end={{ x: 0.9, y: 1 }}
      >
        <View style={styles.heroCenter}>
          <Text style={styles.heroTitle}>Complete your profile</Text>
        </View>
      </LinearGradient>

      {/* ── White card ── */}
      <ScrollView
        style={styles.card}
        contentContainerStyle={[styles.cardContent, { paddingBottom: insets.bottom + 32 }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Google verified pill */}
        <View style={styles.emailPill}>
          <View style={styles.emailIconWrap}>
            <HugeiconsIcon icon={GoogleIcon} size={14} color="#4338CA" />
          </View>
          <Text style={styles.emailText} numberOfLines={1}>
            {route.params.googleEmail}
          </Text>
          <HugeiconsIcon icon={CheckmarkCircle01Icon} size={16} color={COLORS.green} />
        </View>

        {/* Name */}
        <Text style={styles.fieldLabel}>FULL NAME</Text>
        <TextInput
          style={styles.input}
          value={name}
          onChangeText={setName}
          placeholder="Your full name"
          placeholderTextColor="#C4CAD9"
          autoCorrect={false}
        />

        {/* Department */}
        <Text style={styles.fieldLabel}>DEPARTMENT</Text>
        <View style={styles.deptGrid}>
          {DEPARTMENTS.map((d) => (
            <TouchableOpacity
              key={d}
              style={[styles.deptChip, department === d && styles.deptChipActive]}
              onPress={() => setDepartment(d)}
              activeOpacity={0.75}
            >
              <Text style={[styles.deptChipText, department === d && styles.deptChipTextActive]}>
                {d}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Submit */}
        <TouchableOpacity
          style={[styles.submitBtn, !canSubmit && styles.submitBtnDisabled]}
          onPress={handleSubmit}
          activeOpacity={0.9}
          disabled={!canSubmit || saving}
        >
          {saving ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.submitText}>Get started</Text>
          )}
        </TouchableOpacity>

        <Text style={styles.footerNote}>
          Your details will only be used for attendance tracking within Interactive Digital.
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },

  /* Hero */
  hero: { height: HERO_H, overflow: 'hidden', paddingHorizontal: 24 },
  heroCenter: {
    flex: 1, alignItems: 'center', justifyContent: 'flex-end', paddingBottom: 64,
  },
  heroTitle: {
    fontSize: 32, fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#fff', lineHeight: 36, letterSpacing: -0.6, textAlign: 'center',
  },

  /* Card */
  card: {
    flex: 1, backgroundColor: '#fff',
    borderTopLeftRadius: 32, borderTopRightRadius: 32, marginTop: -32,
  },
  cardContent: { paddingHorizontal: 24, paddingTop: 48 },

  /* Google verified pill */
  emailPill: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: '#F8F9FC', borderWidth: 1.5, borderColor: COLORS.border,
    borderRadius: 14, paddingVertical: 10, paddingHorizontal: 12, marginBottom: 28,
  },
  emailIconWrap: {
    width: 30, height: 30, borderRadius: 8,
    backgroundColor: COLORS.primaryLight,
    alignItems: 'center', justifyContent: 'center',
  },
  emailText: {
    flex: 1, fontSize: 13, fontFamily: 'JetBrainsMono_400Regular', color: COLORS.dark,
  },

  /* Form */
  fieldLabel: {
    fontSize: 11, fontFamily: 'PlusJakartaSans_700Bold',
    letterSpacing: 1.2, color: COLORS.muted, marginBottom: 10,
  },
  input: {
    height: 52, borderRadius: 14, backgroundColor: '#F8F9FC',
    borderWidth: 1.5, borderColor: COLORS.border,
    paddingHorizontal: 16, color: COLORS.dark,
    fontSize: 15, fontFamily: 'PlusJakartaSans_500Medium', marginBottom: 26,
  },
  deptGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 88 },
  deptChip: {
    paddingVertical: 10, paddingHorizontal: 16, borderRadius: 24,
    backgroundColor: '#F4F6FB', borderWidth: 1.5, borderColor: COLORS.border,
  },
  deptChipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  deptChipText: { fontSize: 13, fontFamily: 'PlusJakartaSans_600SemiBold', color: COLORS.muted },
  deptChipTextActive: { color: '#fff' },

  submitBtn: {
    height: 56, borderRadius: 16, backgroundColor: COLORS.primary,
    alignItems: 'center', justifyContent: 'center', marginBottom: 20,
  },
  submitBtnDisabled: { opacity: 0.4 },
  submitText: { fontSize: 16, fontFamily: 'PlusJakartaSans_700Bold', color: '#fff' },

  footerNote: {
    textAlign: 'center', fontSize: 12, color: '#9AA3B8',
    lineHeight: 18, fontFamily: 'PlusJakartaSans_400Regular',
  },
});
