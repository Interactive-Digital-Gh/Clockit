import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { HugeiconsIcon } from '@hugeicons/react-native';
import { ArrowLeft01Icon, InformationCircleIcon } from '@hugeicons/core-free-icons';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useApp } from '../context/AppContext';
import { fetchEmployeeDetails, EmployeeDetails } from '../services/attendanceService';
import { COLORS } from '../constants/colors';

function formatDate(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
}

function formatEmploymentType(val: string | null) {
  if (!val) return '—';
  return val.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value || '—'}</Text>
    </View>
  );
}

export default function AccountDetailsScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { user } = useApp();
  const [details, setDetails] = useState<EmployeeDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!user?.id) return;
    fetchEmployeeDetails(user.id)
      .then(setDetails)
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [user?.id]);

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />

      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn} activeOpacity={0.7}>
          <HugeiconsIcon icon={ArrowLeft01Icon} size={20} color={COLORS.dark} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Account details</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 32 }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.profileBlock}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{user?.initials ?? '?'}</Text>
          </View>
          <Text style={styles.name}>{user?.name}</Text>
          <Text style={styles.role}>{user?.department}</Text>
        </View>

        {loading && (
          <View style={styles.centered}>
            <ActivityIndicator color={COLORS.primary} />
          </View>
        )}

        {error && !loading && (
          <View style={styles.centered}>
            <Text style={styles.errorText}>Couldn't load details. Check your connection.</Text>
          </View>
        )}

        {details && !loading && (
          <>
            <View style={styles.card}>
              <Text style={styles.cardTitle}>EMPLOYEE INFO</Text>
              <InfoRow label="Employee ID" value={details.emp_id ?? '—'} />
              <View style={styles.divider} />
              <InfoRow label="Full name" value={details.name} />
              <View style={styles.divider} />
              <InfoRow label="Job title" value={details.job_title ?? '—'} />
              <View style={styles.divider} />
              <InfoRow label="Department" value={user?.department ?? '—'} />
              <View style={styles.divider} />
              <InfoRow label="Employment type" value={formatEmploymentType(details.employment_type)} />
              <View style={styles.divider} />
              <InfoRow label="Date joined" value={formatDate(details.date_join)} />
            </View>

            <View style={styles.card}>
              <Text style={styles.cardTitle}>CONTACT</Text>
              <InfoRow label="Email" value={details.email ?? '—'} />
            </View>

            <View style={styles.notice}>
              <HugeiconsIcon icon={InformationCircleIcon} size={16} color={COLORS.muted} />
              <Text style={styles.noticeText}>
                To update your details, contact HR or your system administrator.
              </Text>
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingBottom: 12,
    backgroundColor: COLORS.background,
  },
  backBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 17, fontFamily: 'PlusJakartaSans_700Bold', color: COLORS.dark },
  scroll: { paddingHorizontal: 20, paddingTop: 8 },
  profileBlock: { alignItems: 'center', paddingVertical: 20, marginBottom: 8 },
  avatar: {
    width: 72, height: 72, borderRadius: 36, backgroundColor: COLORS.primary,
    alignItems: 'center', justifyContent: 'center', marginBottom: 12,
  },
  avatarText: { fontSize: 26, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#fff' },
  name: { fontSize: 19, fontFamily: 'PlusJakartaSans_700Bold', color: COLORS.dark },
  role: { fontSize: 13, color: COLORS.muted, fontFamily: 'PlusJakartaSans_400Regular', marginTop: 2 },
  centered: { alignItems: 'center', paddingVertical: 40 },
  errorText: { fontSize: 14, color: COLORS.muted, fontFamily: 'PlusJakartaSans_400Regular', textAlign: 'center' },
  card: {
    backgroundColor: '#fff', borderRadius: 18, borderWidth: 1, borderColor: COLORS.border,
    paddingHorizontal: 18, paddingVertical: 6, marginBottom: 14,
  },
  cardTitle: { fontSize: 11, fontFamily: 'PlusJakartaSans_700Bold', color: COLORS.muted, letterSpacing: 1.2, paddingVertical: 14 },
  infoRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 14 },
  infoLabel: { fontSize: 14, fontFamily: 'PlusJakartaSans_500Medium', color: COLORS.muted, flex: 1 },
  infoValue: { fontSize: 14, fontFamily: 'PlusJakartaSans_600SemiBold', color: COLORS.dark, flex: 1.2, textAlign: 'right' },
  divider: { height: 1, backgroundColor: COLORS.borderLight },
  notice: {
    flexDirection: 'row', gap: 8, alignItems: 'flex-start',
    backgroundColor: '#F8F9FC', borderRadius: 12, borderWidth: 1, borderColor: COLORS.border,
    padding: 14, marginBottom: 16,
  },
  noticeText: { flex: 1, fontSize: 13, fontFamily: 'PlusJakartaSans_400Regular', color: COLORS.muted, lineHeight: 19 },
});
