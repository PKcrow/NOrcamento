import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import {
  getGetDashboardSummaryQueryKey,
  useGetMe,
  useGetDashboardSummary,
} from '@workspace/api-client-react';
import Colors from '@/constants/colors';
import { useColorScheme } from '@/hooks/useColorScheme';

const fmt = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

const fmtDate = (d: Date | string) =>
  new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });

const QUOTE_STATUS_LABEL: Record<string, string> = {
  draft: 'Rascunho',
  sent: 'Enviado',
  approved: 'Aprovado',
  rejected: 'Recusado',
};
const QUOTE_STATUS_COLOR: Record<string, string> = {
  draft: '#94a3b8',
  sent: '#3b82f6',
  approved: '#22c55e',
  rejected: '#ef4444',
};
const TASK_STATUS_LABEL: Record<string, string> = {
  scheduled: 'Agendada',
  in_progress: 'Em andamento',
  completed: 'Concluída',
  paid: 'Paga',
};
const TASK_STATUS_COLOR: Record<string, string> = {
  scheduled: '#f59e0b',
  in_progress: '#3b82f6',
  completed: '#22c55e',
  paid: '#8b5cf6',
};
const PRIORITY_META: Record<string, { label: string; icon: React.ComponentProps<typeof Ionicons>['name']; color: string }> = {
  overdue_task: { label: 'Atrasado', icon: 'warning-outline', color: '#dc2626' },
  expiring_link: { label: 'Link expirando', icon: 'link-outline', color: '#d97706' },
  today_task: { label: 'Hoje', icon: 'today-outline', color: '#0284c7' },
  pending_payment: { label: 'Pagamento pendente', icon: 'wallet-outline', color: '#7c3aed' },
  quote_response: { label: 'Aguardando resposta', icon: 'chatbubble-ellipses-outline', color: '#2563eb' },
};

