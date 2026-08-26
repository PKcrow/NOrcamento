import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useListTasks } from '@workspace/api-client-react';
import Colors from '@/constants/colors';
import { useColorScheme } from '@/hooks/useColorScheme';

type TaskStatus = 'scheduled' | 'in_progress' | 'completed' | 'paid';

const STATUS_LABELS: Record<TaskStatus | 'all', string> = {
  all: 'Todos',
  scheduled: 'Agendada',
  in_progress: 'Em andamento',
  completed: 'Concluída',
  paid: 'Paga',
};
const STATUS_COLORS: Record<TaskStatus, string> = {
  scheduled: '#f59e0b',
  in_progress: '#3b82f6',
  completed: '#22c55e',
  paid: '#8b5cf6',
};

const fmt = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);
const timeRange = (task: { dueAt: string; endAt?: string | null }) => {
  const start = new Date(task.dueAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  if (!task.endAt) return `${start} · defina o término`;
  const end = new Date(task.endAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  return `${start} – ${end}`;
};

const DAY_NAMES = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const MONTH_NAMES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();
}

function MonthCalendar({
  theme,
  tasks,
  calYear,
  calMonth,
  selectedDate,
  onSelectDate,
  onPrev,
  onNext,
}: {
  theme: typeof Colors.light;
  tasks: any[];
  calYear: number;
  calMonth: number;
  selectedDate: Date | null;
  onSelectDate: (d: Date) => void;
  onPrev: () => void;
  onNext: () => void;
}) {
  const firstDay = new Date(calYear, calMonth, 1);
  const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
  const startWeekday = firstDay.getDay(); // 0=Sun

  const taskDates = new Set(
    tasks
      .filter(t => t.dueAt)
      .map(t => {
        const d = new Date(t.dueAt);
        return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
      })
  );

  const cells: (Date | null)[] = [];
  for (let i = 0; i < startWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(calYear, calMonth, d));

  return (
    <View style={[calStyles.wrapper, { backgroundColor: theme.card, borderBottomColor: theme.border }]}>
      {/* Month nav */}
      <View style={calStyles.header}>
        <TouchableOpacity onPress={onPrev} style={calStyles.navBtn}>
          <Ionicons name="chevron-back" size={20} color={theme.primary} />
        </TouchableOpacity>
        <Text style={[calStyles.monthLabel, { color: theme.foreground }]}>
          {MONTH_NAMES[calMonth]} {calYear}
        </Text>
        <TouchableOpacity onPress={onNext} style={calStyles.navBtn}>
          <Ionicons name="chevron-forward" size={20} color={theme.primary} />
        </TouchableOpacity>
      </View>
      {/* Day names row */}
      <View style={calStyles.dayNames}>
        {DAY_NAMES.map(d => (
          <Text key={d} style={[calStyles.dayName, { color: theme.mutedForeground }]}>{d}</Text>
        ))}
      </View>
      {/* Grid */}
      <View style={calStyles.grid}>
        {cells.map((date, i) => {
          if (!date) return <View key={`empty-${i}`} style={calStyles.cell} />;
          const key = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
          const hasTasks = taskDates.has(key);
          const isSelected = selectedDate ? isSameDay(date, selectedDate) : false;
          const isToday = isSameDay(date, new Date());
          return (
            <TouchableOpacity
              key={key}
              style={[
                calStyles.cell,
                isSelected && { backgroundColor: theme.primary },
                !isSelected && isToday && { borderWidth: 1.5, borderColor: theme.primary, borderRadius: 20 },
              ]}
              onPress={() => onSelectDate(date)}
            >
              <Text style={[
                calStyles.cellText,
                { color: isSelected ? '#fff' : theme.foreground },
                isToday && !isSelected && { color: theme.primary },
              ]}>
                {date.getDate()}
              </Text>
              {hasTasks && (
                <View style={[calStyles.dot, { backgroundColor: isSelected ? '#fff' : theme.primary }]} />
              )}
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

export default function TarefasScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme];

  const [viewMode, setViewMode] = useState<'list' | 'calendar'>('list');
  const [status, setStatus] = useState<TaskStatus | undefined>(undefined);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);

  const now = new Date();
  const [calYear, setCalYear] = useState(now.getFullYear());
  const [calMonth, setCalMonth] = useState(now.getMonth());

  // For calendar: load all tasks without status filter
  const { data: allTasks, isRefetching: allRefetching, refetch: refetchAll } = useListTasks({});
  const { data: filteredTasks, isRefetching, refetch } = useListTasks({ status });

  const tasksForCalendar = allTasks ?? [];

  const calendarDayTasks = useMemo(() => {
    if (!selectedDate) return tasksForCalendar;
    return tasksForCalendar.filter(t => t.dueAt && isSameDay(new Date(t.dueAt), selectedDate));
  }, [tasksForCalendar, selectedDate]);

  const filters: Array<TaskStatus | 'all'> = ['all', 'scheduled', 'in_progress', 'completed', 'paid'];

  const prevMonth = () => {
    if (calMonth === 0) { setCalMonth(11); setCalYear(y => y - 1); }
    else setCalMonth(m => m - 1);
    setSelectedDate(null);
  };
  const nextMonth = () => {
    if (calMonth === 11) { setCalMonth(0); setCalYear(y => y + 1); }
    else setCalMonth(m => m + 1);
    setSelectedDate(null);
  };

  const displayTasks = viewMode === 'calendar' ? calendarDayTasks : (filteredTasks ?? []);

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      {/* View toggle */}
      <View style={[styles.topBar, { backgroundColor: theme.card, borderBottomColor: theme.border }]}>
        <View style={[styles.segmented, { backgroundColor: theme.muted }]}>
          <TouchableOpacity
            style={[styles.segment, viewMode === 'list' && { backgroundColor: theme.card }]}
            onPress={() => setViewMode('list')}
          >
            <Ionicons name="list" size={16} color={viewMode === 'list' ? theme.primary : theme.mutedForeground} />
            <Text style={[styles.segmentText, { color: viewMode === 'list' ? theme.primary : theme.mutedForeground }]}>Lista</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.segment, viewMode === 'calendar' && { backgroundColor: theme.card }]}
            onPress={() => setViewMode('calendar')}
          >
            <Ionicons name="calendar" size={16} color={viewMode === 'calendar' ? theme.primary : theme.mutedForeground} />
            <Text style={[styles.segmentText, { color: viewMode === 'calendar' ? theme.primary : theme.mutedForeground }]}>Agenda</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Calendar */}
      {viewMode === 'calendar' && (
        <MonthCalendar
          theme={theme}
          tasks={tasksForCalendar}
          calYear={calYear}
          calMonth={calMonth}
          selectedDate={selectedDate}
          onSelectDate={d => setSelectedDate(prev => prev && isSameDay(prev, d) ? null : d)}
          onPrev={prevMonth}
          onNext={nextMonth}
        />
      )}

      {/* Status filters (list mode only) */}
      {viewMode === 'list' && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={[styles.filterRow, { backgroundColor: theme.card, borderBottomColor: theme.border }]}
          contentContainerStyle={styles.filterContent}
        >
          {filters.map(f => (
            <TouchableOpacity
              key={f}
              style={[
                styles.filterChip,
                { backgroundColor: theme.muted },
                (f === 'all' ? !status : status === f) && { backgroundColor: theme.primary },
              ]}
              onPress={() => setStatus(f === 'all' ? undefined : f as TaskStatus)}
            >
              <Text style={[
                styles.filterChipText,
                { color: (f === 'all' ? !status : status === f) ? '#ffffff' : theme.mutedForeground },
              ]}>
                {STATUS_LABELS[f]}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      {/* Calendar day header */}
      {viewMode === 'calendar' && selectedDate && (
        <View style={[styles.dayHeader, { backgroundColor: theme.background }]}>
          <Text style={[styles.dayHeaderText, { color: theme.foreground }]}>
            {selectedDate.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })}
          </Text>
          <TouchableOpacity onPress={() => setSelectedDate(null)}>
            <Ionicons name="close-circle" size={18} color={theme.mutedForeground} />
          </TouchableOpacity>
        </View>
      )}

      <FlatList
        data={displayTasks}
        keyExtractor={item => String(item.id)}
        refreshControl={
          <RefreshControl
            refreshing={viewMode === 'calendar' ? allRefetching : isRefetching}
            onRefresh={viewMode === 'calendar' ? refetchAll : refetch}
            tintColor={theme.primary}
          />
        }
        contentContainerStyle={styles.listContent}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}
            onPress={() => router.push(`/tarefa/${item.id}`)}
          >
            <View style={styles.cardRow}>
              <View style={styles.cardMain}>
                <Text style={[styles.cardTitle, { color: theme.foreground }]} numberOfLines={1}>
                  {item.title}
                </Text>
                {item.clientName && (
                  <Text style={[styles.cardSub, { color: theme.mutedForeground }]}>
                    {item.clientName}
                  </Text>
                )}
                <Text style={[styles.cardDate, { color: theme.mutedForeground }]}>
                  <Ionicons name="calendar-outline" size={11} />{' '}
                  {new Date(item.dueAt).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' })} · {timeRange(item)}
                </Text>
              </View>
              <View style={styles.cardRight}>
                <View style={[styles.badge, { backgroundColor: STATUS_COLORS[item.status as TaskStatus] + '22' }]}>
                  <Text style={[styles.badgeText, { color: STATUS_COLORS[item.status as TaskStatus] }]}>
                    {STATUS_LABELS[item.status as TaskStatus]}
                  </Text>
                </View>
                {item.paidAmount != null && (
                  <Text style={[styles.cardAmount, { color: '#8b5cf6' }]}>
                    {fmt(item.paidAmount)}
                  </Text>
                )}
              </View>
            </View>
          </TouchableOpacity>
        )}
        ListEmptyComponent={() => (
          <View style={styles.empty}>
            <Ionicons name="clipboard-outline" size={48} color={theme.mutedForeground} />
            <Text style={[styles.emptyText, { color: theme.mutedForeground }]}>
              {viewMode === 'calendar' && selectedDate
                ? 'Nenhuma O.S. neste dia.'
                : status
                ? 'Nenhuma O.S. com esse status.'
                : 'Nenhuma ordem de serviço ainda.'}
            </Text>
          </View>
        )}
      />

      <TouchableOpacity
        style={[styles.fab, { backgroundColor: theme.primary }]}
        onPress={() => router.push('/tarefa/nova')}
      >
        <Ionicons name="add" size={28} color="#ffffff" />
      </TouchableOpacity>
    </View>
  );
}

