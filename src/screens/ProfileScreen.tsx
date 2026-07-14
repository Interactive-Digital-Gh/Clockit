import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { HugeiconsIcon } from '@hugeicons/react-native';
import {
  UserCircle02Icon, Notification01Icon, FingerPrintIcon,
  Building02Icon, HelpCircleIcon, Logout01Icon, ArrowRight01Icon,
} from '@hugeicons/core-free-icons';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useApp } from '../context/AppContext';
import { ProfileStackParamList } from '../navigation/AppNavigator';
import { COLORS } from '../constants/colors';

type NavProp = NativeStackNavigationProp<ProfileStackParamList>;

const SETTINGS: {
  icon: any;
  label: string;
  screen: keyof ProfileStackParamList;
}[] = [
  { icon: UserCircle02Icon,   label: 'Account details',      screen: 'AccountDetails' },
  { icon: Notification01Icon, label: 'Notifications',        screen: 'Notifications'  },
  { icon: FingerPrintIcon,    label: 'Face ID & security',   screen: 'Security'       },
  { icon: Building02Icon,     label: 'Workplace & location', screen: 'Workplace'      },
  { icon: HelpCircleIcon,     label: 'Help & support',       screen: 'HelpSupport'    },
];

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NavProp>();
  const { user, signOut } = useApp();

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 16, paddingBottom: 110 }]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.title}>Profile</Text>

        <View style={styles.profileBlock}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{user?.initials ?? '?'}</Text>
          </View>
          <Text style={styles.name}>{user?.name}</Text>
          <Text style={styles.role}>{user?.department} · Interactive Digital</Text>
          <Text style={styles.email}>{user?.email}</Text>
        </View>

        <View style={styles.listCard}>
          {SETTINGS.map((item, idx) => (
            <TouchableOpacity
              key={idx}
              style={[styles.row, idx === 0 && { borderTopWidth: 0 }]}
              onPress={() => navigation.navigate(item.screen)}
              activeOpacity={0.7}
            >
              <View style={styles.iconWrap}>
                <HugeiconsIcon icon={item.icon} size={19} color={COLORS.primary} />
              </View>
              <Text style={styles.rowLabel}>{item.label}</Text>
              <HugeiconsIcon icon={ArrowRight01Icon} size={16} color="#C4CAD9" />
            </TouchableOpacity>
          ))}
        </View>

        <TouchableOpacity style={styles.signOutBtn} onPress={signOut} activeOpacity={0.8}>
          <HugeiconsIcon icon={Logout01Icon} size={18} color={COLORS.red} />
          <Text style={styles.signOutText}>Sign out</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  scroll: { paddingHorizontal: 22 },
  title: { fontSize: 26, fontFamily: 'PlusJakartaSans_800ExtraBold', color: COLORS.dark, marginBottom: 22, letterSpacing: -0.5 },
  profileBlock: { alignItems: 'center', marginBottom: 26 },
  avatar: {
    width: 84, height: 84, borderRadius: 42, backgroundColor: COLORS.primary,
    alignItems: 'center', justifyContent: 'center', marginBottom: 14,
  },
  avatarText: { fontSize: 30, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#fff' },
  name: { fontSize: 21, fontFamily: 'PlusJakartaSans_800ExtraBold', color: COLORS.dark },
  role: { fontSize: 14, color: COLORS.muted, fontFamily: 'PlusJakartaSans_400Regular', marginTop: 2 },
  email: { fontSize: 13, color: '#9AA3B8', fontFamily: 'JetBrainsMono_400Regular', marginTop: 2 },
  listCard: { backgroundColor: '#fff', borderRadius: 20, borderWidth: 1, borderColor: COLORS.border, overflow: 'hidden', marginBottom: 16 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 16, paddingHorizontal: 18, borderTopWidth: 1, borderTopColor: COLORS.borderLight },
  iconWrap: { width: 38, height: 38, borderRadius: 11, backgroundColor: COLORS.primaryLight, alignItems: 'center', justifyContent: 'center' },
  rowLabel: { flex: 1, fontSize: 15, fontFamily: 'PlusJakartaSans_600SemiBold', color: COLORS.dark },
  signOutBtn: {
    height: 54, borderRadius: 16, borderWidth: 1.5, borderColor: COLORS.redBorder,
    backgroundColor: '#fff', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
  },
  signOutText: { fontSize: 15, fontFamily: 'PlusJakartaSans_700Bold', color: COLORS.red },
});
