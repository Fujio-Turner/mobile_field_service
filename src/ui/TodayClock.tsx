import { useCallback, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { StyleSheet, Text, View } from 'react-native';
import {
  clockLabel,
  endOfLocalDaySec,
  formatClockDate,
  formatClockTime,
  formatHms,
  pickClockTarget,
  remainingSec,
} from '../ops/todayClock';
import type { TodayRow } from '../ops/todayTypes';
import { theme } from '../theme';
import { SyncClockHud } from './SyncStatusBar';

export function TodayClock({ rows }: { rows: TodayRow[] }) {
  const [now, setNow] = useState(() => new Date());

  useFocusEffect(
    useCallback(() => {
      setNow(new Date());
      const id = setInterval(() => setNow(new Date()), 1000);
      return () => clearInterval(id);
    }, []),
  );

  const nowSec = Math.floor(now.getTime() / 1000);
  const target = pickClockTarget(rows, nowSec, endOfLocalDaySec(now));
  const remain = remainingSec(target, nowSec);
  const jobLine = [target.number, target.siteName].filter(Boolean).join(' · ');

  return (
    <View
      style={styles.card}
      accessibilityRole="timer"
      accessibilityLabel={`${formatClockTime(now)}. ${clockLabel(target.kind)} ${formatHms(remain)}${jobLine ? `. ${jobLine}` : ''}`}
    >
      <Text style={styles.date}>{formatClockDate(now)}</Text>
      <View style={styles.timeRow}>
        <Text style={styles.time} accessibilityLiveRegion="none">
          {formatClockTime(now)}
        </Text>
        <SyncClockHud nowSec={nowSec} />
      </View>
      <View style={styles.split}>
        <View style={styles.countdownBlock}>
          <Text style={styles.kicker}>{clockLabel(target.kind)}</Text>
          <Text style={styles.countdown}>{formatHms(remain)}</Text>
        </View>
        {jobLine ? (
          <View style={styles.jobBlock}>
            <Text style={styles.kicker} numberOfLines={1}>
              {target.kind === 'day' ? 'Today' : 'Job'}
            </Text>
            <Text style={styles.job} numberOfLines={2}>
              {jobLine}
            </Text>
          </View>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: theme.color.accentDeep,
    borderRadius: theme.radius,
    padding: theme.space.lg,
    marginBottom: theme.space.lg,
    ...theme.shadow.card,
  },
  date: {
    fontSize: theme.type.sm,
    color: theme.color.accentSoft,
    fontWeight: '600',
    marginBottom: theme.space.xs,
    textTransform: 'capitalize',
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.space.md,
  },
  time: {
    fontSize: theme.type.clock,
    lineHeight: 42,
    fontWeight: '700',
    color: theme.color.onAccent,
    fontVariant: ['tabular-nums'],
    letterSpacing: -0.5,
    flexShrink: 1,
  },
  split: {
    flexDirection: 'row',
    marginTop: theme.space.md,
    gap: theme.space.lg,
  },
  countdownBlock: { flexShrink: 0, minWidth: 112 },
  jobBlock: { flex: 1 },
  kicker: {
    fontSize: theme.type.sm,
    color: theme.color.accentSoft,
    fontWeight: '600',
    marginBottom: 2,
  },
  countdown: {
    fontSize: theme.type.title,
    fontWeight: '700',
    color: theme.color.onAccent,
    fontVariant: ['tabular-nums'],
  },
  job: {
    fontSize: theme.type.md,
    color: theme.color.onAccent,
    fontWeight: '600',
  },
});
