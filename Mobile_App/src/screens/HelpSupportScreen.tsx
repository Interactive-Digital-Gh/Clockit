import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Linking } from 'react-native';
import { HugeiconsIcon } from '@hugeicons/react-native';
import { ArrowLeft01Icon, ArrowUp01Icon, ArrowDown01Icon, Mail01Icon, LinkSquare01Icon } from '@hugeicons/core-free-icons';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { COLORS } from '../constants/colors';

const APP_VERSION = '1.0.0';
const HR_EMAIL = 'hr@interactivedigital.com';

const FAQ = [
  {
    q: 'How do I clock in?',
    a: 'Tap the QR button at the bottom of the home screen, then point the camera at the QR code at the entrance.',
  },
  {
    q: 'What if I forget to clock out?',
    a: 'Contact HR or your manager to correct your attendance record.',
  },
  {
    q: 'My clock-in failed. What should I do?',
    a: 'Try closing and reopening the app, then scan again. If it still fails, check your internet connection.',
  },
  {
    q: 'How are my total hours calculated?',
    a: 'Total hours are the difference between your clock-in and clock-out time. The system calculates this automatically when you clock out.',
  },
  {
    q: 'Why does the app need camera access?',
    a: 'The camera is only used to scan the QR code at your workplace entrance when you clock in. It is never used for any other purpose.',
  },
  {
    q: 'Can I use the app on mobile data?',
    a: 'Yes. Clock-in works on any connection — the app just records whether you were on-site or remote.',
  },
];

function FAQItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <View style={styles.faqItem}>
      <TouchableOpacity
        style={styles.faqQuestion}
        onPress={() => setOpen(!open)}
        activeOpacity={0.75}
      >
        <Text style={styles.faqQ}>{q}</Text>
        <HugeiconsIcon icon={open ? ArrowUp01Icon : ArrowDown01Icon} size={16} color={COLORS.muted} />
      </TouchableOpacity>
      {open && <Text style={styles.faqA}>{a}</Text>}
    </View>
  );
}

export default function HelpSupportScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />

      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn} activeOpacity={0.7}>
          <HugeiconsIcon icon={ArrowLeft01Icon} size={20} color={COLORS.dark} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Help & support</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 32 }]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.sectionHeader}>FREQUENTLY ASKED QUESTIONS</Text>
        <View style={styles.card}>
          {FAQ.map((item, idx) => (
            <React.Fragment key={idx}>
              {idx > 0 && <View style={styles.divider} />}
              <FAQItem q={item.q} a={item.a} />
            </React.Fragment>
          ))}
        </View>

        <Text style={styles.sectionHeader}>CONTACT</Text>
        <View style={styles.card}>
          <TouchableOpacity
            style={styles.contactRow}
            onPress={() => Linking.openURL(`mailto:${HR_EMAIL}?subject=Clockit Support`)}
            activeOpacity={0.75}
          >
            <View style={styles.iconWrap}>
              <HugeiconsIcon icon={Mail01Icon} size={18} color={COLORS.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.contactLabel}>Email HR</Text>
              <Text style={styles.contactSub}>{HR_EMAIL}</Text>
            </View>
            <HugeiconsIcon icon={LinkSquare01Icon} size={16} color={COLORS.muted} />
          </TouchableOpacity>
        </View>

        <View style={styles.versionBlock}>
          <Text style={styles.versionLabel}>Clockit</Text>
          <Text style={styles.versionNumber}>Version {APP_VERSION}</Text>
          <Text style={styles.versionSub}>Interactive Digital · Internal</Text>
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
    paddingHorizontal: 18, marginBottom: 14, overflow: 'hidden',
  },
  divider: { height: 1, backgroundColor: COLORS.borderLight },
  faqItem: { paddingVertical: 14 },
  faqQuestion: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  faqQ: { flex: 1, fontSize: 14, fontFamily: 'PlusJakartaSans_600SemiBold', color: COLORS.dark, lineHeight: 20 },
  faqA: { fontSize: 13, fontFamily: 'PlusJakartaSans_400Regular', color: COLORS.muted, lineHeight: 20, marginTop: 10 },
  contactRow: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 16 },
  iconWrap: { width: 38, height: 38, borderRadius: 11, backgroundColor: COLORS.primaryLight, alignItems: 'center', justifyContent: 'center' },
  contactLabel: { fontSize: 15, fontFamily: 'PlusJakartaSans_600SemiBold', color: COLORS.dark, marginBottom: 2 },
  contactSub: { fontSize: 12, fontFamily: 'JetBrainsMono_400Regular', color: COLORS.muted },
  versionBlock: { alignItems: 'center', paddingVertical: 24, gap: 4 },
  versionLabel: { fontSize: 14, fontFamily: 'PlusJakartaSans_700Bold', color: COLORS.dark },
  versionNumber: { fontSize: 13, fontFamily: 'JetBrainsMono_400Regular', color: COLORS.muted },
  versionSub: { fontSize: 12, fontFamily: 'PlusJakartaSans_400Regular', color: '#C4CAD9' },
});
