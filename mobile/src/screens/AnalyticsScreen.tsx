import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  Dimensions,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { MaterialIcons } from '@expo/vector-icons';
import Svg, { Line, Path, Rect, Text as SvgText } from 'react-native-svg';
import { useTheme } from '../theme';
import ScreenWrapper from '../components/ScreenWrapper';
import AppButton from '../components/AppButton';
import {
  ApiError,
  getProductivityAnalytics,
  ProductivityAnalytics,
  ProductivityHeatmapPoint,
  ProductivityTrendPoint,
  TaskCategoryPoint,
} from '../config/api';

const DAY_ORDER = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;
const HEATMAP_HOUR_BUCKETS = [0, 4, 8, 12, 16, 20] as const;

type DashboardSummary = {
  completionRateText: string;
  tasksThisWeekText: string;
  mostProductiveHourText: string;
};

const chartHeight = 170;
const chartPadding = { left: 32, right: 12, top: 14, bottom: 26 };

const getDayIndex = (day: ProductivityHeatmapPoint['day']): number => {
  return DAY_ORDER.indexOf(day);
};

const getStartOfUtcWeekMonday = (reference: Date): Date => {
  const day = reference.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  return new Date(Date.UTC(reference.getUTCFullYear(), reference.getUTCMonth(), reference.getUTCDate() + diff));
};

const mapUtcHeatmapPointToLocal = (
  entry: ProductivityHeatmapPoint,
  weekStartUtc: Date
): { day: ProductivityHeatmapPoint['day']; hour: number } | null => {
  const dayIndex = getDayIndex(entry.day);
  if (dayIndex < 0) return null;

  const utcInstant = new Date(weekStartUtc);
  utcInstant.setUTCDate(weekStartUtc.getUTCDate() + dayIndex);
  utcInstant.setUTCHours(entry.hour, 0, 0, 0);

  const localDay = DAY_ORDER[(utcInstant.getDay() + 6) % 7];
  const localHour = utcInstant.getHours();

  return { day: localDay, hour: localHour };
};

const formatTrendDate = (dateString: string): string => {
  const date = new Date(dateString);
  return `${date.getMonth() + 1}/${date.getDate()}`;
};

const toHourLabel = (hourString: string): string => {
  const [rawHour] = hourString.split(':');
  const hour = Number(rawHour);
  if (Number.isNaN(hour)) return hourString;

  // Backend provides UTC hour strings; convert using today's date so DST/current local offset is respected.
  const now = new Date();
  const sampleUtc = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), hour, 0, 0));
  return sampleUtc.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
};

const formatPercent = (value: number): string => `${Math.round(value * 100)}%`;