export default function DashboardScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme ?? 'light'];

  const { data: me } = useGetMe();
  const {
    data: summary,
    isLoading,
    refetch,
    isRefetching,
  } = useGetDashboardSummary({
    query: {
      queryKey: getGetDashboardSummaryQueryKey(),
      refetchInterval: 60_000,
    },
  });

  const firstName = me?.name?.split(' ')[0] ?? 'Olá';

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.background }]}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={theme.primary} />
      }
    >
      {/* Greeting */}
      <View style={styles.greeting}>
        <Text style={[styles.greetText, { color: theme.mutedForeground }]}>Bem-vindo,</Text>
        <Text style={[styles.greetName, { color: theme.foreground }]}>{firstName} 👋</Text>
        {me?.teamName && (
          <Text style={[styles.greetTeam, { color: theme.mutedForeground }]}>{me.teamName}</Text>
        )}
      </View>

      {/* Stats row */}
      <View style={styles.statsRow}>
        <StatCard
          theme={theme}
          icon="document-text"
          label="Orçamentos pendentes"
          value={String(summary?.pendingQuotesCount ?? '—')}
          sub={summary ? fmt(summary.pendingQuotesTotal) : '—'}
          onPress={() => router.push('/(tabs)/orcamentos')}
        />
        <StatCard
          theme={theme}
          icon="cash"
          label="Receita do mês"
          value={summary ? fmt(summary.monthlyRevenue) : '—'}
          onPress={() => router.push('/(tabs)/tarefas')}
        />
        <StatCard
          theme={theme}
          icon="people"
          label="Clientes"
          value={String(summary?.totalClients ?? '—')}
          onPress={() => router.push('/(tabs)/clientes')}
        />
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: theme.foreground }]}>Prioridades de hoje</Text>
          {(summary?.priorities.length ?? 0) > 0 && (
            <View style={[styles.priorityCount, { backgroundColor: theme.primary + '18' }]}>
              <Text style={[styles.priorityCountText, { color: theme.primary }]}>
                {summary!.priorities.length}
              </Text>
            </View>
          )}
        </View>
        {(summary?.priorities.length ?? 0) > 0 ? (
          summary!.priorities.map(priority => {
            const meta = PRIORITY_META[priority.type];
            return (
              <TouchableOpacity
                key={`${priority.type}-${priority.targetId}`}
                style={[styles.priorityCard, { backgroundColor: theme.card, borderColor: theme.border }]}
                onPress={() => router.push(
                  priority.target === 'quote'
                    ? `/orcamento/${priority.targetId}`
                    : `/tarefa/${priority.targetId}`,
                )}
              >
                <View style={[styles.priorityIcon, { backgroundColor: meta.color + '18' }]}>
                  <Ionicons name={meta.icon} size={20} color={meta.color} />
                </View>
                <View style={styles.priorityContent}>
                  <Text style={[styles.priorityTitle, { color: theme.foreground }]} numberOfLines={1}>
                    {priority.title}
                  </Text>
                  <Text style={[styles.priorityReason, { color: theme.mutedForeground }]} numberOfLines={2}>
                    {priority.reason}
                  </Text>
                </View>
                <View style={styles.priorityRight}>
                  <Text style={[styles.priorityLabel, { color: meta.color }]}>{meta.label}</Text>
                  <Ionicons name="chevron-forward" size={16} color={theme.mutedForeground} />
                </View>
              </TouchableOpacity>
            );
          })
        ) : !isLoading ? (
          <View style={[styles.priorityEmpty, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <Ionicons name="checkmark-circle-outline" size={26} color="#16a34a" />
            <View style={styles.priorityContent}>
              <Text style={[styles.priorityTitle, { color: theme.foreground }]}>Tudo em dia por aqui.</Text>
              <Text style={[styles.priorityReason, { color: theme.mutedForeground }]}>
                Nenhuma pendência precisa da sua atenção agora.
              </Text>
            </View>
          </View>
        ) : null}
      </View>

      {/* Upcoming tasks */}
      {(summary?.upcomingTasks?.length ?? 0) > 0 && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: theme.foreground }]}>Próximas ordens</Text>
            <TouchableOpacity onPress={() => router.push('/(tabs)/tarefas')}>
              <Text style={[styles.sectionLink, { color: theme.primary }]}>Ver todas</Text>
            </TouchableOpacity>
          </View>
          {summary!.upcomingTasks.slice(0, 4).map(task => (
            <TouchableOpacity
              key={task.id}
              style={[styles.listCard, { backgroundColor: theme.card, borderColor: theme.border }]}
              onPress={() => router.push(`/tarefa/${task.id}`)}
            >
              <View style={styles.listCardRow}>
                <View style={styles.listCardMain}>
                  <Text style={[styles.listCardTitle, { color: theme.foreground }]} numberOfLines={1}>
                    {task.title}
                  </Text>
                  {task.clientName && (
                    <Text style={[styles.listCardSub, { color: theme.mutedForeground }]}>
                      {task.clientName}
                    </Text>
                  )}
                </View>
                <View style={styles.listCardRight}>
                  <View style={[styles.badge, { backgroundColor: TASK_STATUS_COLOR[task.status] + '22' }]}>
                    <Text style={[styles.badgeText, { color: TASK_STATUS_COLOR[task.status] }]}>
                      {TASK_STATUS_LABEL[task.status]}
                    </Text>
                  </View>
                  <Text style={[styles.listCardDate, { color: theme.mutedForeground }]}>
                    {fmtDate(task.dueAt)}
                  </Text>
                </View>
              </View>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Recent quotes */}
      {(summary?.recentQuotes?.length ?? 0) > 0 && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: theme.foreground }]}>Orçamentos recentes</Text>
            <TouchableOpacity onPress={() => router.push('/(tabs)/orcamentos')}>
              <Text style={[styles.sectionLink, { color: theme.primary }]}>Ver todos</Text>
            </TouchableOpacity>
          </View>
          {summary!.recentQuotes.slice(0, 4).map(quote => (
            <TouchableOpacity
              key={quote.id}
              style={[styles.listCard, { backgroundColor: theme.card, borderColor: theme.border }]}
              onPress={() => router.push(`/orcamento/${quote.id}`)}
            >
              <View style={styles.listCardRow}>
                <View style={styles.listCardMain}>
                  <Text style={[styles.listCardTitle, { color: theme.foreground }]} numberOfLines={1}>
                    {quote.clientName}
                  </Text>
                  <Text style={[styles.listCardSub, { color: theme.mutedForeground }]}>
                    {fmtDate(quote.createdAt)}
                  </Text>
                </View>
                <View style={styles.listCardRight}>
                  <View style={[styles.badge, { backgroundColor: QUOTE_STATUS_COLOR[quote.status] + '22' }]}>
                    <Text style={[styles.badgeText, { color: QUOTE_STATUS_COLOR[quote.status] }]}>
                      {QUOTE_STATUS_LABEL[quote.status]}
                    </Text>
                  </View>
                  <Text style={[styles.listCardTotal, { color: theme.foreground }]}>
                    {fmt(quote.total)}
                  </Text>
                </View>
              </View>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {!isLoading && !summary && (
        <View style={styles.empty}>
          <Ionicons name="stats-chart-outline" size={48} color={theme.mutedForeground} />
          <Text style={[styles.emptyText, { color: theme.mutedForeground }]}>
            Nenhum dado ainda. Comece criando clientes e orçamentos.
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
  sub,
  onPress,
}: {
  theme: typeof Colors.light;
  icon: React.ComponentProps<typeof Ionicons>['name'];
  label: string;
  value: string;
  sub?: string;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      style={[styles.statCard, { backgroundColor: theme.card, borderColor: theme.border }]}
      onPress={onPress}
    >
      <Ionicons name={icon} size={22} color={theme.primary} style={{ marginBottom: 6 }} />
      <Text style={[styles.statValue, { color: theme.foreground }]}>{value}</Text>
      {sub && <Text style={[styles.statSub, { color: theme.primary }]}>{sub}</Text>}
      <Text style={[styles.statLabel, { color: theme.mutedForeground }]}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16, paddingBottom: 32 },
  greeting: { marginBottom: 20 },
  greetText: { fontSize: 14, fontFamily: 'PlusJakartaSans_400Regular' },
  greetName: { fontSize: 24, fontFamily: 'PlusJakartaSans_700Bold', marginBottom: 2 },
  greetTeam: { fontSize: 13, fontFamily: 'PlusJakartaSans_400Regular' },
  statsRow: { flexDirection: 'row', gap: 10, marginBottom: 24 },
  statCard: {
    flex: 1,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    alignItems: 'flex-start',
  },
  statValue: { fontSize: 18, fontFamily: 'PlusJakartaSans_700Bold', marginBottom: 2 },
  statSub: { fontSize: 12, fontFamily: 'PlusJakartaSans_600SemiBold', marginBottom: 2 },
  statLabel: { fontSize: 11, fontFamily: 'PlusJakartaSans_400Regular' },
  section: { marginBottom: 24 },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  sectionTitle: { fontSize: 16, fontFamily: 'PlusJakartaSans_600SemiBold' },
  sectionLink: { fontSize: 13, fontFamily: 'PlusJakartaSans_500Medium' },
  priorityCount: {
    minWidth: 24,
    height: 24,
    paddingHorizontal: 7,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  priorityCountText: { fontSize: 12, fontFamily: 'PlusJakartaSans_700Bold' },
  priorityCard: {
    minHeight: 76,
    borderRadius: 10,
    borderWidth: 1,
    padding: 12,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  priorityIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  priorityContent: { flex: 1, minWidth: 0 },
  priorityTitle: { fontSize: 14, fontFamily: 'PlusJakartaSans_600SemiBold', marginBottom: 2 },
  priorityReason: { fontSize: 12, lineHeight: 17, fontFamily: 'PlusJakartaSans_400Regular' },
  priorityRight: { alignItems: 'flex-end', gap: 5, maxWidth: 112 },
  priorityLabel: { fontSize: 10, textAlign: 'right', fontFamily: 'PlusJakartaSans_600SemiBold' },
  priorityEmpty: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  listCard: {
    borderRadius: 10,
    borderWidth: 1,
    padding: 12,
    marginBottom: 8,
  },
  listCardRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  listCardMain: { flex: 1 },
  listCardRight: { alignItems: 'flex-end', gap: 4 },
  listCardTitle: { fontSize: 14, fontFamily: 'PlusJakartaSans_600SemiBold', marginBottom: 2 },
  listCardSub: { fontSize: 12, fontFamily: 'PlusJakartaSans_400Regular' },
  listCardDate: { fontSize: 11, fontFamily: 'PlusJakartaSans_400Regular' },
  listCardTotal: { fontSize: 13, fontFamily: 'PlusJakartaSans_600SemiBold' },
  badge: {
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  badgeText: { fontSize: 11, fontFamily: 'PlusJakartaSans_600SemiBold' },
  empty: { alignItems: 'center', paddingVertical: 48, gap: 12 },
  emptyText: {
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_400Regular',
    textAlign: 'center',
    maxWidth: 260,
  },
});
