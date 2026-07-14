import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { HugeiconsIcon } from '@hugeicons/react-native';
import {
  ArrowLeft01Icon, Wifi01Icon, CheckmarkCircle01Icon,
  Alert01Icon, Shield01Icon,
} from '@hugeicons/core-free-icons';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useApp } from '../context/AppContext';
import { fetchAgencyDetails, fetchAgencyAllowedSubnets, AgencyDetails } from '../services/attendanceService';
import { checkCompanyNetwork } from '../utils/networkCheck';
import { COLORS } from '../constants/colors';

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value || '—'}</Text>
    </View>
  );
}

export default function WorkplaceScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { user } = useApp();
  const [agency, setAgency] = useState<AgencyDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [networkStatus, setNetworkStatus] = useState<'allowed' | 'no_wifi' | 'wrong_network' | 'checking'>('checking');

  useEffect(() => {
    if (!user?.agencyId) { setLoading(false); return; }

    (async () => {
      try {
        const [details, subnets] = await Promise.all([
          fetchAgencyDetails(user.agencyId!),
          fetchAgencyAllowedSubnets(user.agencyId!),
        ]);
        setAgency(details);
        const status = await checkCompanyNetwork(subnets);
        setNetworkStatus(status);
      } catch {
        setNetworkStatus('no_wifi');
      } finally {
        setLoading(false);
      }
    })();
  }, [user?.agencyId]);

  const networkLabel = {
    allowed: 'Connected',
    no_wifi: 'No WiFi',
    wrong_network: 'Not on company network',
    checking: 'Checking…',
  }[networkStatus];

  const networkColor = networkStatus === 'allowed' ? '#065F46' : networkStatus === 'checking' ? COLORS.muted : '#7F1D1D';
  const networkBg = networkStatus === 'allowed' ? '#D1FAE5' : networkStatus === 'checking' ? '#F1F3F8' : '#FEE2E2';
  const networkIcon =
    networkStatus === 'allowed' ? CheckmarkCircle01Icon :
    networkStatus === 'checking' ? Wifi01Icon : Alert01Icon;

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />

      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn} activeOpacity={0.7}>
          <HugeiconsIcon icon={ArrowLeft01Icon} size={20} color={COLORS.dark} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Workplace & location</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 32 }]}
        showsVerticalScrollIndicator={false}
      >
        {loading && (
          <View style={styles.centered}>
            <ActivityIndicator color={COLORS.primary} />
          </View>
        )}

        {!loading && !user?.agencyId && (
          <View style={styles.card}>
            <Text style={styles.notAssigned}>
              Your account hasn't been assigned to an agency yet. Contact HR to update your record.
            </Text>
          </View>
        )}

        {!loading && agency && (
          <>
            <Text style={styles.sectionHeader}>YOUR AGENCY</Text>
            <View style={styles.card}>
              <InfoRow label="Agency name" value={agency.name} />
              <View style={styles.divider} />
              <InfoRow label="Agency code" value={agency.agency_code ?? '—'} />
              {agency.address && (
                <>
                  <View style={styles.divider} />
                  <InfoRow label="Address" value={agency.address} />
                </>
              )}
            </View>

            <Text style={styles.sectionHeader}>NETWORK</Text>
            <View style={styles.card}>
              <View style={styles.networkRow}>
                <View style={styles.iconWrap}>
                  <HugeiconsIcon icon={Wifi01Icon} size={18} color={COLORS.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.rowLabel}>Company WiFi</Text>
                  <Text style={styles.rowSub}>
                    {agency.network_config?.allowed_subnets?.length
                      ? `Allowed subnets: ${agency.network_config.allowed_subnets.join(', ')}x.x`
                      : 'Any WiFi accepted (no subnet restriction set)'}
                  </Text>
                </View>
                <View style={[styles.statusBadge, { backgroundColor: networkBg }]}>
                  <HugeiconsIcon icon={networkIcon} size={12} color={networkColor} />
                  <Text style={[styles.statusText, { color: networkColor }]}>{networkLabel}</Text>
                </View>
              </View>
            </View>

            <View style={styles.notice}>
              <HugeiconsIcon icon={Shield01Icon} size={16} color={COLORS.primary} />
              <Text style={styles.noticeText}>
                Clock-in is only allowed on your company's whitelisted network. Network rules are managed by your administrator.
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
    paddingHorizontal: 20, paddingBottom: 12, backgroundColor: COLORS.background,
  },
  backBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 17, fontFamily: 'PlusJakartaSans_700Bold', color: COLORS.dark },
  scroll: { paddingHorizontal: 20, paddingTop: 8 },
  centered: { alignItems: 'center', paddingVertical: 40 },
  sectionHeader: { fontSize: 11, fontFamily: 'PlusJakartaSans_700Bold', color: COLORS.muted, letterSpacing: 1.2, marginBottom: 8, marginTop: 8 },
  card: {
    backgroundColor: '#fff', borderRadius: 18, borderWidth: 1, borderColor: COLORS.border,
    paddingHorizontal: 18, paddingVertical: 6, marginBottom: 14,
  },
  infoRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 14 },
  infoLabel: { fontSize: 14, fontFamily: 'PlusJakartaSans_500Medium', color: COLORS.muted, flex: 1 },
  infoValue: { fontSize: 14, fontFamily: 'PlusJakartaSans_600SemiBold', color: COLORS.dark, flex: 1.2, textAlign: 'right' },
  divider: { height: 1, backgroundColor: COLORS.borderLight },
  networkRow: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 16 },
  iconWrap: { width: 38, height: 38, borderRadius: 11, backgroundColor: COLORS.primaryLight, alignItems: 'center', justifyContent: 'center' },
  rowLabel: { fontSize: 15, fontFamily: 'PlusJakartaSans_600SemiBold', color: COLORS.dark, marginBottom: 2 },
  rowSub: { fontSize: 12, fontFamily: 'PlusJakartaSans_400Regular', color: COLORS.muted },
  statusBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 8, paddingVertical: 4, paddingHorizontal: 8 },
  statusText: { fontSize: 11, fontFamily: 'PlusJakartaSans_700Bold' },
  notAssigned: { fontSize: 14, fontFamily: 'PlusJakartaSans_400Regular', color: COLORS.muted, paddingVertical: 20, lineHeight: 20, textAlign: 'center' },
  notice: {
    flexDirection: 'row', gap: 8, alignItems: 'flex-start',
    backgroundColor: COLORS.primaryLight, borderRadius: 12, borderWidth: 1, borderColor: '#D6D9FF',
    padding: 14, marginBottom: 16,
  },
  noticeText: { flex: 1, fontSize: 13, fontFamily: 'PlusJakartaSans_400Regular', color: COLORS.primary, lineHeight: 19 },
});