const hasMeaningfulData = (analytics: ProductivityAnalytics): boolean => {
  return (
    analytics.tasks_completed_this_week > 0 ||
    analytics.completion_rate > 0 ||
    analytics.productivity_trends.some((point) => point.completed > 0 || point.created > 0) ||
    analytics.productivity_heatmap.some((point) => point.count > 0)
  );
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

const normalizeHeatmap = (source: ProductivityHeatmapPoint[]): Record<string, number> => {
  const map: Record<string, number> = {};
  const weekStartUtc = getStartOfUtcWeekMonday(new Date());

  source.forEach((entry) => {
    const localPoint = mapUtcHeatmapPointToLocal(entry, weekStartUtc);
    if (!localPoint) return;

    // The UI heatmap displays 4-hour columns, so aggregate all source hours into those buckets.
    const bucketHour = Math.floor(localPoint.hour / 4) * 4;
    const key = `${localPoint.day}-${bucketHour}`;
    map[key] = (map[key] || 0) + entry.count;
  });
  return map;
};

const getHeatmapMaxCount = (normalizedMap: Record<string, number>): number => {
  return Object.values(normalizedMap).reduce((max, count) => Math.max(max, count), 0);
};

const intensityColor = (count: number, max: number, surface: string, primary: string): string => {
  if (count <= 0 || max <= 0) return surface;
  const ratio = count / max;
  if (ratio <= 0.25) return `${primary}33`;
  if (ratio <= 0.5) return `${primary}66`;
  if (ratio <= 0.75) return `${primary}99`;
  return primary;
};

const getTrendWindow = (points: ProductivityTrendPoint[]): ProductivityTrendPoint[] => {
  if (points.length <= 7) return points;
  return points.slice(points.length - 7);
};

export default function AnalyticsScreen({ navigation }: any) {
  const { colors } = useTheme();
  const screenWidth = Dimensions.get('window').width;
  // Keep charts inside card bounds: outer padding (16*2) + card horizontal padding (12*2).
  const chartWidth = screenWidth - 56;

  const [analytics, setAnalytics] = useState<ProductivityAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadAnalytics = async (silent = false) => {
    try {
      if (silent) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setError(null);

      const data = await getProductivityAnalytics();
      setAnalytics(data);
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : 'Could not load analytics right now.';
      setError(message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadAnalytics();
    }, [])
  );

  const summary: DashboardSummary | null = useMemo(() => {
    if (!analytics) return null;
    return {
      completionRateText: formatPercent(analytics.completion_rate),
      tasksThisWeekText: String(analytics.tasks_completed_this_week),
      mostProductiveHourText: toHourLabel(analytics.most_productive_hour),
    };
  }, [analytics]);

  const trendData = useMemo(() => {
    const points = getTrendWindow(analytics?.productivity_trends || []);
    const completed = points.map((p) => p.completed);
    const created = points.map((p) => p.created);
    const max = Math.max(1, ...completed, ...created);
    return { points, completed, created, max };
  }, [analytics]);

  const categoryData = useMemo(() => {
    const categories = analytics?.task_categories || [];
    return { categories };
  }, [analytics]);

  const heatmapData = useMemo(() => {
    const points = analytics?.productivity_heatmap || [];
    const normalized = normalizeHeatmap(points);
    const maxCount = getHeatmapMaxCount(normalized);
    return { normalized, maxCount };
  }, [analytics]);

  if (loading) {
    return (
      <ScreenWrapper withHorizontalPadding={false}>
        <View style={[styles.header, { borderBottomColor: colors.border, backgroundColor: colors.surface }]}>
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
            <MaterialIcons name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.text }]}>Analytics</Text>
          <View style={styles.backButton} />
        </View>
        <View style={styles.centerState}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.stateText, { color: colors.mutedText }]}>Loading productivity insights...</Text>
        </View>
      </ScreenWrapper>
    );
  }

  if (error) {
    return (
      <ScreenWrapper withHorizontalPadding={false}>
        <View style={[styles.header, { borderBottomColor: colors.border, backgroundColor: colors.surface }]}>
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
            <MaterialIcons name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.text }]}>Analytics</Text>
          <View style={styles.backButton} />
        </View>
        <View style={styles.centerState}>
          <MaterialIcons name="error-outline" size={46} color={colors.danger} />
          <Text style={[styles.stateTitle, { color: colors.text }]}>Couldn’t load analytics</Text>
          <Text style={[styles.stateText, { color: colors.mutedText }]}>{error}</Text>
          <AppButton
            title="Retry"
            onPress={() => loadAnalytics()}
            style={styles.retryButton}
          />
        </View>
      </ScreenWrapper>
    );
  }

  if (!analytics || !summary) {
    return null;
  }

  const empty = !hasMeaningfulData(analytics);

  return (
    <ScreenWrapper withHorizontalPadding={false}>
      <View style={[styles.header, { borderBottomColor: colors.border, backgroundColor: colors.surface }]}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <MaterialIcons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Analytics</Text>
        <TouchableOpacity style={styles.backButton} onPress={() => loadAnalytics(true)}>
          {refreshing ? (
            <ActivityIndicator size="small" color={colors.primary} />
          ) : (
            <MaterialIcons name="refresh" size={22} color={colors.primary} />
          )}
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <Text style={[styles.subtitle, { color: colors.mutedText }]}>See how your productivity is trending</Text>

        <View style={styles.summaryGrid}>
          <SummaryCard
            icon="task-alt"
            label="Completion Rate"
            value={summary.completionRateText}
            colors={colors}
          />
          <SummaryCard
            icon="check-circle"
            label="Completed This Week"
            value={summary.tasksThisWeekText}
            colors={colors}
          />
          <SummaryCard
            icon="schedule"
            label="Most Productive Hour"
            value={summary.mostProductiveHourText}
            colors={colors}
            fullWidth
          />
        </View>

        {empty ? (
          <View style={[styles.emptyCard, { backgroundColor: colors.surface, borderColor: colors.border }]}> 
            <MaterialIcons name="insights" size={34} color={colors.primary} />
            <Text style={[styles.emptyTitle, { color: colors.text }]}>No productivity history yet</Text>
            <Text style={[styles.emptyBody, { color: colors.mutedText }]}>Complete a few tasks and come back to unlock trends and charts.</Text>
          </View>
        ) : (
          <>
            <AnalyticsCard title="Tasks Over Time" subtitle="Created vs completed (last 7 days)" colors={colors}>
              <Svg width={chartWidth} height={chartHeight}>
                {[0, 1, 2, 3].map((index) => {
                  const y =
                    chartPadding.top +
                    ((chartHeight - chartPadding.top - chartPadding.bottom) / 3) * index;
                  return (
                    <Line
                      key={`grid-${index}`}
                      x1={chartPadding.left}
                      y1={y}
                      x2={chartWidth - chartPadding.right}
                      y2={y}
                      stroke={colors.border}
                      strokeWidth={1}
                    />
                  );
                })}
                <Path
                  d={buildLinePath(trendData.created, chartWidth, chartHeight, trendData.max)}
                  stroke={colors.mutedText}
                  strokeWidth={2}
                  fill="none"
                />
                <Path
                  d={buildLinePath(trendData.completed, chartWidth, chartHeight, trendData.max)}
                  stroke={colors.primary}
                  strokeWidth={3}
                  fill="none"
                />
                {trendData.points.map((point, index) => {
                  const x =
                    chartPadding.left +
                    ((chartWidth - chartPadding.left - chartPadding.right) * index) /
                      Math.max(trendData.points.length - 1, 1);
                  return (
                    <SvgText
                      key={`${point.date}-x`}
                      x={x}
                      y={chartHeight - 8}
                      fill={colors.mutedText}
                      fontSize="10"
                      textAnchor="middle"
                    >
                      {formatTrendDate(point.date)}
                    </SvgText>
                  );
                })}
              </Svg>
              <View style={styles.legendRow}>
                <LegendDot color={colors.primary} label="Completed" textColor={colors.mutedText} />
                <LegendDot color={colors.mutedText} label="Created" textColor={colors.mutedText} />
              </View>
            </AnalyticsCard>

            <AnalyticsCard title="Task Categories" subtitle="Completion by category" colors={colors}>
              {categoryData.categories.length === 0 ? (
                <Text style={[styles.noDataText, { color: colors.mutedText }]}>No category data yet.</Text>
              ) : (
                categoryData.categories.map((item: TaskCategoryPoint) => {
                  const total = item.count || 1;
                  const completedRatio = item.completed / total;
                  const widthPct = Math.max(0, Math.min(100, Math.round(completedRatio * 100)));
                  return (
                    <View key={item.category} style={styles.categoryRow}>
                      <View style={styles.categoryHeader}>
                        <Text style={[styles.categoryLabel, { color: colors.text }]}>{item.category}</Text>
                        <Text style={[styles.categoryMeta, { color: colors.mutedText }]}>
                          {item.completed}/{item.count}
                        </Text>
                      </View>
                      <View style={[styles.progressTrack, { backgroundColor: colors.background }]}> 
                        <View
                          style={[
                            styles.progressFill,
                            { width: `${widthPct}%`, backgroundColor: colors.primary },
                          ]}
                        />
                      </View>
                    </View>
                  );
                })
              )}
            </AnalyticsCard>

            <AnalyticsCard title="Productivity Heatmap" subtitle="Completions by weekday and hour (local time)" colors={colors}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View>
                  <View style={styles.heatmapHeaderRow}>
                    <View style={styles.heatmapDayLabelWrap} />
                    {HEATMAP_HOUR_BUCKETS.map((hour) => (
                      <Text key={`hour-${hour}`} style={[styles.heatmapHourLabel, { color: colors.mutedText }]}>
                        {hour}
                      </Text>
                    ))}
                  </View>

                  {DAY_ORDER.map((day) => (
                    <View key={day} style={styles.heatmapRow}>
                      <View style={styles.heatmapDayLabelWrap}>
                        <Text style={[styles.heatmapDayLabel, { color: colors.mutedText }]}>{day}</Text>
                      </View>
                      {HEATMAP_HOUR_BUCKETS.map((hour) => {
                        const count = heatmapData.normalized[`${day}-${hour}`] || 0;
                        return (
                          <View
                            key={`${day}-${hour}`}
                            style={[
                              styles.heatmapCell,
                              {
                                backgroundColor: intensityColor(
                                  count,
                                  heatmapData.maxCount,
                                  colors.background,
                                  colors.primary
                                ),
                                borderColor: colors.border,
                              },
                            ]}
                          >
                            {count > 0 ? (
                              <Text style={[styles.heatmapCellText, { color: colors.text }]}>{count}</Text>
                            ) : null}
                          </View>
                        );
                      })}
                    </View>
                  ))}
                </View>
              </ScrollView>
            </AnalyticsCard>

            <AnalyticsCard title="Completed Tasks Per Day" subtitle="Recent daily output" colors={colors}>
              {(analytics.tasks_completed_per_day || []).length === 0 ? (
                <Text style={[styles.noDataText, { color: colors.mutedText }]}>No completed tasks yet.</Text>
              ) : (
                <MiniBars
                  data={analytics.tasks_completed_per_day.slice(-10)}
                  colors={colors}
                  width={chartWidth}
                />
              )}
            </AnalyticsCard>
          </>
        )}
      </ScrollView>
    </ScreenWrapper>
  );
}

