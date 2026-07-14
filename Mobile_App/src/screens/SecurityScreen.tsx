import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Switch } from 'react-native';
import { HugeiconsIcon } from '@hugeicons/react-native';
import {
  ArrowLeft01Icon, FingerPrintIcon, LockIcon,
  Wifi01Icon, QrCode01Icon, InformationCircleIcon,
} from '@hugeicons/core-free-icons';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { COLORS } from '../constants/colors';

const PREFS_KEY = '@security_prefs';

interface SecurityPrefs {
  faceId: boolean;
  requireOnOpen: boolean;
}

const DEFAULT_PREFS: SecurityPrefs = { faceId: false, requireOnOpen: false };

function Row({
  icon,
  label,
  sub,
  value,
  onToggle,
  topBorder = true,
}: {
  icon: any;
  label: string;
  sub?: string;
  value: boolean;
  onToggle: () => void;
  topBorder?: boolean;
}) {
  return (
    <View style={[styles.row, topBorder && styles.rowBorder]}>
      <View style={[styles.iconWrap, { backgroundColor: value ? COLORS.primaryLight : '#F1F3F8' }]}>
        <HugeiconsIcon icon={icon} size={18} color={value ? COLORS.primary : COLORS.muted} />
      </View>
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

export default function SecurityScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const [prefs, setPrefs] = useState<SecurityPrefs>(DEFAULT_PREFS);

  useEffect(() => {
    AsyncStorage.getItem(PREFS_KEY).then((raw) => {
      if (raw) setPrefs(JSON.parse(raw));
    });
  }, []);

  const toggle = (key: keyof SecurityPrefs) => {
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
        <Text style={styles.headerTitle}>Face ID & security</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 32 }]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.sectionHeader}>APP LOCK</Text>
        <View style={styles.card}>
          <Row
            icon={FingerPrintIcon}
            label="Use Face ID / Touch ID"
            sub="Unlock the app with biometrics instead of opening directly"
            value={prefs.faceId}
            onToggle={() => toggle('faceId')}
            topBorder={false}
          />
          <Row
            icon={LockIcon}
            label="Require on open"
            sub="Ask for biometrics every time the app is opened"
            value={prefs.requireOnOpen}
            onToggle={() => toggle('requireOnOpen')}
          />
        </View>

        <Text style={styles.sectionHeader}>CLOCK-IN SECURITY</Text>
        <View style={styles.card}>
          <View style={[styles.infoRow]}>
            <View style={styles.iconWrap}>
              <HugeiconsIcon icon={Wifi01Icon} size={18} color={COLORS.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.rowLabel}>Network verification</Text>
              <Text style={styles.rowSub}>Always active — you must be on your company WiFi to clock in</Text>
            </View>
            <View style={styles.activeBadge}>
              <Text style={styles.activeBadgeText}>Active</Text>
            </View>
          </View>
          <View style={[styles.infoRow, styles.rowBorder]}>
            <View style={styles.iconWrap}>
              <HugeiconsIcon icon={QrCode01Icon} size={18} color={COLORS.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.rowLabel}>QR code scan</Text>
              <Text style={styles.rowSub}>Always active — scan the entrance QR code to confirm presence</Text>
            </View>
            <View style={styles.activeBadge}>
              <Text style={styles.activeBadgeText}>Active</Text>
            </View>
          </View>
        </View>

        <View style={styles.notice}>
          <HugeiconsIcon icon={InformationCircleIcon} size={16} color={COLORS.muted} />
          <Text style={styles.noticeText}>
            Biometric lock will be fully enabled in a future update. Network and QR verification are always enforced.
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
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 16 },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 16 },
  rowBorder: { borderTopWidth: 1, borderTopColor: COLORS.borderLight },
  iconWrap: { width: 38, height: 38, borderRadius: 11, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.primaryLight },
  rowLabel: { fontSize: 15, fontFamily: 'PlusJakartaSans_600SemiBold', color: COLORS.dark, marginBottom: 2 },
  rowSub: { fontSize: 12, fontFamily: 'PlusJakartaSans_400Regular', color: COLORS.muted, lineHeight: 17 },
  activeBadge: { backgroundColor: '#D1FAE5', borderRadius: 8, paddingVertical: 4, paddingHorizontal: 10 },
  activeBadgeText: { fontSize: 11, fontFamily: 'PlusJakartaSans_700Bold', color: '#065F46' },
  notice: {
    flexDirection: 'row', gap: 8, alignItems: 'flex-start',
    backgroundColor: '#F8F9FC', borderRadius: 12, borderWidth: 1, borderColor: COLORS.border,
    padding: 14, marginBottom: 16,
  },
  noticeText: { flex: 1, fontSize: 13, fontFamily: 'PlusJakartaSans_400Regular', color: COLORS.muted, lineHeight: 19 },
});
