import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useApp } from '../context/AppContext';
import { fetchAttendanceHistory, AttendanceRecord } from '../services/attendanceService';
import { toDisplayRecord, startOfWeek, startOfMonth, isOnOrAfter, sumHours } from '../utils/attendanceStats';
import { HoursBars, ClockInTrend, LocationSplit } from '../components/AttendanceCharts';
import { COLORS } from '../constants/colors';

function monthYearLabel() {
  return new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

export default function HistoryScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useApp();
  const [records, setRecords] = useState<AttendanceRecord[]>([]);

  useEffect(() => {
    if (!user) return;
    // 60 covers ~12 weeks of weekdays — enough for the trend charts.
    fetchAttendanceHistory(user.id, 60).then(setRecords).catch(() => {});
  }, [user?.id]);

  const monthRecords = records.filter((r) => isOnOrAfter(r.date, startOfMonth()));
  const weekRecords = records.filter((r) => isOnOrAfter(r.date, startOfWeek()));
  const hoursThisMonth = sumHours(monthRecords);
  const daysPresentMonth = monthRecords.length;

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 16, paddingBottom: 110 }]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.title}>Attendance</Text>
        <Text style={styles.month}>{monthYearLabel()}</Text>

        <View style={styles.statsRow}>
          <View style={styles.statPrimary}>
            <Text style={styles.statPrimaryNum}>{hoursThisMonth.toFixed(1)}</Text>
            <Text style={styles.statPrimaryLabel}>hours this month</Text>
          </View>
          <View style={styles.statSecondary}>
            <Text style={styles.statSecondaryNum}>{daysPresentMonth}</Text>
            <Text style={styles.statSecondaryLabel}>days present</Text>
          </View>
        </View>

        {records.length >= 2 && (
          <>
            <Text style={styles.sectionLabel}>TRENDS</Text>
            <HoursBars records={records} />
            <ClockInTrend records={records} />
            <LocationSplit records={records} />
            <View style={{ height: 10 }} />
          </>
        )}

        <Text style={styles.sectionLabel}>THIS WEEK</Text>
        {weekRecords.length === 0 ? (
          <View style={styles.listCard}>
            <Text style={styles.emptyText}>No attendance recorded yet this week.</Text>
          </View>
        ) : (
          <View style={styles.listCard}>
            {weekRecords.map(toDisplayRecord).map((item, idx) => (
              <View key={item.id} style={[styles.row, idx === 0 && { borderTopWidth: 0 }]}>
                <View style={[styles.badge, { backgroundColor: item.statusColor === COLORS.green ? COLORS.primaryLight : '#FFF3E2' }]}>
                  <Text style={[styles.badgeMon, { color: item.statusColor === COLORS.green ? COLORS.primary : COLORS.orange }]}>{item.mon}</Text>
                  <Text style={styles.badgeDay}>{item.day}</Text>
                </View>
                <View style={styles.mid}>
                  <Text style={styles.weekday}>{item.weekday}</Text>
                  <Text style={styles.times}>{item.clockIn} – {item.clockOut}</Text>
                </View>
                <View style={styles.right}>
                  <Text style={styles.hours}>{item.hours}</Text>
                  <Text style={[styles.status, { color: item.statusColor }]}>{item.status}</Text>
                </View>
              </View>
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
  title: { fontSize: 26, fontFamily: 'PlusJakartaSans_800ExtraBold', color: COLORS.dark, letterSpacing: -0.5 },
  month: { fontSize: 14, color: COLORS.muted, fontFamily: 'PlusJakartaSans_400Regular', marginBottom: 22 },
  statsRow: { flexDirection: 'row', gap: 10, marginBottom: 22 },
  statPrimary: { flex: 1, backgroundColor: COLORS.primary, borderRadius: 18, padding: 16 },
  statPrimaryNum: { fontSize: 26, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#fff', letterSpacing: -0.5 },
  statPrimaryLabel: { fontSize: 12.5, color: 'rgba(255,255,255,0.75)', fontFamily: 'PlusJakartaSans_500Medium' },
  statSecondary: { flex: 1, backgroundColor: '#fff', borderRadius: 18, padding: 16, borderWidth: 1, borderColor: COLORS.border },
  statSecondaryNum: { fontSize: 26, fontFamily: 'PlusJakartaSans_800ExtraBold', color: COLORS.dark, letterSpacing: -0.5 },
  statSecondaryLabel: { fontSize: 12.5, color: COLORS.subtle, fontFamily: 'PlusJakartaSans_500Medium' },
  sectionLabel: { fontSize: 13, fontFamily: 'PlusJakartaSans_700Bold', color: COLORS.subtle, letterSpacing: 0.6, textTransform: 'uppercase', marginBottom: 10 },
  listCard: { backgroundColor: '#fff', borderRadius: 20, borderWidth: 1, borderColor: COLORS.border, overflow: 'hidden' },
  emptyText: { padding: 20, textAlign: 'center', fontSize: 13, color: COLORS.muted, fontFamily: 'PlusJakartaSans_400Regular' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 15, paddingHorizontal: 18, borderTopWidth: 1, borderTopColor: COLORS.borderLight },
  badge: { width: 44, height: 44, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  badgeMon: { fontSize: 10, fontFamily: 'PlusJakartaSans_700Bold', textTransform: 'uppercase', letterSpacing: 0.5 },
  badgeDay: { fontSize: 17, fontFamily: 'PlusJakartaSans_800ExtraBold', color: COLORS.dark, lineHeight: 19 },
  mid: { flex: 1 },
  weekday: { fontSize: 15, fontFamily: 'PlusJakartaSans_700Bold', color: COLORS.dark },
  times: { fontSize: 13, color: COLORS.subtle, fontFamily: 'JetBrainsMono_400Regular' },
  right: { alignItems: 'flex-end' },
  hours: { fontSize: 14, fontFamily: 'PlusJakartaSans_700Bold', color: COLORS.dark },
  status: { fontSize: 11, fontFamily: 'PlusJakartaSans_600SemiBold' },
});
