import React, { useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { HugeiconsIcon } from '@hugeicons/react-native';
import { Tick01Icon } from '@hugeicons/core-free-icons';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp, CommonActions } from '@react-navigation/native';
import { RootStackParamList } from '../navigation/AppNavigator';

type SuccessRoute = RouteProp<RootStackParamList, 'Success'>;

export default function SuccessScreen() {
  const navigation = useNavigation();
  const route = useRoute<SuccessRoute>();
  const insets = useSafeAreaInsets();
  const { clockInTime } = route.params;

  const checkScale = useRef(new Animated.Value(0.4)).current;
  const checkOpacity = useRef(new Animated.Value(0)).current;
  const ringScale = useRef(new Animated.Value(0.6)).current;
  const ringOpacity = useRef(new Animated.Value(0.6)).current;
  const text1Y = useRef(new Animated.Value(10)).current;
  const text1Op = useRef(new Animated.Value(0)).current;
  const text2Y = useRef(new Animated.Value(10)).current;
  const text2Op = useRef(new Animated.Value(0)).current;
  const cardY = useRef(new Animated.Value(10)).current;
  const cardOp = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(checkScale, { toValue: 1, tension: 120, friction: 8, useNativeDriver: true }),
      Animated.timing(checkOpacity, { toValue: 1, duration: 200, useNativeDriver: true }),
    ]).start();

    const ringLoop = Animated.loop(
      Animated.parallel([
        Animated.timing(ringScale, { toValue: 1.5, duration: 1800, useNativeDriver: true }),
        Animated.timing(ringOpacity, { toValue: 0, duration: 1800, useNativeDriver: true }),
      ])
    );
    ringLoop.start();

    const fadeUp = (y: Animated.Value, op: Animated.Value, delay: number) =>
      Animated.parallel([
        Animated.timing(y, { toValue: 0, duration: 500, delay, useNativeDriver: true }),
        Animated.timing(op, { toValue: 1, duration: 500, delay, useNativeDriver: true }),
      ]);

    Animated.parallel([
      fadeUp(text1Y, text1Op, 150),
      fadeUp(text2Y, text2Op, 220),
      fadeUp(cardY, cardOp, 300),
    ]).start();

    return () => ringLoop.stop();
  }, []);

  const handleDone = () => {
    navigation.dispatch(CommonActions.reset({ index: 0, routes: [{ name: 'Main' }] }));
  };

  return (
    <LinearGradient
      colors={['#15694A', '#1F8A5B']}
      style={styles.container}
      start={{ x: 0.5, y: 0 }}
      end={{ x: 0.5, y: 1 }}
    >
      <StatusBar style="light" />
      <View style={[styles.content, { paddingTop: insets.top }]}>
        <View style={styles.iconWrap}>
          <Animated.View style={[styles.ring, { transform: [{ scale: ringScale }], opacity: ringOpacity }]} />
          <Animated.View style={[styles.checkCircle, { transform: [{ scale: checkScale }], opacity: checkOpacity }]}>
            <HugeiconsIcon icon={Tick01Icon} size={54} color="#1F8A5B" />
          </Animated.View>
        </View>

        <Animated.Text style={[styles.title, { transform: [{ translateY: text1Y }], opacity: text1Op }]}>
          You're clocked in
        </Animated.Text>
        <Animated.Text style={[styles.subtitle, { transform: [{ translateY: text2Y }], opacity: text2Op }]}>
          Have a great day at work, Alex.
        </Animated.Text>

        <Animated.View style={[styles.detailCard, { transform: [{ translateY: cardY }], opacity: cardOp }]}>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Time in</Text>
            <Text style={styles.detailValue}>{clockInTime}</Text>
          </View>
          <View style={[styles.detailRow, styles.detailRowBottom]}>
            <Text style={styles.detailLabel}>Location</Text>
            <Text style={[styles.detailValue, styles.locationValue]}>HQ · Level 4</Text>
          </View>
        </Animated.View>
      </View>

      <View style={[styles.footer, { paddingBottom: insets.bottom + 20 }]}>
        <TouchableOpacity style={styles.doneBtn} onPress={handleDone} activeOpacity={0.9}>
          <Text style={styles.doneBtnText}>Done</Text>
        </TouchableOpacity>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 30 },
  iconWrap: { width: 118, height: 118, alignItems: 'center', justifyContent: 'center', marginBottom: 30 },
  ring: {
    position: 'absolute', width: 118, height: 118, borderRadius: 59,
    borderWidth: 2, borderColor: 'rgba(255,255,255,0.5)',
  },
  checkCircle: {
    width: 108, height: 108, borderRadius: 54, backgroundColor: '#fff',
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 18 }, shadowOpacity: 0.3, shadowRadius: 24, elevation: 8,
  },
  title: { fontSize: 30, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#fff', marginBottom: 10, letterSpacing: -0.5 },
  subtitle: { fontSize: 16, color: 'rgba(255,255,255,0.8)', fontFamily: 'PlusJakartaSans_400Regular', marginBottom: 30, textAlign: 'center' },
  detailCard: {
    backgroundColor: 'rgba(255,255,255,0.14)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)',
    borderRadius: 20, paddingHorizontal: 26, width: '100%', maxWidth: 300,
  },
  detailRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.16)',
  },
  detailRowBottom: { borderBottomWidth: 0 },
  detailLabel: { fontSize: 14, color: 'rgba(255,255,255,0.7)', fontFamily: 'PlusJakartaSans_400Regular' },
  detailValue: { fontSize: 16, fontFamily: 'JetBrainsMono_400Regular', color: '#fff' },
  locationValue: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 15 },
  footer: { paddingHorizontal: 30 },
  doneBtn: {
    height: 56, borderRadius: 16, backgroundColor: '#fff',
    alignItems: 'center', justifyContent: 'center',
  },
  doneBtnText: { fontSize: 16, fontFamily: 'PlusJakartaSans_700Bold', color: '#15694A' },
});
