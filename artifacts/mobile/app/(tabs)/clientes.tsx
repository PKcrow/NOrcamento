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
import { useListClients } from '@workspace/api-client-react';
import Colors from '@/constants/colors';
import { useColorScheme } from '@/hooks/useColorScheme';

export default function ClientesScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme ?? 'light'];

  const [search, setSearch] = useState('');

  const { data: clients, isRefetching, refetch } = useListClients({ search: search || undefined });

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      {/* Search bar */}
      <View style={[styles.searchRow, { backgroundColor: theme.card, borderBottomColor: theme.border }]}>
        <Ionicons name="search-outline" size={18} color={theme.mutedForeground} style={styles.searchIcon} />
        <TextInput
          style={[styles.searchInput, { color: theme.foreground }]}
          placeholder="Buscar cliente..."
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

      <FlatList
        data={clients ?? []}
        keyExtractor={item => String(item.id)}
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={theme.primary} />
        }
        contentContainerStyle={styles.listContent}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}
            onPress={() => router.push(`/cliente/${item.id}`)}
          >
            <View style={styles.cardRow}>
              <View style={[styles.avatar, { backgroundColor: theme.primary + '22' }]}>
                <Text style={[styles.avatarText, { color: theme.primary }]}>
                  {item.name.charAt(0).toUpperCase()}
                </Text>
              </View>
              <View style={styles.cardMain}>
                <Text style={[styles.cardTitle, { color: theme.foreground }]} numberOfLines={1}>
                  {item.name}
                </Text>
                {item.phone && (
                  <Text style={[styles.cardSub, { color: theme.mutedForeground }]}>{item.phone}</Text>
                )}
                {item.email && (
                  <Text style={[styles.cardSub, { color: theme.mutedForeground }]}>{item.email}</Text>
                )}
              </View>
              <Ionicons name="chevron-forward" size={18} color={theme.mutedForeground} />
            </View>
          </TouchableOpacity>
        )}
        ListEmptyComponent={() => (
          <View style={styles.empty}>
            <Ionicons name="people-outline" size={48} color={theme.mutedForeground} />
            <Text style={[styles.emptyText, { color: theme.mutedForeground }]}>
              {search ? 'Nenhum cliente encontrado.' : 'Nenhum cliente cadastrado.'}
            </Text>
          </View>
        )}
      />

      {/* FAB */}
      <TouchableOpacity
        style={[styles.fab, { backgroundColor: theme.primary }]}
        onPress={() => router.push('/cliente/novo')}
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
  listContent: { padding: 12, paddingBottom: 80 },
  card: {
    borderRadius: 10,
    borderWidth: 1,
    padding: 14,
    marginBottom: 8,
  },
  cardRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontSize: 18, fontFamily: 'PlusJakartaSans_700Bold' },
  cardMain: { flex: 1 },
  cardTitle: { fontSize: 15, fontFamily: 'PlusJakartaSans_600SemiBold', marginBottom: 2 },
  cardSub: { fontSize: 12, fontFamily: 'PlusJakartaSans_400Regular' },
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
