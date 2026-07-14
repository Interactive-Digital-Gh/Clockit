import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { HugeiconsIcon } from '@hugeicons/react-native';
import { Location01Icon, Logout01Icon, QrCode01Icon } from '@hugeicons/core-free-icons';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, CompositeNavigationProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { useApp } from '../context/AppContext';
import { clockOutEmployee, fetchAttendanceHistory, AttendanceRecord } from '../services/attendanceService';
import { RootStackParamList, MainTabParamList } from '../navigation/AppNavigator';
import { COLORS } from '../constants/colors';
import { toDisplayRecord, startOfWeek, isOnOrAfter, sumHours, onTimeRate } from '../utils/attendanceStats';

type NavProp = CompositeNavigationProp<
  BottomTabNavigationProp<MainTabParamList>,
  NativeStackNavigationProp<RootStackParamList>
>;

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

function todayLabel() {
  return new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
}

export default function HomeScreen() {
  const nav = useNavigation<NavProp>();
  const insets = useSafeAreaInsets();
  const { user, clockedIn, clockInTime, clockOut } = useApp();
  const [weekRecords, setWeekRecords] = useState<AttendanceRecord[]>([]);

  useEffect(() => {
    if (!user) return;
    fetchAttendanceHistory(user.id, 10)
      .then((records) => setWeekRecords(records.filter((r) => isOnOrAfter(r.date, startOfWeek()))))
      .catch(() => {});
  }, [user?.id, clockedIn]);

  const hrsThisWeek = sumHours(weekRecords);
  const daysPresent = Math.min(weekRecords.length, 5);
  const onTimePct = onTimeRate(weekRecords);

  const handleClockOut = async () => {
    if (!user) return;
    try {
      await clockOutEmployee(user.id);
      clockOut();
    } catch (err: any) {
      Alert.alert('Clock-out failed', err?.message ?? 'Could not record your departure. Try again.');
    }
  };
  const firstName = user?.name.split(' ')[0] ?? '';

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 16, paddingBottom: 110 }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text style={styles.dateLabel}>{todayLabel()}</Text>
            <Text style={styles.greeting}>{greeting()}, {firstName}</Text>
          </View>
          <TouchableOpacity style={styles.avatar} onPress={() => nav.navigate('Profile')} activeOpacity={0.8}>
            <Text style={styles.avatarText}>{user?.initials ?? '?'}</Text>
          </TouchableOpacity>
        </View>

        {clockedIn ? (
          <View style={styles.card}>
            <View style={styles.statusRow}>
              <View style={[styles.dot, { backgroundColor: COLORS.green }]} />
              <Text style={[styles.statusLabel, { color: COLORS.green }]}>Clocked in</Text>
            </View>
            <Text style={styles.clockTime}>{clockInTime}</Text>
            <View style={styles.locationRow}>
              <HugeiconsIcon icon={Location01Icon} size={15} color={COLORS.muted} />
              <Text style={styles.locationText}>HQ — Level 4, West Wing</Text>
            </View>
            <TouchableOpacity style={styles.outlineBtn} onPress={handleClockOut} activeOpacity={0.8}>
              <HugeiconsIcon icon={Logout01Icon} size={18} color={COLORS.dark} />
              <Text style={styles.outlineBtnText}>Clock out</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.card}>
            <View style={styles.statusRow}>
              <View style={[styles.dot, { backgroundColor: '#C4CAD9' }]} />
              <Text style={[styles.statusLabel, { color: COLORS.muted }]}>Not clocked in</Text>
            </View>
            <Text style={styles.readyTitle}>Ready to start your day?</Text>
            <Text style={styles.readyBody}>
              Scan the QR code at your entrance to record your arrival.
            </Text>
            <TouchableOpacity
              style={styles.scanBtn}
              onPress={() => nav.navigate('Scanner')}
              activeOpacity={0.85}
            >
              <HugeiconsIcon icon={QrCode01Icon} size={20} color="#fff" />
              <Text style={styles.scanBtnText}>Scan to clock in</Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={styles.statsGrid}>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{hrsThisWeek.toFixed(1)}</Text>
            <Text style={styles.statLabel}>hrs / week</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{daysPresent}<Text style={styles.statOf}>/5</Text></Text>
            <Text style={styles.statLabel}>days present</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={[styles.statValue, { color: COLORS.green }]}>{onTimePct != null ? `${onTimePct}%` : '—'}</Text>
            <Text style={styles.statLabel}>on time</Text>
          </View>
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>This week</Text>
          <TouchableOpacity onPress={() => nav.navigate('History')} activeOpacity={0.7}>
            <Text style={styles.seeAll}>See all</Text>
          </TouchableOpacity>
        </View>
        {weekRecords.length === 0 ? (
          <View style={styles.listCard}>
            <Text style={styles.emptyText}>No attendance recorded yet this week.</Text>
          </View>
        ) : (
          <View style={styles.listCard}>
            {weekRecords.map(toDisplayRecord).map((item, idx) => (
              <TouchableOpacity key={item.id} style={[styles.listRow, idx === 0 && { borderTopWidth: 0 }]} onPress={() => nav.navigate('History')} activeOpacity={0.7}>
                <View style={styles.dateBadge}>
                  <Text style={styles.dateMon}>{item.mon}</Text>
                  <Text style={styles.dateDay}>{item.day}</Text>
                </View>
                <View style={styles.listMid}>
                  <Text style={styles.weekday}>{item.weekday}</Text>
                  <Text style={styles.times}>{item.clockIn} – {item.clockOut}</Text>
                </View>
                <View style={styles.listRight}>
                  <Text style={styles.hours}>{item.hours}</Text>
                  <Text style={[styles.statusChip, { color: item.statusColor }]}>{item.status}</Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  scroll: { paddingHorizontal: 22 },
  header: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24 },
  dateLabel: { fontSize: 14, fontFamily: 'PlusJakartaSans_500Medium', color: COLORS.muted, marginBottom: 4 },
  greeting: { fontSize: 26, fontFamily: 'PlusJakartaSans_800ExtraBold', color: COLORS.dark, letterSpacing: -0.5 },
  avatar: {
    width: 46, height: 46, borderRadius: 23, backgroundColor: COLORS.primary,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { fontSize: 16, fontFamily: 'PlusJakartaSans_700Bold', color: '#fff' },
  card: {
    backgroundColor: '#fff', borderRadius: 24, padding: 24, marginBottom: 16,
    shadowColor: '#1E285A', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.12, shadowRadius: 18, elevation: 3,
    borderWidth: 1, borderColor: COLORS.border,
  },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16 },
  dot: { width: 9, height: 9, borderRadius: 5 },
  statusLabel: { fontSize: 14, fontFamily: 'PlusJakartaSans_700Bold' },
  clockTime: { fontSize: 40, fontFamily: 'PlusJakartaSans_800ExtraBold', color: COLORS.dark, letterSpacing: -1, marginBottom: 4 },
  locationRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 20 },
  locationText: { fontSize: 14, color: COLORS.muted, fontFamily: 'PlusJakartaSans_400Regular' },
  outlineBtn: {
    height: 50, borderRadius: 14, borderWidth: 1.5, borderColor: '#E4E7F0',
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
  },
  outlineBtnText: { fontSize: 15, fontFamily: 'PlusJakartaSans_700Bold', color: COLORS.dark },
  readyTitle: { fontSize: 18, fontFamily: 'PlusJakartaSans_700Bold', color: COLORS.dark, marginBottom: 6, letterSpacing: -0.3 },
  readyBody: { fontSize: 14, lineHeight: 21, color: COLORS.muted, fontFamily: 'PlusJakartaSans_400Regular', marginBottom: 20 },
  scanBtn: {
    height: 54, borderRadius: 16, backgroundColor: COLORS.primary,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
  },
  scanBtnText: { fontSize: 16, fontFamily: 'PlusJakartaSans_700Bold', color: '#fff' },
  statsGrid: { flexDirection: 'row', gap: 10, marginBottom: 24 },
  statCard: { flex: 1, backgroundColor: '#fff', borderRadius: 18, padding: 14, borderWidth: 1, borderColor: COLORS.border },
  statValue: { fontSize: 23, fontFamily: 'PlusJakartaSans_800ExtraBold', color: COLORS.dark, letterSpacing: -0.5 },
  statOf: { fontSize: 14, color: COLORS.subtle, fontFamily: 'PlusJakartaSans_400Regular' },
  statLabel: { fontSize: 12, color: COLORS.subtle, fontFamily: 'PlusJakartaSans_500Medium', marginTop: 2 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  sectionTitle: { fontSize: 17, fontFamily: 'PlusJakartaSans_700Bold', color: COLORS.dark },
  seeAll: { fontSize: 14, fontFamily: 'PlusJakartaSans_600SemiBold', color: COLORS.primary },
  listCard: { backgroundColor: '#fff', borderRadius: 20, borderWidth: 1, borderColor: COLORS.border, overflow: 'hidden' },
  emptyText: { padding: 20, textAlign: 'center', fontSize: 13, color: COLORS.muted, fontFamily: 'PlusJakartaSans_400Regular' },
  listRow: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 15, paddingHorizontal: 18, borderTopWidth: 1, borderTopColor: COLORS.borderLight },
  dateBadge: { width: 42, height: 42, borderRadius: 13, backgroundColor: COLORS.primaryLight, alignItems: 'center', justifyContent: 'center' },
  dateMon: { fontSize: 10, fontFamily: 'PlusJakartaSans_700Bold', color: COLORS.primary, textTransform: 'uppercase', letterSpacing: 0.5 },
  dateDay: { fontSize: 16, fontFamily: 'PlusJakartaSans_800ExtraBold', color: COLORS.dark, lineHeight: 18 },
  listMid: { flex: 1 },
  weekday: { fontSize: 15, fontFamily: 'PlusJakartaSans_700Bold', color: COLORS.dark },
  times: { fontSize: 13, color: COLORS.subtle, fontFamily: 'JetBrainsMono_400Regular' },
  listRight: { alignItems: 'flex-end' },
  hours: { fontSize: 14, fontFamily: 'PlusJakartaSans_700Bold', color: COLORS.dark },
  statusChip: { fontSize: 11, fontFamily: 'PlusJakartaSans_600SemiBold' },
});
