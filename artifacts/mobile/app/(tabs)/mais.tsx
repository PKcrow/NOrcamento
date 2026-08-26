import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useAuth } from '@clerk/clerk-expo';
import { Ionicons } from '@expo/vector-icons';
import { useGetMe, useUnregisterPushToken } from '@workspace/api-client-react';
import Colors from '@/constants/colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import {
  clearSavedNativePushToken,
  getSavedNativePushToken,
} from '@/lib/pushNotifications';

type SettingsRow = {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  label: string;
  href: string;
  color?: string;
};

const SECTIONS: { title: string; rows: SettingsRow[] }[] = [
  {
    title: 'MINHA EQUIPE',
    rows: [
      { icon: 'people', label: 'Gerenciar equipe', href: '/equipes' },
      { icon: 'business', label: 'Dados da empresa', href: '/empresa' },
    ],
  },
  {
    title: 'CATÁLOGO',
    rows: [
      { icon: 'pricetags', label: 'Produtos e serviços', href: '/produtos' },
      { icon: 'clipboard', label: 'Modelos de serviço', href: '/modelos' },
    ],
  },
  {
    title: 'FINANÇAS',
    rows: [{ icon: 'bar-chart', label: 'Relatório mensal', href: '/relatorios' }],
  },
];

export default function MaisScreen() {
  const { signOut } = useAuth();
  const router = useRouter();
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme];
  const queryClient = useQueryClient();
  const { mutateAsync: unregisterPushToken } = useUnregisterPushToken();

  const { data: me, isLoading } = useGetMe();

  const handleSignOut = () => {
    Alert.alert('Sair', 'Deseja realmente sair da conta?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Sair',
        style: 'destructive',
        onPress: async () => {
          const token = await getSavedNativePushToken();
          if (token) {
            try {
              await unregisterPushToken({ data: { token } });
            } catch {
              // A failed cleanup must never prevent the user from signing out.
            }
            await clearSavedNativePushToken();
          }
          await signOut();
          queryClient.clear();
        },
      },
    ]);
  };

  if (isLoading) {
    return (
      <View style={[styles.loading, { backgroundColor: theme.background }]}>
        <ActivityIndicator color={theme.primary} />
      </View>
    );
  }

  return (
    <ScrollView style={[styles.container, { backgroundColor: theme.background }]}>
      {/* Profile card */}
      <View style={[styles.profileCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
        <View style={[styles.avatar, { backgroundColor: theme.primary }]}>
          <Text style={styles.avatarText}>{(me?.name ?? 'U').charAt(0).toUpperCase()}</Text>
        </View>
        <View style={styles.profileInfo}>
          <Text style={[styles.profileName, { color: theme.foreground }]}>{me?.name ?? '—'}</Text>
          <Text style={[styles.profileEmail, { color: theme.mutedForeground }]}>{me?.email ?? '—'}</Text>
          {me?.teamName ? (
            <View style={styles.teamRow}>
              <Ionicons name="people-outline" size={12} color={theme.mutedForeground} />
              <Text style={[styles.teamText, { color: theme.mutedForeground }]}>{me.teamName}</Text>
              {me.role && (
                <View style={[styles.roleBadge, { backgroundColor: theme.primary + '22' }]}>
                  <Text style={[styles.roleBadgeText, { color: theme.primary }]}>
                    {me.role === 'owner' ? 'Proprietário' : 'Membro'}
                  </Text>
                </View>
              )}
            </View>
          ) : (
            <TouchableOpacity onPress={() => router.push('/onboarding')}>
              <Text style={[styles.noTeamLink, { color: theme.primary }]}>Criar ou entrar em uma equipe →</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Settings sections */}
      {SECTIONS.map(section => (
        <View key={section.title} style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.mutedForeground }]}>{section.title}</Text>
          <View style={[styles.sectionCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
            {section.rows.map((row, i) => (
              <TouchableOpacity
                key={row.href}
                style={[
                  styles.settingsRow,
                  i < section.rows.length - 1 && { borderBottomWidth: 1, borderBottomColor: theme.border },
                ]}
                onPress={() => router.push(row.href as any)}
              >
                <View style={[styles.rowIcon, { backgroundColor: (row.color ?? theme.primary) + '18' }]}>
                  <Ionicons name={row.icon} size={18} color={row.color ?? theme.primary} />
                </View>
                <Text style={[styles.rowLabel, { color: theme.foreground }]}>{row.label}</Text>
                <Ionicons name="chevron-forward" size={16} color={theme.mutedForeground} />
              </TouchableOpacity>
            ))}
          </View>
        </View>
      ))}

      {/* Sign out */}
      <View style={styles.section}>
        <TouchableOpacity
          style={[styles.signOutBtn, { borderColor: theme.destructive }]}
          onPress={handleSignOut}
        >
          <Ionicons name="log-out-outline" size={20} color={theme.destructive} />
          <Text style={[styles.signOutText, { color: theme.destructive }]}>Sair da conta</Text>
        </TouchableOpacity>
      </View>

      <Text style={[styles.version, { color: theme.mutedForeground }]}>Gestão de Autônomos v1.0</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    margin: 16,
    marginBottom: 8,
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  avatarText: { fontSize: 24, fontFamily: 'PlusJakartaSans_700Bold', color: '#fff' },
  profileInfo: { flex: 1 },
  profileName: { fontSize: 16, fontFamily: 'PlusJakartaSans_700Bold', marginBottom: 2 },
  profileEmail: { fontSize: 13, fontFamily: 'PlusJakartaSans_400Regular', marginBottom: 6 },
  teamRow: { flexDirection: 'row', alignItems: 'center', gap: 5, flexWrap: 'wrap' },
  teamText: { fontSize: 12, fontFamily: 'PlusJakartaSans_400Regular' },
  roleBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  roleBadgeText: { fontSize: 10, fontFamily: 'PlusJakartaSans_600SemiBold' },
  noTeamLink: { fontSize: 13, fontFamily: 'PlusJakartaSans_600SemiBold' },
  section: { paddingHorizontal: 16, marginTop: 16 },
  sectionTitle: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  sectionCard: { borderRadius: 12, borderWidth: 1, overflow: 'hidden' },
  settingsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 13,
  },
  rowIcon: {
    width: 34,
    height: 34,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowLabel: { flex: 1, fontSize: 15, fontFamily: 'PlusJakartaSans_500Medium' },
  signOutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1.5,
  },
  signOutText: { fontSize: 15, fontFamily: 'PlusJakartaSans_600SemiBold' },
  version: { fontSize: 12, fontFamily: 'PlusJakartaSans_400Regular', textAlign: 'center', paddingVertical: 24 },
});
