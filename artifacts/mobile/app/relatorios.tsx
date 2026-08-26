import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useGetMonthlyReport } from '@workspace/api-client-react';
import Colors from '@/constants/colors';
import { useColorScheme } from '@/hooks/useColorScheme';

const MONTH_NAMES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

const fmt = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

const fmtDate = (d: Date | string) =>
  new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });

export default function RelatoriosScreen() {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme];

  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);

  const { data: report, isLoading, refetch, isRefetching } = useGetMonthlyReport({ year, month });

  const prevMonth = () => {
    if (month === 1) { setMonth(12); setYear(y => y - 1); }
    else setMonth(m => m - 1);
  };
  const nextMonth = () => {
    const futureYear = month === 12 ? year + 1 : year;
    const futureMonth = month === 12 ? 1 : month + 1;
    if (new Date(futureYear, futureMonth - 1) > new Date(now.getFullYear(), now.getMonth())) return;
    if (month === 12) { setMonth(1); setYear(y => y + 1); }
    else setMonth(m => m + 1);
  };
  const isCurrentMonth = year === now.getFullYear() && month === now.getMonth() + 1;

  const conversionRate = report
    ? report.quotesSentCount > 0
      ? Math.round((report.quotesApprovedCount / report.quotesSentCount) * 100)
      : 0
    : 0;

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.background }]}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={theme.primary} />}
    >
      {/* Month picker */}
      <View style={[styles.monthPicker, { backgroundColor: theme.card, borderColor: theme.border }]}>
        <TouchableOpacity style={styles.monthBtn} onPress={prevMonth}>
          <Ionicons name="chevron-back" size={22} color={theme.primary} />
        </TouchableOpacity>
        <Text style={[styles.monthLabel, { color: theme.foreground }]}>
          {MONTH_NAMES[month - 1]} {year}
        </Text>
        <TouchableOpacity style={styles.monthBtn} onPress={nextMonth} disabled={isCurrentMonth}>
          <Ionicons name="chevron-forward" size={22} color={isCurrentMonth ? theme.border : theme.primary} />
        </TouchableOpacity>
      </View>

      {/* Stats grid */}
      <View style={styles.statsGrid}>
        <StatCard
          theme={theme}
          icon="cash"
          label="Receita"
          value={report ? fmt(report.revenue) : '—'}
          color={theme.primary}
        />
        <StatCard
          theme={theme}
          icon="checkmark-circle"
          label="O.S. pagas"
          value={String(report?.paidTasksCount ?? '—')}
          color="#8b5cf6"
        />
        <StatCard
          theme={theme}
          icon="clipboard"
          label="O.S. concluídas"
          value={String(report?.completedTasksCount ?? '—')}
          color="#22c55e"
        />
        <StatCard
          theme={theme}
          icon="document-text"
          label="Orç. enviados"
          value={String(report?.quotesSentCount ?? '—')}
          color="#3b82f6"
        />
        <StatCard
          theme={theme}
          icon="thumbs-up"
          label="Orç. aprovados"
          value={String(report?.quotesApprovedCount ?? '—')}
          color="#22c55e"
        />
        <StatCard
          theme={theme}
          icon="trending-up"
          label="Conversão"
          value={report ? `${conversionRate}%` : '—'}
          color="#f59e0b"
        />
      </View>

      {/* Paid tasks list */}
      {(report?.paidTasks?.length ?? 0) > 0 && (
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.mutedForeground }]}>ORDENS PAGAS NO MÊS</Text>
          <View style={[styles.listCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
            {report!.paidTasks.map((task, i) => (
              <View
                key={task.id}
                style={[
                  styles.taskRow,
                  i < report!.paidTasks.length - 1 && { borderBottomWidth: 1, borderBottomColor: theme.border },
                ]}
              >
                <View style={styles.taskMain}>
                  <Text style={[styles.taskTitle, { color: theme.foreground }]} numberOfLines={1}>
                    {task.title}
                  </Text>
                  {task.clientName && (
                    <Text style={[styles.taskClient, { color: theme.mutedForeground }]}>{task.clientName}</Text>
                  )}
                  <Text style={[styles.taskDate, { color: theme.mutedForeground }]}>
                    {fmtDate(task.paidAt)}
                  </Text>
                </View>
                <Text style={[styles.taskAmount, { color: '#8b5cf6' }]}>
                  {task.paidAmount != null ? fmt(task.paidAmount) : '—'}
                </Text>
              </View>
            ))}
            <View style={[styles.totalRow, { borderTopColor: theme.border }]}>
              <Text style={[styles.totalLabel, { color: theme.mutedForeground }]}>Total</Text>
              <Text style={[styles.totalValue, { color: theme.foreground }]}>
                {report ? fmt(report.revenue) : '—'}
              </Text>
            </View>
          </View>
        </View>
      )}

      {report && report.paidTasks.length === 0 && !isLoading && (
        <View style={styles.empty}>
          <Ionicons name="bar-chart-outline" size={48} color={theme.mutedForeground} />
          <Text style={[styles.emptyText, { color: theme.mutedForeground }]}>
            Nenhuma ordem paga em {MONTH_NAMES[month - 1].toLowerCase()}.
          </Text>
        </View>
      )}
    </ScrollView>
  );
}

