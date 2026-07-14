import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { fetchTodayAttendance } from '../services/attendanceService';
import { runAutoClockOutCheck, clearAutoClockOutTimer } from '../tasks/autoClockOut';

export interface UserProfile {
  id: string;
  agencyId: string | null;
  name: string;
  email: string;
  department: string;
  initials: string;
}

interface ClockState {
  clockedIn: boolean;
  clockInTime: string | null;
  date: string; // YYYY-MM-DD — so cached state is discarded the next day
}

interface AppState {
  user: UserProfile | null;
  isLoading: boolean;
  locked: boolean;
  clockedIn: boolean;
  clockInTime: string | null;
}

interface AppContextType extends AppState {
  signUp: (profile: UserProfile) => Promise<void>;
  signOut: () => Promise<void>;
  unlock: () => void;
  clockIn: (time: string) => void;
  clockOut: () => void;
}

const AppContext = createContext<AppContextType | null>(null);
const USER_KEY = '@attendance:user';
const CLOCK_KEY = '@attendance:clockState';
const SECURITY_KEY = '@security_prefs';

function todayStr() {
  return new Date().toISOString().split('T')[0];
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

async function saveClockState(clockedIn: boolean, clockInTime: string | null) {
  const payload: ClockState = { clockedIn, clockInTime, date: todayStr() };
  await AsyncStorage.setItem(CLOCK_KEY, JSON.stringify(payload));
}

async function loadClockState(): Promise<{ clockedIn: boolean; clockInTime: string | null }> {
  const raw = await AsyncStorage.getItem(CLOCK_KEY);
  if (!raw) return { clockedIn: false, clockInTime: null };
  const parsed: ClockState = JSON.parse(raw);
  // Discard if it's from a previous day
  if (parsed.date !== todayStr()) return { clockedIn: false, clockInTime: null };
  return { clockedIn: parsed.clockedIn, clockInTime: parsed.clockInTime };
}

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AppState>({
    user: null,
    isLoading: true,
    locked: false,
    clockedIn: false,
    clockInTime: null,
  });

  useEffect(() => {
    (async () => {
      const [raw, secRaw, cachedClock] = await Promise.all([
        AsyncStorage.getItem(USER_KEY),
        AsyncStorage.getItem(SECURITY_KEY),
        loadClockState(),
      ]);

      const user = raw ? (JSON.parse(raw) as UserProfile) : null;
      const secPrefs = secRaw ? JSON.parse(secRaw) : {};
      const locked = !!secPrefs.requireOnOpen;

      if (user) {
        // Show cached clock state immediately so UI is correct on open
        setState({ user, isLoading: false, locked, ...cachedClock });

        // Then verify against Supabase in the background
        fetchTodayAttendance(user.id)
          .then((record) => {
            const clockedIn = !!record?.clock_in_time && !record?.clock_out_time;
            const clockInTime = record?.clock_in_time ? formatTime(record.clock_in_time) : null;
            setState((s) => ({ ...s, clockedIn, clockInTime }));
            saveClockState(clockedIn, clockInTime);
          })
          .catch(() => {}); // keep cached state if network fails
      } else {
        setState((s) => ({ ...s, user: null, isLoading: false, locked: false }));
      }
    })();
  }, []);

  const signUp = async (profile: UserProfile) => {
    await AsyncStorage.setItem(USER_KEY, JSON.stringify(profile));
    setState((s) => ({ ...s, user: profile, locked: false }));
  };

  // Foreground auto clock-out: check every 2 minutes when clocked in
  const userRef = useRef(state.user);
  userRef.current = state.user;

  useEffect(() => {
    if (!state.clockedIn || !state.user) return;

    const check = async () => {
      const didClockOut = await runAutoClockOutCheck(userRef.current!).catch(() => false);
      if (didClockOut) {
        setState((s) => ({ ...s, clockedIn: false, clockInTime: null }));
        saveClockState(false, null);
      }
    };

    check();
    const interval = setInterval(check, 2 * 60 * 1000);
    return () => clearInterval(interval);
  }, [state.clockedIn, state.user?.id]);

  const signOut = async () => {
    await AsyncStorage.multiRemove([USER_KEY, CLOCK_KEY]);
    await clearAutoClockOutTimer();
    setState({ user: null, isLoading: false, locked: false, clockedIn: false, clockInTime: null });
  };

  const unlock = () => setState((s) => ({ ...s, locked: false }));

  const clockIn = (time: string) => {
    setState((s) => ({ ...s, clockedIn: true, clockInTime: time }));
    saveClockState(true, time);
  };

  const clockOut = () => {
    clearAutoClockOutTimer();
    setState((s) => ({ ...s, clockedIn: false, clockInTime: null }));
    saveClockState(false, null);
  };

  return (
    <AppContext.Provider value={{ ...state, signUp, signOut, unlock, clockIn, clockOut }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
