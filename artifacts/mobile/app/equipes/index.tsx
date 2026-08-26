import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  Share,
  ActivityIndicator,
} from 'react-native';
// Clipboard helper — uses Web API on browser, falls back gracefully on native
const copyToClipboard = async (text: string) => {
  if (typeof navigator !== 'undefined' && navigator.clipboard) {
    await navigator.clipboard.writeText(text);
  }
};
import { Ionicons } from '@expo/vector-icons';
import {
  useGetMe,
  useGetTeam,
  useListTeams,
  useCreateTeam,
  useJoinTeam,
  useSwitchTeam,
  useUpdateTeamMemberRole,
  useRemoveTeamMember,
} from '@workspace/api-client-react';
import Colors from '@/constants/colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useQueryClient } from '@tanstack/react-query';

export default function EquipesScreen() {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme];
  const queryClient = useQueryClient();

  const [showCreateForm, setShowCreateForm] = useState(false);
  const [showJoinForm, setShowJoinForm] = useState(false);
  const [newTeamName, setNewTeamName] = useState('');
  const [inviteCode, setInviteCode] = useState('');

  const { data: me } = useGetMe();
  const { data: team, isLoading: teamLoading } = useGetTeam();
  const { data: teams } = useListTeams();

  const { mutate: createTeam, isPending: creating } = useCreateTeam();
  const { mutate: joinTeam, isPending: joining } = useJoinTeam();
  const { mutate: switchTeam, isPending: switching } = useSwitchTeam();
  const { mutate: updateRole, isPending: updatingRole } = useUpdateTeamMemberRole();
  const { mutate: removeMember, isPending: removing } = useRemoveTeamMember();

  const isOwner = me?.role === 'owner';

  const refresh = () => queryClient.invalidateQueries();

  const handleCopyCode = async () => {
    if (!team?.inviteCode) return;
    await copyToClipboard(team.inviteCode);
    Alert.alert('Copiado!', 'Código de convite copiado para a área de transferência.');
  };

  const handleShareCode = async () => {
    if (!team?.inviteCode) return;
    await Share.share({
      message: `Entre na equipe "${team.name}" no app Gestão de Autônomos usando o código: ${team.inviteCode}`,
      title: 'Convite para equipe',
    });
  };

  const handleCreateTeam = () => {
    if (!newTeamName.trim()) {
      Alert.alert('Campo obrigatório', 'Informe o nome da equipe.');
      return;
    }
    createTeam(
      { data: { name: newTeamName.trim() } },
      {
        onSuccess: () => {
          setShowCreateForm(false);
          setNewTeamName('');
          refresh();
        },
        onError: () => Alert.alert('Erro', 'Não foi possível criar a equipe.'),
      }
    );
  };

  const handleJoinTeam = () => {
    if (!inviteCode.trim()) {
      Alert.alert('Campo obrigatório', 'Informe o código de convite.');
      return;
    }
    joinTeam(
      { data: { inviteCode: inviteCode.trim() } },
      {
        onSuccess: () => {
          setShowJoinForm(false);
          setInviteCode('');
          refresh();
        },
        onError: () => Alert.alert('Código inválido', 'Verifique o código e tente novamente.'),
      }
    );
  };

  const handleChangeRole = (userId: string, currentRole: string) => {
    if (!isOwner) return;
    const newRole = currentRole === 'owner' ? 'member' : 'owner';
    Alert.alert(
      'Alterar cargo',
      `Alterar para ${newRole === 'owner' ? 'Proprietário' : 'Membro'}?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Confirmar',
          onPress: () =>
            updateRole(
              { userId, data: { role: newRole } },
              { onSuccess: refresh, onError: () => Alert.alert('Erro', 'Não foi possível alterar o cargo.') }
            ),
        },
      ]
    );
  };

  const handleRemoveMember = (userId: string, name: string) => {
    if (!isOwner) return;
    Alert.alert(
      'Remover membro',
      `Remover ${name} da equipe?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Remover',
          style: 'destructive',
          onPress: () =>
            removeMember(
              { userId },
              { onSuccess: refresh, onError: () => Alert.alert('Erro', 'Não foi possível remover o membro.') }
            ),
        },
      ]
    );
  };

  const handleSwitchTeam = (teamId: string) => {
    if (teamId === me?.teamId || switching) return;
    switchTeam({ data: { teamId } }, { onSuccess: refresh });
  };

  if (teamLoading) {
    return (
      <View style={[styles.loading, { backgroundColor: theme.background }]}>
        <ActivityIndicator color={theme.primary} />
      </View>
    );
  }

  return (
    <ScrollView style={[styles.container, { backgroundColor: theme.background }]} contentContainerStyle={styles.content}>

      {/* Current team */}
      {team && (
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.mutedForeground }]}>EQUIPE ATIVA</Text>
          <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <View style={styles.teamHeader}>
              <View style={[styles.teamIcon, { backgroundColor: theme.primary + '22' }]}>
                <Ionicons name="people" size={22} color={theme.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.teamName, { color: theme.foreground }]}>{team.name}</Text>
                <Text style={[styles.teamMeta, { color: theme.mutedForeground }]}>
                  {team.members.length} {team.members.length === 1 ? 'membro' : 'membros'}
                </Text>
              </View>
            </View>

            {/* Invite code */}
            <View style={[styles.codeBox, { backgroundColor: theme.muted, borderColor: theme.border }]}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.codeLabel, { color: theme.mutedForeground }]}>Código de convite</Text>
                <Text style={[styles.codeValue, { color: theme.foreground }]}>{team.inviteCode}</Text>
              </View>
              <TouchableOpacity style={styles.codeBtn} onPress={handleCopyCode}>
                <Ionicons name="copy-outline" size={18} color={theme.primary} />
              </TouchableOpacity>
              <TouchableOpacity style={styles.codeBtn} onPress={handleShareCode}>
                <Ionicons name="share-outline" size={18} color={theme.primary} />
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}

      {/* Members */}
      {team && team.members.length > 0 && (
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.mutedForeground }]}>MEMBROS</Text>
          <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
            {team.members.map((member, i) => (
              <View
                key={member.id}
                style={[
                  styles.memberRow,
                  i < team.members.length - 1 && { borderBottomWidth: 1, borderBottomColor: theme.border },
                ]}
              >
                <View style={[styles.memberAvatar, { backgroundColor: theme.primary + '22' }]}>
                  <Text style={[styles.memberAvatarText, { color: theme.primary }]}>
                    {member.name.charAt(0).toUpperCase()}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.memberName, { color: theme.foreground }]}>{member.name}</Text>
                  <Text style={[styles.memberEmail, { color: theme.mutedForeground }]}>{member.email}</Text>
                </View>
                <View style={[styles.roleBadge, {
                  backgroundColor: member.role === 'owner' ? theme.primary + '22' : theme.muted
                }]}>
                  <Text style={[styles.roleBadgeText, {
                    color: member.role === 'owner' ? theme.primary : theme.mutedForeground
                  }]}>
                    {member.role === 'owner' ? 'Proprietário' : 'Membro'}
                  </Text>
                </View>
                {isOwner && member.id !== me?.id && (
                  <TouchableOpacity
                    style={styles.memberAction}
                    onPress={() => {
                      Alert.alert(member.name, 'Escolha uma ação:', [
                        { text: 'Cancelar', style: 'cancel' },
                        {
                          text: member.role === 'owner' ? 'Tornar Membro' : 'Tornar Proprietário',
                          onPress: () => handleChangeRole(member.id, member.role),
                        },
                        {
                          text: 'Remover da equipe',
                          style: 'destructive',
                          onPress: () => handleRemoveMember(member.id, member.name),
                        },
                      ]);
                    }}
                  >
                    <Ionicons name="ellipsis-vertical" size={18} color={theme.mutedForeground} />
                  </TouchableOpacity>
                )}
              </View>
            ))}
          </View>
        </View>
      )}

      {/* Other teams */}
      {teams && teams.length > 1 && (
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.mutedForeground }]}>OUTRAS EQUIPES</Text>
          <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
            {teams.filter(t => t.id !== me?.teamId).map((t, i, arr) => (
              <TouchableOpacity
                key={t.id}
                style={[
                  styles.teamRow,
                  i < arr.length - 1 && { borderBottomWidth: 1, borderBottomColor: theme.border },
                ]}
                onPress={() => handleSwitchTeam(t.id)}
                disabled={switching}
              >
                <Ionicons name="swap-horizontal-outline" size={18} color={theme.primary} />
                <Text style={[styles.teamRowText, { color: theme.foreground }]}>{t.name}</Text>
                <Text style={[styles.teamRoleText, { color: theme.mutedForeground }]}>
                  {t.role === 'owner' ? 'Proprietário' : 'Membro'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}

      {/* Create / Join */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: theme.mutedForeground }]}>AÇÕES</Text>
        <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>

          {/* Create team */}
          <TouchableOpacity
            style={[styles.actionRow, { borderBottomWidth: 1, borderBottomColor: theme.border }]}
            onPress={() => { setShowCreateForm(v => !v); setShowJoinForm(false); }}
          >
            <Ionicons name="add-circle-outline" size={20} color={theme.primary} />
            <Text style={[styles.actionText, { color: theme.foreground }]}>Criar nova equipe</Text>
            <Ionicons name={showCreateForm ? 'chevron-up' : 'chevron-down'} size={16} color={theme.mutedForeground} />
          </TouchableOpacity>
          {showCreateForm && (
            <View style={styles.formBox}>
              <TextInput
                style={[styles.input, { borderColor: theme.border, color: theme.foreground, backgroundColor: theme.background }]}
                placeholder="Nome da equipe"
                placeholderTextColor={theme.mutedForeground}
                value={newTeamName}
                onChangeText={setNewTeamName}
              />
              <TouchableOpacity
                style={[styles.submitBtn, { backgroundColor: theme.primary }]}
                onPress={handleCreateTeam}
                disabled={creating}
              >
                {creating ? <ActivityIndicator color="#fff" size="small" /> : (
                  <Text style={styles.submitBtnText}>Criar equipe</Text>
                )}
              </TouchableOpacity>
            </View>
          )}

          {/* Join team */}
          <TouchableOpacity
            style={styles.actionRow}
            onPress={() => { setShowJoinForm(v => !v); setShowCreateForm(false); }}
          >
            <Ionicons name="enter-outline" size={20} color={theme.primary} />
            <Text style={[styles.actionText, { color: theme.foreground }]}>Entrar com código de convite</Text>
            <Ionicons name={showJoinForm ? 'chevron-up' : 'chevron-down'} size={16} color={theme.mutedForeground} />
          </TouchableOpacity>
          {showJoinForm && (
            <View style={styles.formBox}>
              <TextInput
                style={[styles.input, { borderColor: theme.border, color: theme.foreground, backgroundColor: theme.background }]}
                placeholder="Código de convite"
                placeholderTextColor={theme.mutedForeground}
                value={inviteCode}
                onChangeText={setInviteCode}
                autoCapitalize="none"
              />
              <TouchableOpacity
                style={[styles.submitBtn, { backgroundColor: theme.primary }]}
                onPress={handleJoinTeam}
                disabled={joining}
              >
                {joining ? <ActivityIndicator color="#fff" size="small" /> : (
                  <Text style={styles.submitBtnText}>Entrar na equipe</Text>
                )}
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16, paddingBottom: 40 },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  section: { marginBottom: 20 },
  sectionTitle: { fontSize: 11, fontFamily: 'PlusJakartaSans_600SemiBold', letterSpacing: 0.8, marginBottom: 8 },
  card: { borderRadius: 12, borderWidth: 1 },
  teamHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 },
  teamIcon: { width: 44, height: 44, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  teamName: { fontSize: 16, fontFamily: 'PlusJakartaSans_700Bold', marginBottom: 2 },
  teamMeta: { fontSize: 13, fontFamily: 'PlusJakartaSans_400Regular' },
  codeBox: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 14,
    marginBottom: 14,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    gap: 8,
  },
  codeLabel: { fontSize: 11, fontFamily: 'PlusJakartaSans_500Medium', marginBottom: 2 },
  codeValue: { fontSize: 16, fontFamily: 'PlusJakartaSans_700Bold', letterSpacing: 1 },
  codeBtn: { padding: 6 },
  memberRow: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12 },
  memberAvatar: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  memberAvatarText: { fontSize: 16, fontFamily: 'PlusJakartaSans_700Bold' },
  memberName: { fontSize: 14, fontFamily: 'PlusJakartaSans_600SemiBold', marginBottom: 2 },
  memberEmail: { fontSize: 12, fontFamily: 'PlusJakartaSans_400Regular' },
  roleBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  roleBadgeText: { fontSize: 11, fontFamily: 'PlusJakartaSans_600SemiBold' },
  memberAction: { padding: 6 },
  teamRow: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14 },
  teamRowText: { flex: 1, fontSize: 14, fontFamily: 'PlusJakartaSans_500Medium' },
  teamRoleText: { fontSize: 12, fontFamily: 'PlusJakartaSans_400Regular' },
  actionRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 },
  actionText: { flex: 1, fontSize: 15, fontFamily: 'PlusJakartaSans_500Medium' },
  formBox: { paddingHorizontal: 14, paddingBottom: 14, gap: 10 },
  input: {
    height: 46,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    fontSize: 15,
    fontFamily: 'PlusJakartaSans_400Regular',
  },
  submitBtn: { height: 46, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  submitBtnText: { fontSize: 15, fontFamily: 'PlusJakartaSans_600SemiBold', color: '#fff' },
});
