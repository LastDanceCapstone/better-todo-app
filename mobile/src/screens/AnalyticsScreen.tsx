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

const PERIOD_OPTIONS: AnalyticsPeriod[] = ['day', 'week'];

const STATUS_ORDER: Array<keyof ProductivityAnalytics['tasksByStatus']> = [
  'TODO',
  'IN_PROGRESS',
  'COMPLETED',
  'CANCELLED',
];

const PRIORITY_ORDER: Array<keyof ProductivityAnalytics['tasksByPriority']> = [
  'LOW',
  'MEDIUM',
  'HIGH',
  'URGENT',
];

const STATUS_LABELS: Record<keyof ProductivityAnalytics['tasksByStatus'], string> = {
  TODO: 'To Do',
  IN_PROGRESS: 'In Progress',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
};

const PRIORITY_LABELS: Record<keyof ProductivityAnalytics['tasksByPriority'], string> = {
  LOW: 'Low',
  MEDIUM: 'Medium',
  HIGH: 'High',
  URGENT: 'Urgent',
};

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

export default function AnalyticsScreen({ navigation }: any) {
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
      const message = err instanceof ApiError ? err.message : 'Could not load analytics right now.';
      setError(message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [period]);

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

        <SectionCard title="Overview" subtitle="Am I completing my tasks?" colors={colors}>
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
            <SectionCard title="Trends" subtitle="What is my workload trend?" colors={colors}>
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

            <SectionCard title="Distribution" subtitle="What is my current task mix?" colors={colors}>
              <Text style={[styles.subsectionTitle, { color: colors.text }]}>By status</Text>
              {STATUS_ORDER.map((status) => (
                <DistributionRow
                  key={status}
                  label={STATUS_LABELS[status]}
                  value={analytics.tasksByStatus[status]}
                  total={Math.max(analytics.overview.totalCreated, 1)}
                  colors={colors}
                />
              ))}

              <Text style={[styles.subsectionTitle, { color: colors.text, marginTop: 10 }]}>By priority</Text>
              {PRIORITY_ORDER.map((priority) => (
                <DistributionRow
                  key={priority}
                  label={PRIORITY_LABELS[priority]}
                  value={analytics.tasksByPriority[priority]}
                  total={Math.max(analytics.overview.totalCreated, 1)}
                  colors={colors}
                />
              ))}
            </SectionCard>

            <SectionCard title="Performance" subtitle="How productive am I over time?" colors={colors}>
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

function DistributionRow({
  label,
  value,
  total,
  colors,
}: {
  label: string;
  value: number;
  total: number;
  colors: any;
}) {
  const width = Math.round((value / total) * 100);
  return (
    <View style={styles.distributionRow}>
      <View style={styles.distributionHeader}>
        <Text style={[styles.distributionLabel, { color: colors.text }]}>{label}</Text>
        <Text style={[styles.distributionMeta, { color: colors.mutedText }]}>
          {value} ({width}%)
        </Text>
      </View>
      <View style={[styles.progressTrack, { backgroundColor: colors.background }]}> 
        <View style={[styles.progressFill, { width: `${Math.max(0, Math.min(width, 100))}%`, backgroundColor: colors.primary }]} />
      </View>
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
    paddingTop: 16,
    paddingBottom: 48,
  },
  periodTabs: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 4,
  },
  periodTab: {
    borderWidth: 1,
    borderRadius: 99,
    paddingVertical: 9,
    paddingHorizontal: 18,
  },
  periodTabText: {
    fontSize: 13,
    fontWeight: '700',
  },
  windowText: {
    fontSize: 12,
    marginTop: 10,
    marginBottom: 14,
    letterSpacing: 0.2,
  },
  card: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 16,
    marginBottom: 14,
    paddingVertical: 14,
    paddingHorizontal: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  cardHeader: {
    marginBottom: 12,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  cardSubtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  summaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 8,
  },
  kpiCard: {
    width: '48.5%',
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
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
    fontSize: 22,
    fontWeight: '700',
  },
  insightText: {
    marginTop: 12,
    fontSize: 13,
    lineHeight: 20,
  },
  subsectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 8,
  },
  distributionRow: {
    marginBottom: 8,
  },
  distributionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  distributionLabel: {
    fontSize: 13,
    fontWeight: '600',
  },
  distributionMeta: {
    fontSize: 12,
  },
  progressTrack: {
    height: 8,
    borderRadius: 99,
    overflow: 'hidden',
  },
  progressFill: {
    height: 8,
    borderRadius: 99,
  },
  performanceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  performanceCard: {
    width: '48.5%',
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 10,
    padding: 10,
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
