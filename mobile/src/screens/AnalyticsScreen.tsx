import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { MaterialIcons } from '@expo/vector-icons';
import Svg, { Line, Path, Text as SvgText } from 'react-native-svg';
import ScreenWrapper from '../components/ScreenWrapper';
import AppButton from '../components/AppButton';
import {
  AnalyticsPeriod,
  AnalyticsTrendPoint,
  ApiError,
  getProductivityAnalytics,
  ProductivityAnalytics,
} from '../config/api';
import { useTheme } from '../theme';
import { handleUnauthorizedIfNeeded } from '../auth/unauthorizedHandler';

const PERIOD_OPTIONS: AnalyticsPeriod[] = ['day', 'week'];

const chartHeight = 180;
const chartPadding = { left: 34, right: 10, top: 16, bottom: 26 };

const formatPercent = (value: number): string => `${Math.round(value)}%`;

const formatDateWindow = (startDate: string, endDate: string): string => {
  const start = new Date(startDate);
  const end = new Date(endDate);
  return `${start.getMonth() + 1}/${start.getDate()} - ${end.getMonth() + 1}/${end.getDate()}`;
};

const formatHours = (value: number | null): string => {
  if (value === null) return '--';
  if (value >= 24) {
    const days = (value / 24).toFixed(1);
    return `${days}d`;
  }
  return `${value.toFixed(1)}h`;
};

const hasNoAnalyticsData = (analytics: ProductivityAnalytics): boolean => {
  const hasCreated = analytics.overview.totalCreated > 0;
  const hasCompleted = analytics.overview.totalCompleted > 0;
  const hasOverdue = analytics.overdue.overdueCount > 0;
  return !hasCreated && !hasCompleted && !hasOverdue;
};

const buildLinePath = (
  points: number[],
  width: number,
  height: number,
  maxValue: number
): string => {
  if (points.length === 0) return '';

  const drawableWidth = width - chartPadding.left - chartPadding.right;
  const drawableHeight = height - chartPadding.top - chartPadding.bottom;
  const divisor = Math.max(points.length - 1, 1);

  return points
    .map((value, index) => {
      const x = chartPadding.left + (drawableWidth * index) / divisor;
      const normalizedY = maxValue === 0 ? 0 : value / maxValue;
      const y = chartPadding.top + drawableHeight - normalizedY * drawableHeight;
      return `${index === 0 ? 'M' : 'L'} ${x} ${y}`;
    })
    .join(' ');
};

const getInsight = (analytics: ProductivityAnalytics): string => {
  if (analytics.overdue.overdueCount > 0) {
    return `You have ${analytics.overdue.overdueCount} overdue task${analytics.overdue.overdueCount === 1 ? '' : 's'}. Prioritize those first.`;
  }

  if (analytics.overview.completionRate >= 70) {
    return 'Strong momentum. You are completing most of the work you create.';
  }

  if (analytics.overview.completionRate >= 40) {
    return 'Steady progress. Reducing in-progress tasks can improve throughput.';
  }

  return 'Your completion rate is low. Try creating fewer tasks and closing work daily.';
};

const getEncouragement = (
  analytics: ProductivityAnalytics,
  trendData: { createdCounts: number[]; completedCounts: number[] },
): string => {
  const createdSum = trendData.createdCounts.reduce((acc, value) => acc + value, 0);
  const completedSum = trendData.completedCounts.reduce((acc, value) => acc + value, 0);
  const rate = analytics.overview.completionRate;
  const overdueCount = analytics.overdue.overdueCount;

  if (completedSum === 0 && createdSum === 0) {
    return 'Once tasks start moving, this screen will turn into your weekly confidence check-in.';
  }

  if (rate >= 80 && overdueCount === 0) {
    return 'Excellent execution. You are turning plans into finished work with very little drag.';
  }

  if (rate >= 60) {
    return 'Solid momentum. Keep the daily finish habit and your completion pace will keep climbing.';
  }

  if (rate >= 35) {
    return 'Progress is building. Closing one more task per session will compound quickly.';
  }

  return 'Momentum is still forming. Focus on a smaller active list and aim for one clear finish today.';
};

