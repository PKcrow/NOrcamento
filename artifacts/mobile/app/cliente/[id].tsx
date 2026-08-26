import React, { useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Linking,
} from 'react-native';
import { useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useGetClient, useListQuotes, useListTasks } from '@workspace/api-client-react';
import Colors from '@/constants/colors';
import { useColorScheme } from '@/hooks/useColorScheme';

const fmt = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

const fmtDate = (d: Date | string) =>
  new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' });

const QUOTE_STATUS_COLORS: Record<string, string> = {
  draft: '#94a3b8', sent: '#3b82f6', approved: '#22c55e', rejected: '#ef4444',
};
const QUOTE_STATUS_LABELS: Record<string, string> = {
  draft: 'Rascunho', sent: 'Enviado', approved: 'Aprovado', rejected: 'Recusado',
};
const TASK_STATUS_COLORS: Record<string, string> = {
  scheduled: '#f59e0b', in_progress: '#3b82f6', completed: '#22c55e', paid: '#8b5cf6',
};
const TASK_STATUS_LABELS: Record<string, string> = {
  scheduled: 'Agendada', in_progress: 'Em andamento', completed: 'Concluída', paid: 'Paga',
};

export default function ClienteDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const clientId = Number(id);
  const router = useRouter();
  const navigation = useNavigation();
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme];

  const { data: client, isLoading } = useGetClient(clientId);
  const { data: quotes } = useListQuotes({ clientId });
  const { data: allTasks } = useListTasks({});

  const clientTasks = allTasks?.filter(t => t.clientId === clientId) ?? [];
  const recentQuotes = (quotes ?? []).slice(0, 5);
  const recentTasks = clientTasks.slice(0, 5);

  // Edit button in header
  useEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <TouchableOpacity
          onPress={() => router.push(`/cliente/editar/${clientId}`)}
          style={{ paddingHorizontal: 16 }}
        >
          <Ionicons name="pencil-outline" size={20} color={theme.primary} />
        </TouchableOpacity>
      ),
    });
  }, [clientId, navigation, theme.primary]);

  if (isLoading) {
    return (
      <View style={[styles.loading, { backgroundColor: theme.background }]}>
        <ActivityIndicator color={theme.primary} />
      </View>
    );
  }

  if (!client) {
    return (
      <View style={[styles.loading, { backgroundColor: theme.background }]}>
        <Text style={{ color: theme.mutedForeground }}>Cliente não encontrado.</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.background }]}
      contentContainerStyle={styles.content}
    >
      {/* Profile card */}
      <View style={[styles.profileCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
        <View style={[styles.avatar, { backgroundColor: theme.primary + '22' }]}>
          <Text style={[styles.avatarText, { color: theme.primary }]}>
            {client.name.charAt(0).toUpperCase()}
          </Text>
        </View>
        <Text style={[styles.clientName, { color: theme.foreground }]}>{client.name}</Text>
        <Text style={[styles.clientSince, { color: theme.mutedForeground }]}>
          Cliente desde {fmtDate(client.createdAt)}
        </Text>

        {/* Contact info */}
        <View style={styles.contactRow}>
          {client.phone && (
            <TouchableOpacity
              style={[styles.contactBtn, { borderColor: theme.border }]}
              onPress={() => Linking.openURL(`tel:${client.phone}`)}
            >
              <Ionicons name="call-outline" size={18} color={theme.primary} />
              <Text style={[styles.contactBtnText, { color: theme.foreground }]}>{client.phone}</Text>
            </TouchableOpacity>
          )}
          {client.email && (
            <TouchableOpacity
              style={[styles.contactBtn, { borderColor: theme.border }]}
              onPress={() => Linking.openURL(`mailto:${client.email}`)}
            >
              <Ionicons name="mail-outline" size={18} color={theme.primary} />
              <Text style={[styles.contactBtnText, { color: theme.foreground }]}>{client.email}</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Quick actions */}
      <View style={styles.quickActions}>
        <TouchableOpacity
          style={[styles.quickBtn, { backgroundColor: theme.primary }]}
          onPress={() => router.push({ pathname: '/orcamento/novo', params: { clientId } })}
        >
          <Ionicons name="document-text-outline" size={18} color="#ffffff" />
          <Text style={styles.quickBtnText}>Novo orçamento</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.quickBtn, { backgroundColor: theme.card, borderWidth: 1, borderColor: theme.border }]}
          onPress={() => router.push({ pathname: '/tarefa/nova', params: { clientId } })}
        >
          <Ionicons name="clipboard-outline" size={18} color={theme.foreground} />
          <Text style={[styles.quickBtnText, { color: theme.foreground }]}>Nova O.S.</Text>
        </TouchableOpacity>
      </View>

      {/* Notes */}
      {client.notes && (
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.mutedForeground }]}>OBSERVAÇÕES</Text>
          <View style={[styles.notesCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <Text style={[styles.notesText, { color: theme.foreground }]}>{client.notes}</Text>
          </View>
        </View>
      )}

      {/* Recent quotes */}
      {recentQuotes.length > 0 && (
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.mutedForeground }]}>ORÇAMENTOS</Text>
          {recentQuotes.map(q => (
            <TouchableOpacity
              key={q.id}
              style={[styles.listRow, { backgroundColor: theme.card, borderColor: theme.border }]}
              onPress={() => router.push(`/orcamento/${q.id}`)}
            >
              <View style={styles.listRowMain}>
                <Text style={[styles.listRowTitle, { color: theme.foreground }]}>{fmtDate(q.createdAt)}</Text>
                <Text style={[styles.listRowSub, { color: theme.mutedForeground }]}>
                  {q.items.length} {q.items.length === 1 ? 'item' : 'itens'}
                </Text>
              </View>
              <View style={styles.listRowRight}>
                <View style={[styles.badge, { backgroundColor: QUOTE_STATUS_COLORS[q.status] + '22' }]}>
                  <Text style={[styles.badgeText, { color: QUOTE_STATUS_COLORS[q.status] }]}>
                    {QUOTE_STATUS_LABELS[q.status]}
                  </Text>
                </View>
                <Text style={[styles.listRowAmount, { color: theme.foreground }]}>{fmt(q.total)}</Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Recent tasks */}
      {recentTasks.length > 0 && (
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.mutedForeground }]}>ORDENS DE SERVIÇO</Text>
          {recentTasks.map(t => (
            <TouchableOpacity
              key={t.id}
              style={[styles.listRow, { backgroundColor: theme.card, borderColor: theme.border }]}
              onPress={() => router.push(`/tarefa/${t.id}`)}
            >
              <View style={styles.listRowMain}>
                <Text style={[styles.listRowTitle, { color: theme.foreground }]} numberOfLines={1}>
                  {t.title}
                </Text>
                <Text style={[styles.listRowSub, { color: theme.mutedForeground }]}>{fmtDate(t.dueAt)}</Text>
              </View>
              <View style={[styles.badge, { backgroundColor: TASK_STATUS_COLORS[t.status] + '22' }]}>
                <Text style={[styles.badgeText, { color: TASK_STATUS_COLORS[t.status] }]}>
                  {TASK_STATUS_LABELS[t.status]}
                </Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16, paddingBottom: 40 },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  profileCard: { borderRadius: 16, borderWidth: 1, padding: 20, alignItems: 'center', marginBottom: 16 },
  avatar: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  avatarText: { fontSize: 28, fontFamily: 'PlusJakartaSans_700Bold' },
  clientName: { fontSize: 20, fontFamily: 'PlusJakartaSans_700Bold', marginBottom: 4 },
  clientSince: { fontSize: 13, fontFamily: 'PlusJakartaSans_400Regular', marginBottom: 16 },
  contactRow: { width: '100%', gap: 8 },
  contactBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10 },
  contactBtnText: { fontSize: 14, fontFamily: 'PlusJakartaSans_400Regular', flex: 1 },
  quickActions: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  quickBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, height: 44, borderRadius: 10 },
  quickBtnText: { fontSize: 13, fontFamily: 'PlusJakartaSans_600SemiBold', color: '#ffffff' },
  section: { marginBottom: 16 },
  sectionTitle: { fontSize: 11, fontFamily: 'PlusJakartaSans_600SemiBold', letterSpacing: 0.8, marginBottom: 8 },
  notesCard: { borderRadius: 10, borderWidth: 1, padding: 14 },
  notesText: { fontSize: 14, fontFamily: 'PlusJakartaSans_400Regular', lineHeight: 22 },
  listRow: { flexDirection: 'row', alignItems: 'center', borderRadius: 10, borderWidth: 1, padding: 12, marginBottom: 8, gap: 10 },
  listRowMain: { flex: 1 },
  listRowRight: { alignItems: 'flex-end', gap: 4 },
  listRowTitle: { fontSize: 14, fontFamily: 'PlusJakartaSans_500Medium', marginBottom: 2 },
  listRowSub: { fontSize: 12, fontFamily: 'PlusJakartaSans_400Regular' },
  listRowAmount: { fontSize: 13, fontFamily: 'PlusJakartaSans_600SemiBold' },
  badge: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2 },
  badgeText: { fontSize: 11, fontFamily: 'PlusJakartaSans_600SemiBold' },
});