function StatCard({
  theme,
  icon,
  label,
  value,
  color,
}: {
  theme: typeof Colors.light;
  icon: React.ComponentProps<typeof Ionicons>['name'];
  label: string;
  value: string;
  color: string;
}) {
  return (
    <View style={[styles.statCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
      <View style={[styles.statIcon, { backgroundColor: color + '18' }]}>
        <Ionicons name={icon} size={18} color={color} />
      </View>
      <Text style={[styles.statValue, { color: theme.foreground }]}>{value}</Text>
      <Text style={[styles.statLabel, { color: theme.mutedForeground }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16, paddingBottom: 40 },
  monthPicker: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 12,
    borderWidth: 1,
    paddingVertical: 4,
    paddingHorizontal: 8,
    marginBottom: 20,
  },
  monthBtn: { padding: 8 },
  monthLabel: { fontSize: 17, fontFamily: 'PlusJakartaSans_700Bold' },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 24 },
  statCard: {
    width: '47%',
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
    gap: 4,
  },
  statIcon: { width: 36, height: 36, borderRadius: 8, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  statValue: { fontSize: 22, fontFamily: 'PlusJakartaSans_700Bold' },
  statLabel: { fontSize: 12, fontFamily: 'PlusJakartaSans_400Regular' },
  section: { marginBottom: 24 },
  sectionTitle: { fontSize: 11, fontFamily: 'PlusJakartaSans_600SemiBold', letterSpacing: 0.8, marginBottom: 8 },
  listCard: { borderRadius: 12, borderWidth: 1, overflow: 'hidden' },
  taskRow: { flexDirection: 'row', alignItems: 'center', padding: 12, gap: 10 },
  taskMain: { flex: 1 },
  taskTitle: { fontSize: 14, fontFamily: 'PlusJakartaSans_600SemiBold', marginBottom: 2 },
  taskClient: { fontSize: 12, fontFamily: 'PlusJakartaSans_400Regular', marginBottom: 2 },
  taskDate: { fontSize: 11, fontFamily: 'PlusJakartaSans_400Regular' },
  taskAmount: { fontSize: 14, fontFamily: 'PlusJakartaSans_700Bold' },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 12,
    borderTopWidth: 1,
  },
  totalLabel: { fontSize: 14, fontFamily: 'PlusJakartaSans_500Medium' },
  totalValue: { fontSize: 16, fontFamily: 'PlusJakartaSans_700Bold' },
  empty: { alignItems: 'center', paddingVertical: 48, gap: 12 },
  emptyText: { fontSize: 14, fontFamily: 'PlusJakartaSans_400Regular' },
});
