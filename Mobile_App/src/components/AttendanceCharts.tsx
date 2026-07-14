import React from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import Svg, { Polyline, Line, Circle } from 'react-native-svg';
import { AttendanceRecord } from '../services/attendanceService';
import { startOfWeek } from '../utils/attendanceStats';
import { SHIFT } from '../config/attendance';
import { COLORS } from '../constants/colors';

const SCREEN_W = Dimensions.get('window').width;
// Screen padding (22 × 2) + card padding (18 × 2)
const CHART_W = SCREEN_W - 44 - 36;

function clockInMinutes(iso: string): number {
  const d = new Date(iso);
  return d.getHours() * 60 + d.getMinutes();
}

function fmtMinutes(m: number): string {
  const h = Math.floor(m / 60);
  const min = Math.round(m % 60);
  return `${h}:${String(min).padStart(2, '0')}`;
}

/* ── Hours per day — bar chart of the last 10 working days ─────────────── */

const TRACK_H = 110;

export function HoursBars({ records }: { records: AttendanceRecord[] }) {
  // records arrive newest-first; chart wants oldest → newest
  const days = records.slice(0, 7).reverse();
  if (days.length < 2) return null;

  const max = Math.max(9.5, ...days.map((r) => r.total_hours ?? 0));

  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>Hours worked per day</Text>
      <Text style={styles.cardSub}>
        Each bar is one working day — its height is how long you were clocked in.
        The line marks a standard 8-hour day.
      </Text>
      <View style={styles.barsArea}>
        {/* 8-hour reference line across all bars */}
        <View style={[styles.refLine, { bottom: (8 / max) * TRACK_H }]}>
          <Text style={styles.refLabel}>8h</Text>
        </View>
        <View style={styles.barsRow}>
          {days.map((r) => {
            const hours = r.total_hours ?? 0;
            const late = r.status?.toLowerCase() === 'late';
            const d = new Date(`${r.date}T00:00:00`);
            return (
              <View key={r.id} style={styles.barCol}>
                <Text style={styles.barValue}>{hours.toFixed(1)}</Text>
                <View style={styles.barTrack}>
                  <View
                    style={[
                      styles.barFill,
                      {
                        height: Math.max(5, (hours / max) * TRACK_H),
                        backgroundColor: late ? COLORS.orange : COLORS.primary,
                      },
                    ]}
                  />
                </View>
                <Text style={styles.barDay}>
                  {d.toLocaleDateString('en-US', { weekday: 'short' })}
                </Text>
                <Text style={styles.barLabel}>{d.getDate()}</Text>
              </View>
            );
          })}
        </View>
      </View>
      <View style={styles.legendRow}>
        <View style={[styles.legendDot, { backgroundColor: COLORS.primary }]} />
        <Text style={styles.legendText}>Arrived on time</Text>
        <View style={[styles.legendDot, { backgroundColor: COLORS.orange, marginLeft: 14 }]} />
        <Text style={styles.legendText}>Arrived late</Text>
      </View>
    </View>
  );
}

/* ── Clock-in trend — weekly average clock-in time over ~8 weeks ───────── */

export function ClockInTrend({ records }: { records: AttendanceRecord[] }) {
  // Group by week (Monday) and average the clock-in minute-of-day.
  const byWeek = new Map<number, number[]>();
  for (const r of records) {
    const week = startOfWeek(new Date(`${r.date}T00:00:00`)).getTime();
    if (!byWeek.has(week)) byWeek.set(week, []);
    byWeek.get(week)!.push(clockInMinutes(r.clock_in_time));
  }
  const weeks = [...byWeek.entries()]
    .sort((a, b) => a[0] - b[0])
    .slice(-8)
    .map(([week, mins]) => ({
      week: new Date(week),
      avg: mins.reduce((s, m) => s + m, 0) / mins.length,
    }));
  if (weeks.length < 2) return null;

  const H = 120;
  const cutoff = SHIFT.startHour * 60 + SHIFT.startMinute + SHIFT.graceMinutes;
  const values = weeks.map((w) => w.avg).concat(cutoff);
  const lo = Math.min(...values) - 10;
  const hi = Math.max(...values) + 10;
  const x = (i: number) => 8 + (i / (weeks.length - 1)) * (CHART_W - 16);
  const y = (m: number) => 8 + ((m - lo) / (hi - lo)) * (H - 16); // earlier = higher
  const points = weeks.map((w, i) => `${x(i)},${y(w.avg)}`).join(' ');

  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>Average clock-in</Text>
      <Text style={styles.cardSub}>
        Weekly average — dashed line is the {fmtMinutes(cutoff)} late cutoff
      </Text>
      <Svg width={CHART_W} height={H}>
        <Line
          x1={0}
          y1={y(cutoff)}
          x2={CHART_W}
          y2={y(cutoff)}
          stroke={COLORS.orange}
          strokeWidth={1}
          strokeDasharray="5,4"
          opacity={0.7}
        />
        <Polyline points={points} fill="none" stroke={COLORS.primary} strokeWidth={2.5} />
        {weeks.map((w, i) => (
          <Circle
            key={w.week.getTime()}
            cx={x(i)}
            cy={y(w.avg)}
            r={4}
            fill={w.avg > cutoff ? COLORS.orange : COLORS.primary}
          />
        ))}
      </Svg>
      <View style={styles.axisRow}>
        <Text style={styles.axisText}>
          {weeks[0].week.toLocaleDateString('en-US', { day: 'numeric', month: 'short' })}
        </Text>
        <Text style={styles.axisText}>
          {weeks[weeks.length - 1].week.toLocaleDateString('en-US', { day: 'numeric', month: 'short' })}
        </Text>
      </View>
    </View>
  );
}

