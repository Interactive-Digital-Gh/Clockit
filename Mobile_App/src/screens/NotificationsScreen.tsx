import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Switch } from 'react-native';
import { HugeiconsIcon } from '@hugeicons/react-native';
import { ArrowLeft01Icon, InformationCircleIcon } from '@hugeicons/core-free-icons';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { COLORS } from '../constants/colors';

const PREFS_KEY = '@notif_prefs';

interface NotifPrefs {
  clockInReminder: boolean;
  clockOutReminder: boolean;
  lateAlert: boolean;
  weeklySummary: boolean;
  monthlyReport: boolean;
}

const DEFAULT_PREFS: NotifPrefs = {
  clockInReminder: true,
  clockOutReminder: true,
  lateAlert: false,
  weeklySummary: true,
  monthlyReport: false,
};

function SectionHeader({ label }: { label: string }) {
  return <Text style={styles.sectionHeader}>{label}</Text>;
}

function Row({
  label,
  sub,
  value,
  onToggle,
  topBorder = true,
}: {
  label: string;
  sub?: string;
  value: boolean;
  onToggle: () => void;
  topBorder?: boolean;
}) {
  return (
    <View style={[styles.row, topBorder && styles.rowBorder]}>
      <View style={{ flex: 1, marginRight: 12 }}>
        <Text style={styles.rowLabel}>{label}</Text>
        {sub && <Text style={styles.rowSub}>{sub}</Text>}
      </View>
      <Switch
        value={value}
        onValueChange={onToggle}
        trackColor={{ false: '#E2E8F0', true: COLORS.primaryLight }}
        thumbColor={value ? COLORS.primary : '#fff'}
        ios_backgroundColor="#E2E8F0"
      />
    </View>
  );
}

export default function NotificationsScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const [prefs, setPrefs] = useState<NotifPrefs>(DEFAULT_PREFS);

  useEffect(() => {
    AsyncStorage.getItem(PREFS_KEY).then((raw) => {
      if (raw) setPrefs(JSON.parse(raw));
    });
  }, []);

  const toggle = (key: keyof NotifPrefs) => {
    const next = { ...prefs, [key]: !prefs[key] };
    setPrefs(next);
    AsyncStorage.setItem(PREFS_KEY, JSON.stringify(next));
  };

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />

      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn} activeOpacity={0.7}>
          <HugeiconsIcon icon={ArrowLeft01Icon} size={20} color={COLORS.dark} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Notifications</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 32 }]}
        showsVerticalScrollIndicator={false}
      >
        <SectionHeader label="ATTENDANCE" />
        <View style={styles.card}>
          <Row
            label="Clock-in reminder"
            sub="Reminds you to clock in at the start of your shift"
            value={prefs.clockInReminder}
            onToggle={() => toggle('clockInReminder')}
            topBorder={false}
          />
          <Row
            label="Clock-out reminder"
            sub="Reminds you to clock out before leaving"
            value={prefs.clockOutReminder}
            onToggle={() => toggle('clockOutReminder')}
          />
          <Row
            label="Late arrival alert"
            sub="Notifies you when you're clocking in late"
            value={prefs.lateAlert}
            onToggle={() => toggle('lateAlert')}
          />
        </View>

        <SectionHeader label="REPORTS" />
        <View style={styles.card}>
          <Row
            label="Weekly summary"
            sub="Your attendance summary every Monday morning"
            value={prefs.weeklySummary}
            onToggle={() => toggle('weeklySummary')}
            topBorder={false}
          />
          <Row
            label="Monthly report"
            sub="Full monthly attendance report at end of month"
            value={prefs.monthlyReport}
            onToggle={() => toggle('monthlyReport')}
          />
        </View>

        <View style={styles.notice}>
          <HugeiconsIcon icon={InformationCircleIcon} size={16} color={COLORS.muted} />
          <Text style={styles.noticeText}>
            Push notifications will be available in a future update. These preferences will be applied then.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingBottom: 12, backgroundColor: COLORS.background,
  },
  backBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 17, fontFamily: 'PlusJakartaSans_700Bold', color: COLORS.dark },
  scroll: { paddingHorizontal: 20, paddingTop: 8 },
  sectionHeader: { fontSize: 11, fontFamily: 'PlusJakartaSans_700Bold', color: COLORS.muted, letterSpacing: 1.2, marginBottom: 8, marginTop: 8 },
  card: {
    backgroundColor: '#fff', borderRadius: 18, borderWidth: 1, borderColor: COLORS.border,
    paddingHorizontal: 18, marginBottom: 14,
  },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 16 },
  rowBorder: { borderTopWidth: 1, borderTopColor: COLORS.borderLight },
  rowLabel: { fontSize: 15, fontFamily: 'PlusJakartaSans_600SemiBold', color: COLORS.dark, marginBottom: 2 },
  rowSub: { fontSize: 12, fontFamily: 'PlusJakartaSans_400Regular', color: COLORS.muted, lineHeight: 17 },
  notice: {
    flexDirection: 'row', gap: 8, alignItems: 'flex-start',
    backgroundColor: '#F8F9FC', borderRadius: 12, borderWidth: 1, borderColor: COLORS.border,
    padding: 14, marginBottom: 16,
  },
  noticeText: { flex: 1, fontSize: 13, fontFamily: 'PlusJakartaSans_400Regular', color: COLORS.muted, lineHeight: 19 },
});
