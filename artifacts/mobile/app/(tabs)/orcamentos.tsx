import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useListQuotes } from '@workspace/api-client-react';
import Colors from '@/constants/colors';
import { useColorScheme } from '@/hooks/useColorScheme';

type QuoteStatus = 'draft' | 'sent' | 'approved' | 'rejected';

const STATUS_LABELS: Record<QuoteStatus | 'all', string> = {
  all: 'Todos',
  draft: 'Rascunho',
  sent: 'Enviado',
  approved: 'Aprovado',
  rejected: 'Recusado',
};
const STATUS_COLORS: Record<QuoteStatus, string> = {
  draft: '#94a3b8',
  sent: '#3b82f6',
  approved: '#22c55e',
  rejected: '#ef4444',
};

const fmt = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

const fmtDate = (d: Date | string) =>
  new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' });

export default function OrcamentosScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme ?? 'light'];

  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<QuoteStatus | undefined>(undefined);

  const { data: quotes, isRefetching, refetch } = useListQuotes({ search: search || undefined, status });

  const filters: Array<QuoteStatus | 'all'> = ['all', 'draft', 'sent', 'approved', 'rejected'];

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      {/* Search bar */}
      <View style={[styles.searchRow, { backgroundColor: theme.card, borderBottomColor: theme.border }]}>
        <Ionicons name="search-outline" size={18} color={theme.mutedForeground} style={styles.searchIcon} />
        <TextInput
          style={[styles.searchInput, { color: theme.foreground }]}
          placeholder="Buscar orçamento ou cliente..."
          placeholderTextColor={theme.mutedForeground}
          value={search}
          onChangeText={setSearch}
          returnKeyType="search"
        />
        {search ? (
          <TouchableOpacity onPress={() => setSearch('')}>
            <Ionicons name="close-circle" size={18} color={theme.mutedForeground} />
          </TouchableOpacity>
        ) : null}
      </View>

      {/* Status filters */}
      <View style={[styles.filterRow, { backgroundColor: theme.card, borderBottomColor: theme.border }]}>
        {filters.map(f => (
          <TouchableOpacity
            key={f}
            style={[
              styles.filterChip,
              (f === 'all' ? !status : status === f) && { backgroundColor: theme.primary },
            ]}
            onPress={() => setStatus(f === 'all' ? undefined : f as QuoteStatus)}
          >
            <Text
              style={[
                styles.filterChipText,
                { color: (f === 'all' ? !status : status === f) ? '#ffffff' : theme.mutedForeground },
              ]}
            >
              {STATUS_LABELS[f]}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* List */}
      <FlatList
        data={quotes ?? []}
        keyExtractor={item => String(item.id)}
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={theme.primary} />
        }
        contentContainerStyle={styles.listContent}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}
            onPress={() => router.push(`/orcamento/${item.id}`)}
          >
            <View style={styles.cardRow}>
              <View style={styles.cardMain}>
                <Text style={[styles.cardTitle, { color: theme.foreground }]} numberOfLines={1}>
                  {item.clientName}
                </Text>
                <Text style={[styles.cardSub, { color: theme.mutedForeground }]}>
                  {fmtDate(item.createdAt)} · {item.items.length} {item.items.length === 1 ? 'item' : 'itens'}
                </Text>
              </View>
              <View style={styles.cardRight}>
                <View style={[styles.badge, { backgroundColor: STATUS_COLORS[item.status as QuoteStatus] + '22' }]}>
                  <Text style={[styles.badgeText, { color: STATUS_COLORS[item.status as QuoteStatus] }]}>
                    {STATUS_LABELS[item.status as QuoteStatus]}
                  </Text>
                </View>
                <Text style={[styles.cardTotal, { color: theme.foreground }]}>{fmt(item.total)}</Text>
              </View>
            </View>
          </TouchableOpacity>
        )}
        ListEmptyComponent={() => (
          <View style={styles.empty}>
            <Ionicons name="document-text-outline" size={48} color={theme.mutedForeground} />
            <Text style={[styles.emptyText, { color: theme.mutedForeground }]}>
              {search || status ? 'Nenhum orçamento encontrado.' : 'Nenhum orçamento ainda.'}
            </Text>
          </View>
        )}
      />

      {/* FAB */}
      <TouchableOpacity
        style={[styles.fab, { backgroundColor: theme.primary }]}
        onPress={() => router.push('/orcamento/novo')}
      >
        <Ionicons name="add" size={28} color="#ffffff" />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: 1,
    gap: 8,
  },
  searchIcon: {},
  searchInput: {
    flex: 1,
    fontSize: 15,
    fontFamily: 'PlusJakartaSans_400Regular',
    paddingVertical: 0,
  },
  filterRow: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
    gap: 6,
  },
  filterChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    backgroundColor: '#f1f5f9',
  },
  filterChipText: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_500Medium',
  },
  listContent: { padding: 12, paddingBottom: 80 },
  card: {
    borderRadius: 10,
    borderWidth: 1,
    padding: 14,
    marginBottom: 8,
  },
  cardRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  cardMain: { flex: 1 },
  cardRight: { alignItems: 'flex-end', gap: 4 },
  cardTitle: { fontSize: 15, fontFamily: 'PlusJakartaSans_600SemiBold', marginBottom: 3 },
  cardSub: { fontSize: 12, fontFamily: 'PlusJakartaSans_400Regular' },
  cardTotal: { fontSize: 14, fontFamily: 'PlusJakartaSans_700Bold' },
  badge: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2 },
  badgeText: { fontSize: 11, fontFamily: 'PlusJakartaSans_600SemiBold' },
  empty: { alignItems: 'center', paddingVertical: 60, gap: 12 },
  emptyText: { fontSize: 14, fontFamily: 'PlusJakartaSans_400Regular' },
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
});