const computeStreakStats = (completedCounts: number[]) => {
  const totalPeriods = completedCounts.length;
  const completedPeriods = completedCounts.filter((count) => count > 0).length;
  const hasActivity = completedPeriods > 0;

  let currentStreak = 0;
  for (let i = completedCounts.length - 1; i >= 0; i -= 1) {
    if (completedCounts[i] > 0) {
      currentStreak += 1;
    } else {
      break;
    }
  }

  let bestStreak = 0;
  let running = 0;
  completedCounts.forEach((count) => {
    if (count > 0) {
      running += 1;
      if (running > bestStreak) {
        bestStreak = running;
      }
    } else {
      running = 0;
    }
  });

  const recentWindow = completedCounts.slice(-7).map((count) => count > 0);
  const latestCompleted = completedCounts.length > 0 && completedCounts[completedCounts.length - 1] > 0;
  const consistencyRate = totalPeriods === 0 ? 0 : (completedPeriods / totalPeriods) * 100;

  return {
    hasActivity,
    totalPeriods,
    completedPeriods,
    currentStreak,
    bestStreak,
    recentWindow,
    latestCompleted,
    consistencyRate,
  };
};

export default function AnalyticsScreen({ navigation, onSessionExpired }: any) {
  const { colors } = useTheme();
  const screenWidth = Dimensions.get('window').width;
  const chartWidth = screenWidth - 56;

  const [period, setPeriod] = useState<AnalyticsPeriod>('day');
  const [analytics, setAnalytics] = useState<ProductivityAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadAnalytics = useCallback(async (silent = false) => {
    try {
      if (silent) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setError(null);

      const payload = await getProductivityAnalytics({ period });
      setAnalytics(payload);
    } catch (err) {
      if (await handleUnauthorizedIfNeeded({ error: err, source: 'AnalyticsScreen.loadAnalytics', onSessionExpired })) {
        return;
      }

      const message = err instanceof ApiError ? err.message : 'Could not load analytics right now.';
      setError(message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [onSessionExpired, period]);

  useFocusEffect(
    useCallback(() => {
      loadAnalytics();
    }, [loadAnalytics])
  );

  const trendData = useMemo(() => {
    const created = analytics?.trends.created || [];
    const completed = analytics?.trends.completed || [];

    const maxPoints = period === 'week' ? 10 : 12;
    const createdWindow = created.slice(-maxPoints);
    const completedWindow = completed.slice(-maxPoints);

    const createdCounts = createdWindow.map((item) => item.count);
    const completedCounts = completedWindow.map((item) => item.count);
    const max = Math.max(1, ...createdCounts, ...completedCounts);

    return {
      created: createdWindow,
      completed: completedWindow,
      createdCounts,
      completedCounts,
      max,
    };
  }, [analytics, period]);

  const performanceStats = useMemo(() => {
    if (!analytics) {
      return {
        onTimeRate: 0,
        onTimeTotal: 0,
      };
    }

    const onTimeTotal = analytics.overdue.onTimeCount + analytics.overdue.lateCount;
    const onTimeRate = onTimeTotal === 0 ? 0 : (analytics.overdue.onTimeCount / onTimeTotal) * 100;

    return {
      onTimeRate,
      onTimeTotal,
    };
  }, [analytics]);

  const streakStats = useMemo(() => computeStreakStats(trendData.completedCounts), [trendData.completedCounts]);

  const renderHeader = () => (
    <View style={[styles.header, { borderBottomColor: colors.border, backgroundColor: colors.surface }]}>
      <TouchableOpacity style={styles.headerBtn} onPress={() => navigation.goBack()}>
        <MaterialIcons name="arrow-back" size={24} color={colors.text} />
      </TouchableOpacity>
      <Text style={[styles.headerTitle, { color: colors.text }]}>Analytics</Text>
      <TouchableOpacity style={styles.headerBtn} onPress={() => loadAnalytics(true)}>
        {refreshing ? (
          <ActivityIndicator size="small" color={colors.primary} />
        ) : (
          <MaterialIcons name="refresh" size={22} color={colors.primary} />
        )}
      </TouchableOpacity>
    </View>
  );

  if (loading) {
    return (
      <ScreenWrapper withHorizontalPadding={false}>
        {renderHeader()}
        <View style={styles.centerState}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.stateText, { color: colors.mutedText }]}>Loading analytics...</Text>
        </View>
      </ScreenWrapper>
    );
  }

  if (error) {
    return (
      <ScreenWrapper withHorizontalPadding={false}>
        {renderHeader()}
        <View style={styles.centerState}>
          <MaterialIcons name="error-outline" size={44} color={colors.danger} />
          <Text style={[styles.stateTitle, { color: colors.text }]}>Could not load analytics</Text>
          <Text style={[styles.stateText, { color: colors.mutedText }]}>{error}</Text>
          <AppButton title="Retry" onPress={() => loadAnalytics()} style={styles.retryButton} />
        </View>
      </ScreenWrapper>
    );
  }

  if (!analytics) {
    return null;
  }

  const isEmpty = hasNoAnalyticsData(analytics);

  return (
    <ScreenWrapper withHorizontalPadding={false}>
      {renderHeader()}
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.periodTabs}>
          {PERIOD_OPTIONS.map((option) => {
            const active = option === period;
            return (
              <TouchableOpacity
                key={option}
                style={[
                  styles.periodTab,
                  {
                    backgroundColor: active ? colors.primary : colors.surface,
                    borderColor: active ? colors.primary : colors.border,
                    shadowColor: active ? colors.primary : 'transparent',
                    shadowOpacity: active ? 0.25 : 0,
                    shadowOffset: { width: 0, height: 3 },
                    shadowRadius: 6,
                    elevation: active ? 3 : 0,
                  },
                ]}
                onPress={() => setPeriod(option)}
                activeOpacity={0.8}
              >
                <Text style={[styles.periodTabText, { color: active ? '#FFFFFF' : colors.mutedText }]}>
                  {option === 'day' ? 'Daily' : 'Weekly'}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <Text style={[styles.windowText, { color: colors.mutedText }]}>
          {formatDateWindow(analytics.range.startDate, analytics.range.endDate)}
        </Text>

        <View style={[styles.reinforcementCard, { backgroundColor: `${colors.primary}12`, borderColor: `${colors.primary}2B` }]}> 
          <View style={[styles.reinforcementIconWrap, { backgroundColor: `${colors.primary}1F` }]}> 
            <MaterialIcons name="insights" size={18} color={colors.primary} />
          </View>
          <View style={styles.reinforcementBody}>
            <Text style={[styles.reinforcementTitle, { color: colors.text }]}>Your momentum snapshot</Text>
            <Text style={[styles.reinforcementText, { color: colors.mutedText }]}>
              {getEncouragement(analytics, trendData)}
            </Text>
          </View>
        </View>

        <SectionCard title="Overview" subtitle="How your effort translated into outcomes" colors={colors}>
          <View style={styles.summaryGrid}>
            <KpiCard label="Completion Rate" value={formatPercent(analytics.overview.completionRate)} icon="task-alt" colors={colors} />
            <KpiCard label="Tasks Created" value={String(analytics.overview.totalCreated)} icon="add-chart" colors={colors} />
            <KpiCard label="Tasks Completed" value={String(analytics.overview.totalCompleted)} icon="check-circle" colors={colors} />
            <KpiCard label="Overdue Open" value={String(analytics.overdue.overdueCount)} icon="warning" colors={colors} danger />
          </View>
          <Text style={[styles.insightText, { color: colors.text }]}>{getInsight(analytics)}</Text>
        </SectionCard>

        {isEmpty ? (
          <View style={[styles.emptyCard, { backgroundColor: colors.surface, borderColor: colors.border }]}> 
            <MaterialIcons name="insights" size={34} color={colors.primary} />
            <Text style={[styles.emptyTitle, { color: colors.text }]}>No analytics yet</Text>
            <Text style={[styles.emptyBody, { color: colors.mutedText }]}>Create and complete tasks to unlock trend and performance insights.</Text>
          </View>
        ) : (
          <>
            <SectionCard title="Trends" subtitle="Created vs completed over the selected window" colors={colors}>
              <TrendChart
                created={trendData.created}
                completed={trendData.completed}
                createdCounts={trendData.createdCounts}
                completedCounts={trendData.completedCounts}
                max={trendData.max}
                width={chartWidth}
                colors={colors}
              />
              <View style={styles.legendRow}>
                <LegendDot color={colors.primary} label="Completed" textColor={colors.mutedText} />
                <LegendDot color={colors.mutedText} label="Created" textColor={colors.mutedText} />
              </View>
            </SectionCard>

            <SectionCard title="Consistency Streak" subtitle="A quick pulse of your follow-through" colors={colors}>
              {streakStats.hasActivity ? (
                <>
                  <View style={[styles.streakHero, { backgroundColor: `${colors.primary}10`, borderColor: `${colors.primary}35` }]}> 
                    <View style={[styles.streakHeroIconWrap, { backgroundColor: `${colors.primary}1F` }]}> 
                      <MaterialIcons name="local-fire-department" size={18} color={colors.primary} />
                    </View>
                    <View style={styles.streakHeroBody}>
                      <Text style={[styles.streakHeroValue, { color: colors.text }]}>{streakStats.currentStreak}</Text>
                      <Text style={[styles.streakHeroLabel, { color: colors.mutedText }]}>current streak</Text>
                    </View>
                    <View style={[styles.streakStatusPill, { backgroundColor: streakStats.latestCompleted ? `${colors.success}22` : `${colors.border}90` }]}> 
                      <Text style={[styles.streakStatusText, { color: streakStats.latestCompleted ? colors.success : colors.mutedText }]}> 
                        {streakStats.latestCompleted ? `On track this ${period}` : `No completion yet this ${period}`}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.streakMetaRow}>
                    <View style={[styles.streakMetaCard, { borderColor: colors.border, backgroundColor: colors.background }]}> 
                      <Text style={[styles.streakMetaLabel, { color: colors.mutedText }]}>Best streak</Text>
                      <Text style={[styles.streakMetaValue, { color: colors.text }]}>{streakStats.bestStreak}</Text>
                    </View>
                    <View style={[styles.streakMetaCard, { borderColor: colors.border, backgroundColor: colors.background }]}> 
                      <Text style={[styles.streakMetaLabel, { color: colors.mutedText }]}>Consistency</Text>
                      <Text style={[styles.streakMetaValue, { color: colors.text }]}>{formatPercent(streakStats.consistencyRate)}</Text>
                    </View>
                  </View>

                  <View style={styles.streakMiniTrack}>
                    {streakStats.recentWindow.map((isComplete, index) => (
                      <View
                        key={`streak-dot-${index}`}
                        style={[
                          styles.streakMiniDot,
                          {
                            backgroundColor: isComplete ? colors.primary : `${colors.border}CC`,
                            borderColor: isComplete ? `${colors.primary}66` : `${colors.border}CC`,
                          },
                        ]}
                      />
                    ))}
                  </View>
                  <Text style={[styles.streakMiniCaption, { color: colors.mutedText }]}>Recent completion consistency</Text>
                </>
              ) : (
                <View style={[styles.streakEmptyState, { backgroundColor: colors.background, borderColor: colors.border }]}> 
                  <MaterialIcons name="local-fire-department" size={20} color={colors.primary} />
                  <View style={styles.streakEmptyBody}>
                    <Text style={[styles.streakEmptyTitle, { color: colors.text }]}>Start your streak</Text>
                    <Text style={[styles.streakEmptyText, { color: colors.mutedText }]}>Complete a task this {period} to begin building consistency.</Text>
                  </View>
                </View>
              )}

              <Text style={[styles.streakSupportText, { color: colors.mutedText }]}> 
                {streakStats.hasActivity
                  ? `Completed in ${streakStats.completedPeriods} of ${streakStats.totalPeriods} recent ${period === 'day' ? 'days' : 'weeks'}.`
                  : `Your consistency view appears as soon as completions are recorded.`}
              </Text>
            </SectionCard>

            <SectionCard title="Performance" subtitle="Execution quality and consistency" colors={colors}>
              <View style={styles.performanceRow}>
                <PerformanceMetric label="Avg completion time" value={formatHours(analytics.productivity.avgCompletionTimeHours)} colors={colors} />
                <PerformanceMetric label="Completed in range" value={String(analytics.productivity.tasksCompletedInRange)} colors={colors} />
              </View>
              <View style={styles.performanceRow}>
                <PerformanceMetric label="On-time completion" value={performanceStats.onTimeTotal === 0 ? '--' : formatPercent(performanceStats.onTimeRate)} colors={colors} />
                <PerformanceMetric label="Completed late" value={String(analytics.overdue.lateCount)} colors={colors} />
              </View>
            </SectionCard>
          </>
        )}
      </ScrollView>
    </ScreenWrapper>
  );
}

function SectionCard({
  title,
  subtitle,
  children,
  colors,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
  colors: any;
}) {
  return (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={styles.cardHeader}>
        <Text style={[styles.cardTitle, { color: colors.text }]}>{title}</Text>
        <Text style={[styles.cardSubtitle, { color: colors.mutedText }]}>{subtitle}</Text>
      </View>
      {children}
    </View>
  );
}

function KpiCard({
  label,
  value,
  icon,
  colors,
  danger,
}: {
  label: string;
  value: string;
  icon: keyof typeof MaterialIcons.glyphMap;
  colors: any;
  danger?: boolean;
}) {
  return (
    <View style={[styles.kpiCard, { borderColor: colors.border, backgroundColor: colors.surface }]}> 
      <View style={[styles.kpiIconWrap, { backgroundColor: colors.background }]}> 
        <MaterialIcons name={icon} size={18} color={danger ? colors.danger : colors.primary} />
      </View>
      <Text style={[styles.kpiLabel, { color: colors.mutedText }]}>{label}</Text>
      <Text style={[styles.kpiValue, { color: danger ? colors.danger : colors.text }]}>{value}</Text>
    </View>
  );
}

function PerformanceMetric({
  label,
  value,
  colors,
}: {
  label: string;
  value: string;
  colors: any;
}) {
  return (
    <View style={[styles.performanceCard, { borderColor: colors.border, backgroundColor: colors.background }]}> 
      <Text style={[styles.performanceLabel, { color: colors.mutedText }]}>{label}</Text>
      <Text style={[styles.performanceValue, { color: colors.text }]}>{value}</Text>
    </View>
  );
}

function LegendDot({ color, label, textColor }: { color: string; label: string; textColor: string }) {
  return (
    <View style={styles.legendItem}>
      <View style={[styles.legendDot, { backgroundColor: color }]} />
      <Text style={[styles.legendText, { color: textColor }]}>{label}</Text>
    </View>
  );
}

function TrendChart({
  created,
  completed,
  createdCounts,
  completedCounts,
  max,
  width,
  colors,
}: {
  created: AnalyticsTrendPoint[];
  completed: AnalyticsTrendPoint[];
  createdCounts: number[];
  completedCounts: number[];
  max: number;
  width: number;
  colors: any;
}) {
  const labels = created.length > 0 ? created : completed;

  return (
    <Svg width={width} height={chartHeight}>
      {[0, 1, 2, 3].map((index) => {
        const y = chartPadding.top + ((chartHeight - chartPadding.top - chartPadding.bottom) / 3) * index;
        return (
          <Line
            key={`grid-${index}`}
            x1={chartPadding.left}
            y1={y}
            x2={width - chartPadding.right}
            y2={y}
            stroke={colors.border}
            strokeWidth={1}
          />
        );
      })}

      <Path
        d={buildLinePath(createdCounts, width, chartHeight, max)}
        stroke={colors.mutedText}
        strokeWidth={2}
        fill="none"
      />
      <Path
        d={buildLinePath(completedCounts, width, chartHeight, max)}
        stroke={colors.primary}
        strokeWidth={3}
        fill="none"
      />

      {labels.map((point, index) => {
        const x = chartPadding.left + ((width - chartPadding.left - chartPadding.right) * index) / Math.max(labels.length - 1, 1);
        return (
          <SvgText
            key={`${point.periodStart}-label`}
            x={x}
            y={chartHeight - 8}
            fill={colors.mutedText}
            fontSize="10"
            textAnchor="middle"
          >
            {point.label}
          </SvgText>
        );
      })}
    </Svg>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 56,
  },
  periodTabs: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 6,
  },
  periodTab: {
    borderWidth: 1,
    borderRadius: 99,
    paddingVertical: 10,
    paddingHorizontal: 18,
  },
  periodTabText: {
    fontSize: 13,
    fontWeight: '700',
  },
  windowText: {
    fontSize: 12,
    marginTop: 8,
    marginBottom: 12,
    letterSpacing: 0.2,
  },
  reinforcementCard: {
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 14,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  reinforcementIconWrap: {
    width: 30,
    height: 30,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  reinforcementBody: {
    flex: 1,
  },
  reinforcementTitle: {
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 4,
  },
  reinforcementText: {
    fontSize: 13,
    lineHeight: 19,
  },
  card: {
    borderWidth: 1,
    borderRadius: 18,
    marginBottom: 14,
    paddingVertical: 15,
    paddingHorizontal: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 2,
  },
  cardHeader: {
    marginBottom: 13,
  },
  cardTitle: {
    fontSize: 17,
    fontWeight: '700',
  },
  cardSubtitle: {
    fontSize: 12,
    marginTop: 3,
    lineHeight: 17,
  },
  summaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 8,
  },
  kpiCard: {
    width: '48.5%',
    borderRadius: 13,
    borderWidth: 1,
    padding: 12,
    minHeight: 96,
  },
  kpiIconWrap: {
    width: 30,
    height: 30,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  kpiLabel: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.2,
    marginBottom: 4,
  },
  kpiValue: {
    fontSize: 24,
    fontWeight: '700',
  },
  insightText: {
    marginTop: 12,
    fontSize: 13,
    lineHeight: 20,
  },
  streakHero: {
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },
  streakHeroIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  streakHeroBody: {
    flex: 1,
  },
  streakHeroValue: {
    fontSize: 30,
    fontWeight: '800',
    lineHeight: 32,
  },
  streakHeroLabel: {
    marginTop: 2,
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  streakStatusPill: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  streakStatusText: {
    fontSize: 11,
    fontWeight: '700',
  },
  streakMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 9,
    marginBottom: 10,
    gap: 8,
  },
  streakMetaCard: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 11,
    paddingHorizontal: 10,
    paddingVertical: 9,
  },
  streakMetaLabel: {
    fontSize: 11,
    fontWeight: '600',
    marginBottom: 2,
  },
  streakMetaValue: {
    fontSize: 19,
    fontWeight: '700',
  },
  streakMiniTrack: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  streakMiniDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 1,
  },
  streakMiniCaption: {
    marginTop: 6,
    fontSize: 11,
    fontWeight: '500',
  },
  streakEmptyState: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },
  streakEmptyBody: {
    marginLeft: 10,
    flex: 1,
  },
  streakEmptyTitle: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 2,
  },
  streakEmptyText: {
    fontSize: 12,
    lineHeight: 17,
  },
  streakSupportText: {
    marginTop: 10,
    fontSize: 12,
    lineHeight: 18,
  },
  performanceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  performanceCard: {
    width: '48.5%',
    borderWidth: 1,
    borderRadius: 11,
    padding: 11,
  },
  performanceLabel: {
    fontSize: 12,
  },
  performanceValue: {
    marginTop: 4,
    fontSize: 18,
    fontWeight: '700',
  },
  legendRow: {
    flexDirection: 'row',
    gap: 16,
    marginTop: 4,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 6,
  },
  legendText: {
    fontSize: 12,
    fontWeight: '500',
  },
  emptyCard: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
    marginTop: 8,
  },
  emptyTitle: {
    marginTop: 10,
    fontSize: 16,
    fontWeight: '700',
  },
  emptyBody: {
    marginTop: 8,
    textAlign: 'center',
    fontSize: 14,
    lineHeight: 20,
  },
  centerState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
  },
  stateTitle: {
    marginTop: 10,
    fontSize: 17,
    fontWeight: '700',
  },
  stateText: {
    marginTop: 8,
    textAlign: 'center',
    fontSize: 14,
    lineHeight: 20,
  },
  retryButton: {
    marginTop: 16,
    minWidth: 140,
  },
});
