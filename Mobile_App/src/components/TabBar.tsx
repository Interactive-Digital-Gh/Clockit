import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { HugeiconsIcon } from '@hugeicons/react-native';
import { Home01Icon, Clock01Icon, QrCode01Icon, UserCircle02Icon } from '@hugeicons/core-free-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/AppNavigator';
import { COLORS } from '../constants/colors';

export default function TabBar({ state, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const i = state.index;

  const goTo = (name: string) => navigation.navigate(name as never);
  const goScanner = () =>
    navigation
      .getParent<NativeStackNavigationProp<RootStackParamList>>()
      ?.navigate('Scanner');

  return (
    <View style={[styles.container, { paddingBottom: insets.bottom || 16 }]}>
      <TabItem icon={Home01Icon} label="Home" active={i === 0} onPress={() => goTo('Home')} />
      <TabItem icon={Clock01Icon} label="History" active={i === 1} onPress={() => goTo('History')} />
      <View style={styles.centerWrap}>
        <TouchableOpacity onPress={goScanner} style={styles.centerBtn} activeOpacity={0.85}>
          <HugeiconsIcon icon={QrCode01Icon} size={26} color="#fff" />
        </TouchableOpacity>
      </View>
      <TabItem icon={UserCircle02Icon} label="Profile" active={i === 2} onPress={() => goTo('Profile')} />
    </View>
  );
}

function TabItem({
  icon,
  label,
  active,
  onPress,
}: {
  icon: any;
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  const color = active ? COLORS.primary : '#9AA3B8';
  return (
    <TouchableOpacity onPress={onPress} style={styles.tab} activeOpacity={0.7}>
      <HugeiconsIcon icon={icon} size={24} color={color} strokeWidth={active ? 2 : 1.5} />
      <Text style={[styles.label, { color }]}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderTopWidth: 1,
    borderTopColor: '#E9ECF3',
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingTop: 10,
    paddingHorizontal: 16,
  },
  tab: { flex: 1, alignItems: 'center', gap: 4 },
  label: { fontSize: 11, fontFamily: 'PlusJakartaSans_600SemiBold', marginTop: 2 },
  centerWrap: { flex: 1, alignItems: 'center' },
  centerBtn: {
    width: 58,
    height: 58,
    borderRadius: 20,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -28,
    borderWidth: 4,
    borderColor: '#fff',
  },
});
