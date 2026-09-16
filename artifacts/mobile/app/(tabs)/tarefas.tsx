import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ScrollView,
  TextInput,
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

function startOfWeek(date: Date): Date {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  result.setDate(result.getDate() - result.getDay());
  return result;
}

function hasConflicts(tasks: any[]): boolean {
  const sorted = [...tasks]
    .filter(task => task.dueAt)
    .sort((a, b) => new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime());
  return sorted.some((task, index) => {
    if (index === 0) return false;
    const previous = sorted[index - 1];
    const previousEnd = previous.endAt ? new Date(previous.endAt).getTime() : new Date(previous.dueAt).getTime();
    return new Date(task.dueAt).getTime() < previousEnd;
  });
}

function WeekAgenda({
  theme,
  tasks,
  selectedDate,
  onSelectDate,
  onPrev,
  onNext,
}: {
  theme: typeof Colors.light;
  tasks: any[];
  selectedDate: Date;
  onSelectDate: (date: Date) => void;
  onPrev: () => void;
  onNext: () => void;
}) {
  const weekStart = startOfWeek(selectedDate);
  const days = Array.from({ length: 7 }, (_, index) => {
    const day = new Date(weekStart);
    day.setDate(weekStart.getDate() + index);
    return day;
  });

  return (
    <View style={[styles.weekAgenda, { backgroundColor: theme.card, borderBottomColor: theme.border }]}>
      <View style={styles.weekHeader}>
        <TouchableOpacity onPress={onPrev} style={styles.weekNavButton}>
          <Ionicons name="chevron-back" size={19} color={theme.primary} />
        </TouchableOpacity>
        <Text style={[styles.weekTitle, { color: theme.foreground }]}>
          {days[0].toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })} — {days[6].toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })}
        </Text>
        <TouchableOpacity onPress={onNext} style={styles.weekNavButton}>
          <Ionicons name="chevron-forward" size={19} color={theme.primary} />
        </TouchableOpacity>
      </View>
      <View style={styles.weekDays}>
        {days.map(day => {
          const dayTasks = tasks.filter(task => isSameDay(new Date(task.dueAt), day));
          const selected = isSameDay(day, selectedDate);
          const today = isSameDay(day, new Date());
          return (
            <TouchableOpacity
              key={day.toISOString()}
              style={[
                styles.weekDay,
                selected && { backgroundColor: theme.primary },
                !selected && today && { borderColor: theme.primary, borderWidth: 1 },
              ]}
              onPress={() => onSelectDate(day)}
            >
              <Text style={[styles.weekDayName, { color: selected ? '#ffffff' : theme.mutedForeground }]}>
                {DAY_NAMES[day.getDay()]}
              </Text>
              <Text style={[styles.weekDayNumber, { color: selected ? '#ffffff' : theme.foreground }]}>
                {day.getDate()}
              </Text>
              {!!dayTasks.length && (
                <View style={[styles.weekTaskCount, { backgroundColor: selected ? '#ffffff' : theme.primary }]}>
                  <Text style={[styles.weekTaskCountText, { color: selected ? theme.primary : '#ffffff' }]}>{dayTasks.length}</Text>
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
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
  const theme = Colors[colorScheme ?? 'light'];

  const [viewMode, setViewMode] = useState<'list' | 'calendar'>('list');
  const [status, setStatus] = useState<TaskStatus | undefined>(undefined);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [search, setSearch] = useState('');
  const [calendarMode, setCalendarMode] = useState<'month' | 'week' | 'day'>('month');

  const now = new Date();
  const [calYear, setCalYear] = useState(now.getFullYear());
  const [calMonth, setCalMonth] = useState(now.getMonth());

  // For calendar: load all tasks without status filter
  const { data: allTasks, isRefetching: allRefetching, refetch: refetchAll } = useListTasks({});
  const { data: filteredTasks, isRefetching, refetch } = useListTasks({ status });

  const tasksForCalendar = allTasks ?? [];
  const agendaDate = selectedDate ?? new Date();

  const calendarDayTasks = useMemo(() => {
    if (calendarMode === 'month' && !selectedDate) return tasksForCalendar;
    return tasksForCalendar.filter(t => t.dueAt && isSameDay(new Date(t.dueAt), agendaDate));
  }, [tasksForCalendar, selectedDate, calendarMode, agendaDate]);

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
  const moveWeek = (amount: number) => {
    const date = new Date(agendaDate);
    date.setDate(date.getDate() + amount * 7);
    setSelectedDate(date);
  };

  const displayTasks = viewMode === 'calendar'
    ? calendarDayTasks
    : (filteredTasks ?? []).filter(task => {
      const term = search.trim().toLowerCase();
      if (!term) return true;
      return (
        task.title.toLowerCase().includes(term) ||
        (task.clientName?.toLowerCase().includes(term) ?? false) ||
        (task.description?.toLowerCase().includes(term) ?? false)
      );
    });

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
        <>
          <View style={[styles.agendaModes, { backgroundColor: theme.card, borderBottomColor: theme.border }]}>
            {(['month', 'week', 'day'] as const).map(mode => (
              <TouchableOpacity
                key={mode}
                style={[styles.agendaMode, calendarMode === mode && { backgroundColor: theme.primary }]}
                onPress={() => {
                  setCalendarMode(mode);
                  if (mode !== 'month' && !selectedDate) setSelectedDate(new Date());
                }}
              >
                <Text style={[styles.agendaModeText, { color: calendarMode === mode ? '#ffffff' : theme.mutedForeground }]}>
                  {mode === 'month' ? 'Mês' : mode === 'week' ? 'Semana' : 'Dia'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          {calendarMode === 'month' ? (
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
          ) : (
            <WeekAgenda
              theme={theme}
              tasks={tasksForCalendar}
              selectedDate={agendaDate}
              onSelectDate={setSelectedDate}
              onPrev={() => moveWeek(-1)}
              onNext={() => moveWeek(1)}
            />
          )}
        </>
      )}

      {/* Status filters (list mode only) */}
      {viewMode === 'list' && (
        <>
          <View style={[styles.searchRow, { backgroundColor: theme.card, borderBottomColor: theme.border }]}>
            <Ionicons name="search-outline" size={18} color={theme.mutedForeground} />
            <TextInput
              style={[styles.searchInput, { color: theme.foreground }]}
              placeholder="Buscar por título, cliente ou descrição..."
              placeholderTextColor={theme.mutedForeground}
              value={search}
              onChangeText={setSearch}
              returnKeyType="search"
            />
            {!!search && (
              <TouchableOpacity onPress={() => setSearch('')} accessibilityLabel="Limpar busca">
                <Ionicons name="close-circle" size={18} color={theme.mutedForeground} />
              </TouchableOpacity>
            )}
          </View>
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
        </>
      )}

      {/* Calendar day header */}
      {viewMode === 'calendar' && selectedDate && (
        <View style={[styles.dayHeader, { backgroundColor: theme.background }]}>
          <View style={styles.dayHeaderTextBlock}>
            <Text style={[styles.dayHeaderText, { color: theme.foreground }]}>
              {selectedDate.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })}
            </Text>
            {hasConflicts(calendarDayTasks) && (
              <Text style={styles.conflictText}>Atenção: há horários sobrepostos neste dia.</Text>
            )}
          </View>
          <TouchableOpacity onPress={() => setSelectedDate(null)} accessibilityLabel="Limpar dia selecionado">
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
                {(item.status === 'completed' || item.status === 'paid') && item.feedbackSubmittedAt && item.feedbackRating != null && (
                  <View style={styles.ratingRow}>
                    {Array.from({ length: 5 }, (_, index) => (
                      <Ionicons
                        key={index}
                        name={index < item.feedbackRating! ? 'star' : 'star-outline'}
                        size={12}
                        color={index < item.feedbackRating! ? '#f59e0b' : theme.border}
                      />
                    ))}
                    <Text style={[styles.ratingText, { color: theme.mutedForeground }]}>
                      {item.feedbackRating}/5
                    </Text>
                  </View>
                )}
              </View>
            </View>
            {viewMode === 'calendar' && (
              <TouchableOpacity
                style={[styles.rescheduleButton, { borderTopColor: theme.border }]}
                onPress={event => {
                  event.stopPropagation();
                  router.push(`/tarefa/editar/${item.id}`);
                }}
              >
                <Ionicons name="calendar-outline" size={14} color={theme.primary} />
                <Text style={[styles.rescheduleText, { color: theme.primary }]}>Reagendar</Text>
              </TouchableOpacity>
            )}
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
                : search
                ? 'Nenhuma O.S. encontrada para essa busca.'
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
  agendaModes: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 6,
    borderBottomWidth: 1,
  },
  agendaMode: { flex: 1, alignItems: 'center', paddingVertical: 7, borderRadius: 8 },
  agendaModeText: { fontSize: 12, fontFamily: 'PlusJakartaSans_600SemiBold' },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_400Regular',
    paddingVertical: 0,
  },
  filterRow: { borderBottomWidth: 1 },
  filterContent: { paddingHorizontal: 12, paddingVertical: 8, gap: 6, alignItems: 'center' },
  filterChip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, flexShrink: 0 },
  filterChipText: { fontSize: 13, fontFamily: 'PlusJakartaSans_500Medium' },
  dayHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  dayHeaderText: { fontSize: 13, fontFamily: 'PlusJakartaSans_600SemiBold', textTransform: 'capitalize' },
  dayHeaderTextBlock: { flex: 1 },
  conflictText: { color: '#dc2626', fontSize: 11, fontFamily: 'PlusJakartaSans_600SemiBold', marginTop: 3 },
  weekAgenda: { borderBottomWidth: 1, paddingHorizontal: 10, paddingBottom: 10 },
  weekHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 8 },
  weekNavButton: { padding: 5 },
  weekTitle: { fontSize: 13, fontFamily: 'PlusJakartaSans_600SemiBold', textTransform: 'capitalize' },
  weekDays: { flexDirection: 'row', justifyContent: 'space-between', gap: 4 },
  weekDay: { flex: 1, minHeight: 66, alignItems: 'center', justifyContent: 'center', borderRadius: 10, gap: 3 },
  weekDayName: { fontSize: 10, fontFamily: 'PlusJakartaSans_600SemiBold' },
  weekDayNumber: { fontSize: 16, fontFamily: 'PlusJakartaSans_700Bold' },
  weekTaskCount: { minWidth: 16, height: 16, paddingHorizontal: 4, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  weekTaskCountText: { fontSize: 9, fontFamily: 'PlusJakartaSans_700Bold' },
  rescheduleButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, borderTopWidth: 1, marginTop: 10, paddingTop: 9 },
  rescheduleText: { fontSize: 12, fontFamily: 'PlusJakartaSans_600SemiBold' },
  listContent: { padding: 12, paddingBottom: 80 },
  card: { borderRadius: 10, borderWidth: 1, padding: 14, marginBottom: 8 },
  cardRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  cardMain: { flex: 1 },
  cardTitle: { fontSize: 15, fontFamily: 'PlusJakartaSans_600SemiBold', marginBottom: 3 },
  cardSub: { fontSize: 12, fontFamily: 'PlusJakartaSans_400Regular', marginBottom: 2 },
  cardDate: { fontSize: 11, fontFamily: 'PlusJakartaSans_400Regular' },
  cardRight: { alignItems: 'flex-end', gap: 6 },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  ratingText: { fontSize: 11, fontFamily: 'PlusJakartaSans_600SemiBold', marginLeft: 3 },
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