/* ── Where you worked — on-site vs remote donut (last 30 records) ──────── */

export function LocationSplit({ records }: { records: AttendanceRecord[] }) {
  const recent = records.slice(0, 30).filter((r) => r.location_verified !== undefined);
  if (recent.length < 2) return null;

  const onsite = recent.filter((r) => r.location_verified).length;
  const remote = recent.length - onsite;
  const pct = Math.round((onsite / recent.length) * 100);

  const R = 34;
  const STROKE = 13;
  const C = 2 * Math.PI * R;
  const size = (R + STROKE) * 2;

  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>Where you worked</Text>
      <Text style={styles.cardSub}>Last {recent.length} days on record</Text>
      <View style={styles.donutRow}>
        <View style={{ width: size, height: size }}>
          <Svg width={size} height={size}>
            <Circle
              cx={size / 2}
              cy={size / 2}
              r={R}
              stroke={COLORS.primaryLight}
              strokeWidth={STROKE}
              fill="none"
            />
            <Circle
              cx={size / 2}
              cy={size / 2}
              r={R}
              stroke={COLORS.primary}
              strokeWidth={STROKE}
              fill="none"
              strokeLinecap="round"
              strokeDasharray={`${(onsite / recent.length) * C},${C}`}
              transform={`rotate(-90 ${size / 2} ${size / 2})`}
            />
          </Svg>
          <View style={styles.donutCenter}>
            <Text style={styles.donutPct}>{pct}%</Text>
            <Text style={styles.donutPctLabel}>on-site</Text>
          </View>
        </View>
        <View style={styles.donutLegend}>
          <View style={styles.legendRowTight}>
            <View style={[styles.legendDot, { backgroundColor: COLORS.primary }]} />
            <Text style={styles.legendStrong}>{onsite}</Text>
            <Text style={styles.legendText}>days on-site</Text>
          </View>
          <View style={styles.legendRowTight}>
            <View style={[styles.legendDot, { backgroundColor: COLORS.primaryLight }]} />
            <Text style={styles.legendStrong}>{remote}</Text>
            <Text style={styles.legendText}>days remote</Text>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#fff',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 18,
    marginBottom: 12,
  },
  cardTitle: { fontSize: 15, fontFamily: 'PlusJakartaSans_700Bold', color: COLORS.dark },
  cardSub: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_400Regular',
    color: COLORS.subtle,
    marginBottom: 14,
  },

  /* bars */
  barsArea: { position: 'relative' },
  barsRow: { flexDirection: 'row', gap: 8, alignItems: 'flex-end' },
  barCol: { flex: 1, alignItems: 'center' },
  barValue: {
    fontSize: 10,
    fontFamily: 'JetBrainsMono_400Regular',
    color: COLORS.muted,
    marginBottom: 4,
  },
  barTrack: {
    width: '100%',
    height: TRACK_H,
    borderRadius: 7,
    backgroundColor: COLORS.background,
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  barFill: { width: '100%', borderRadius: 7 },
  barDay: {
    fontSize: 10,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: COLORS.muted,
    marginTop: 6,
  },
  barLabel: {
    fontSize: 10,
    fontFamily: 'JetBrainsMono_400Regular',
    color: COLORS.subtle,
  },
  refLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    // sits above the day/date labels: bottom is offset from the track base
    marginBottom: 30, // barDay (~16) + barLabel (~14)
    height: 1,
    backgroundColor: '#C9CFDE',
    zIndex: 1,
    alignItems: 'flex-end',
  },
  refLabel: {
    fontSize: 9,
    fontFamily: 'JetBrainsMono_400Regular',
    color: COLORS.subtle,
    marginTop: -13,
  },

  /* shared legend */
  legendRow: { flexDirection: 'row', alignItems: 'center', marginTop: 12 },
  legendRowTight: { flexDirection: 'row', alignItems: 'center', gap: 6, marginVertical: 4 },
  legendDot: { width: 8, height: 8, borderRadius: 4, marginRight: 6 },
  legendText: { fontSize: 12, fontFamily: 'PlusJakartaSans_500Medium', color: COLORS.muted },
  legendStrong: { fontSize: 13, fontFamily: 'PlusJakartaSans_700Bold', color: COLORS.dark },

  /* line chart axis */
  axisRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 },
  axisText: { fontSize: 10, fontFamily: 'JetBrainsMono_400Regular', color: COLORS.subtle },

  /* donut */
  donutRow: { flexDirection: 'row', alignItems: 'center', gap: 24 },
  donutCenter: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  donutPct: { fontSize: 18, fontFamily: 'PlusJakartaSans_800ExtraBold', color: COLORS.dark },
  donutPctLabel: { fontSize: 10, fontFamily: 'PlusJakartaSans_500Medium', color: COLORS.subtle },
  donutLegend: { flex: 1 },
});