const calStyles = StyleSheet.create({
  wrapper: { borderBottomWidth: 1, paddingBottom: 8 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, paddingVertical: 6 },
  navBtn: { padding: 8 },
  monthLabel: { fontSize: 15, fontFamily: 'PlusJakartaSans_700Bold' },
  dayNames: { flexDirection: 'row', paddingHorizontal: 4 },
  dayName: { flex: 1, textAlign: 'center', fontSize: 11, fontFamily: 'PlusJakartaSans_500Medium', paddingVertical: 4 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 4 },
  cell: { width: '14.28%', alignItems: 'center', paddingVertical: 5, borderRadius: 20 },
  cellText: { fontSize: 13, fontFamily: 'PlusJakartaSans_500Medium' },
  dot: { width: 4, height: 4, borderRadius: 2, marginTop: 2 },
});

const styles = StyleSheet.create({
  container: { flex: 1 },
  topBar: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: 1,
    alignItems: 'center',
  },
  segmented: {
    flexDirection: 'row',
    borderRadius: 10,
    padding: 3,
    gap: 2,
  },
  segment: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 16,
    paddingVertical: 7,
    borderRadius: 8,
  },
  segmentText: { fontSize: 13, fontFamily: 'PlusJakartaSans_600SemiBold' },
  filterRow: { maxHeight: 48, borderBottomWidth: 1 },
  filterContent: { paddingHorizontal: 12, paddingVertical: 8, gap: 6, alignItems: 'center' },
  filterChip: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20 },
  filterChipText: { fontSize: 12, fontFamily: 'PlusJakartaSans_500Medium' },
  dayHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  dayHeaderText: { fontSize: 13, fontFamily: 'PlusJakartaSans_600SemiBold', textTransform: 'capitalize' },
  listContent: { padding: 12, paddingBottom: 80 },
  card: { borderRadius: 10, borderWidth: 1, padding: 14, marginBottom: 8 },
  cardRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  cardMain: { flex: 1 },
  cardTitle: { fontSize: 15, fontFamily: 'PlusJakartaSans_600SemiBold', marginBottom: 3 },
  cardSub: { fontSize: 12, fontFamily: 'PlusJakartaSans_400Regular', marginBottom: 2 },
  cardDate: { fontSize: 11, fontFamily: 'PlusJakartaSans_400Regular' },
  cardRight: { alignItems: 'flex-end', gap: 6 },
  cardAmount: { fontSize: 13, fontFamily: 'PlusJakartaSans_700Bold' },
  badge: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2 },
  badgeText: { fontSize: 11, fontFamily: 'PlusJakartaSans_600SemiBold' },
  empty: { alignItems: 'center', paddingVertical: 60, gap: 12 },
  emptyText: { fontSize: 14, fontFamily: 'PlusJakartaSans_400Regular' },
  fab: {
    position: 'absolute', right: 20, bottom: 24,
    width: 56, height: 56, borderRadius: 28,
    alignItems: 'center', justifyContent: 'center',
    elevation: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2, shadowRadius: 4,
  },
});