function SummaryCard({
  icon,
  label,
  value,
  colors,
  fullWidth,
}: {
  icon: keyof typeof MaterialIcons.glyphMap;
  label: string;
  value: string;
  colors: any;
  fullWidth?: boolean;
}) {
  return (
    <View
      style={[
        styles.summaryCard,
        {
          backgroundColor: colors.surface,
          borderColor: colors.border,
          width: fullWidth ? '100%' : '48.5%',
        },
      ]}
    >
      <View style={[styles.summaryIconWrap, { backgroundColor: colors.background }]}> 
        <MaterialIcons name={icon} size={18} color={colors.primary} />
      </View>
      <Text style={[styles.summaryLabel, { color: colors.mutedText }]}>{label}</Text>
      <Text style={[styles.summaryValue, { color: colors.text }]}>{value}</Text>
    </View>
  );
}

function AnalyticsCard({
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
      <Text style={[styles.cardTitle, { color: colors.text }]}>{title}</Text>
      <Text style={[styles.cardSubtitle, { color: colors.mutedText }]}>{subtitle}</Text>
      {children}
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

function MiniBars({
  data,
  colors,
  width,
}: {
  data: Array<{ date: string; count: number }>;
  colors: any;
  width: number;
}) {
  const max = Math.max(1, ...data.map((d) => d.count));
  const barGap = 8;
  const barsAreaWidth = width - 12;
  const barWidth = Math.max(12, (barsAreaWidth - barGap * (data.length - 1)) / data.length);

  return (
    <Svg width={width} height={150}>
      {data.map((point, index) => {
        const height = (point.count / max) * 92;
        const x = 6 + index * (barWidth + barGap);
        const y = 104 - height;
        return (
          <React.Fragment key={`${point.date}-${index}`}>
            <Rect x={x} y={y} width={barWidth} height={height} rx={4} fill={colors.primary} />
            <SvgText
              x={x + barWidth / 2}
              y={118}
              fontSize="10"
              fill={colors.mutedText}
              textAnchor="middle"
            >
              {formatTrendDate(point.date)}
            </SvgText>
          </React.Fragment>
        );
      })}
    </Svg>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backButton: {
    width: 40,
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
    paddingBottom: 40,
  },
  subtitle: {
    fontSize: 14,
    marginBottom: 14,
  },
  summaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 16,
    gap: 10,
  },
  summaryCard: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    padding: 12,
    minHeight: 92,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 2,
  },
  summaryIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 7,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  summaryLabel: {
    fontSize: 12,
    marginBottom: 5,
    fontWeight: '500',
  },
  summaryValue: {
    fontSize: 22,
    fontWeight: '700',
  },
  card: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    marginBottom: 14,
    paddingVertical: 12,
    paddingHorizontal: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  cardSubtitle: {
    fontSize: 12,
    marginTop: 2,
    marginBottom: 10,
  },
  legendRow: {
    flexDirection: 'row',
    gap: 16,
    marginTop: 2,
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
  categoryRow: {
    marginBottom: 10,
  },
  categoryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 5,
  },
  categoryLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
  categoryMeta: {
    fontSize: 12,
    fontWeight: '500',
  },
  progressTrack: {
    height: 9,
    borderRadius: 99,
    overflow: 'hidden',
  },
  progressFill: {
    height: 9,
    borderRadius: 99,
  },
  heatmapHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  heatmapHourLabel: {
    width: 34,
    textAlign: 'center',
    fontSize: 10,
  },
  heatmapRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  heatmapDayLabelWrap: {
    width: 34,
    alignItems: 'flex-start',
  },
  heatmapDayLabel: {
    fontSize: 10,
    fontWeight: '600',
  },
  heatmapCell: {
    width: 30,
    height: 26,
    borderRadius: 7,
    borderWidth: StyleSheet.hairlineWidth,
    marginHorizontal: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heatmapCellText: {
    fontSize: 10,
    fontWeight: '700',
  },
  emptyCard: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    padding: 22,
    alignItems: 'center',
    marginTop: 12,
  },
  emptyTitle: {
    marginTop: 10,
    fontSize: 17,
    fontWeight: '700',
  },
  emptyBody: {
    marginTop: 7,
    fontSize: 14,
    textAlign: 'center',
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
  noDataText: {
    fontSize: 13,
    marginBottom: 2,
  },
});
