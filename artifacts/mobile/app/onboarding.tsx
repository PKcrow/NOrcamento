import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useCreateTeam, useJoinTeam } from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';

export default function OnboardingScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();

  const [mode, setMode] = useState<'select' | 'create' | 'join'>('select');
  const [teamName, setTeamName] = useState('');
  const [inviteCode, setInviteCode] = useState('');

  const { mutate: createTeam, isPending: creating } = useCreateTeam();
  const { mutate: joinTeam, isPending: joining } = useJoinTeam();

  const handleCreate = () => {
    if (!teamName.trim()) { Alert.alert('Campo obrigatório', 'Informe o nome da equipe.'); return; }
    createTeam(
      { data: { name: teamName.trim() } },
      {
        onSuccess: () => { queryClient.invalidateQueries(); router.replace('/(tabs)'); },
        onError: () => Alert.alert('Erro', 'Não foi possível criar a equipe.'),
      }
    );
  };

  const handleJoin = () => {
    if (!inviteCode.trim()) { Alert.alert('Campo obrigatório', 'Informe o código de convite.'); return; }
    joinTeam(
      { data: { inviteCode: inviteCode.trim() } },
      {
        onSuccess: () => { queryClient.invalidateQueries(); router.replace('/(tabs)'); },
        onError: () => Alert.alert('Código inválido', 'Verifique o código e tente novamente.'),
      }
    );
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.hero}>
          <View style={styles.logoCircle}>
            <Ionicons name="briefcase" size={40} color="#fff" />
          </View>
          <Text style={styles.title}>Bem-vindo!</Text>
          <Text style={styles.subtitle}>Para começar, crie uma equipe ou entre em uma existente usando um código de convite.</Text>
        </View>

        {mode === 'select' && (
          <View style={styles.options}>
            <TouchableOpacity style={styles.optionCard} onPress={() => setMode('create')}>
              <View style={[styles.optionIcon, { backgroundColor: '#f97316' }]}>
                <Ionicons name="add-circle-outline" size={28} color="#fff" />
              </View>
              <Text style={styles.optionTitle}>Criar nova equipe</Text>
              <Text style={styles.optionDesc}>Comece do zero e convide colaboradores depois.</Text>
              <Ionicons name="chevron-forward" size={20} color="#94a3b8" style={{ alignSelf: 'flex-end' }} />
            </TouchableOpacity>

            <TouchableOpacity style={styles.optionCard} onPress={() => setMode('join')}>
              <View style={[styles.optionIcon, { backgroundColor: '#3b82f6' }]}>
                <Ionicons name="enter-outline" size={28} color="#fff" />
              </View>
              <Text style={styles.optionTitle}>Entrar em uma equipe</Text>
              <Text style={styles.optionDesc}>Use um código de convite para entrar na equipe de alguém.</Text>
              <Ionicons name="chevron-forward" size={20} color="#94a3b8" style={{ alignSelf: 'flex-end' }} />
            </TouchableOpacity>
          </View>
        )}

        {mode === 'create' && (
          <View style={styles.form}>
            <TouchableOpacity onPress={() => setMode('select')} style={styles.backBtn}>
              <Ionicons name="arrow-back" size={18} color="#f97316" />
              <Text style={styles.backText}>Voltar</Text>
            </TouchableOpacity>
            <Text style={styles.formTitle}>Criar equipe</Text>
            <Text style={styles.formLabel}>Nome da equipe *</Text>
            <TextInput
              style={styles.input}
              placeholder="Ex: Serviços Silva"
              placeholderTextColor="#94a3b8"
              value={teamName}
              onChangeText={setTeamName}
              autoCapitalize="words"
            />
            <TouchableOpacity
              style={[styles.submitBtn, creating && { opacity: 0.6 }]}
              onPress={handleCreate}
              disabled={creating}
            >
              {creating ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitBtnText}>Criar equipe</Text>}
            </TouchableOpacity>
          </View>
        )}

        {mode === 'join' && (
          <View style={styles.form}>
            <TouchableOpacity onPress={() => setMode('select')} style={styles.backBtn}>
              <Ionicons name="arrow-back" size={18} color="#f97316" />
              <Text style={styles.backText}>Voltar</Text>
            </TouchableOpacity>
            <Text style={styles.formTitle}>Entrar com código</Text>
            <Text style={styles.formLabel}>Código de convite *</Text>
            <TextInput
              style={styles.input}
              placeholder="Cole o código aqui"
              placeholderTextColor="#94a3b8"
              value={inviteCode}
              onChangeText={setInviteCode}
              autoCapitalize="none"
              autoCorrect={false}
            />
            <TouchableOpacity
              style={[styles.submitBtn, joining && { opacity: 0.6 }]}
              onPress={handleJoin}
              disabled={joining}
            >
              {joining ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitBtnText}>Entrar na equipe</Text>}
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1e293b' },
  content: { flexGrow: 1, padding: 24, paddingTop: 60 },
  hero: { alignItems: 'center', marginBottom: 40 },
  logoCircle: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: '#f97316',
    alignItems: 'center', justifyContent: 'center', marginBottom: 20,
  },
  title: { fontSize: 28, fontFamily: 'PlusJakartaSans_700Bold', color: '#fff', marginBottom: 10 },
  subtitle: {
    fontSize: 15, fontFamily: 'PlusJakartaSans_400Regular',
    color: '#94a3b8', textAlign: 'center', lineHeight: 24,
  },
  options: { gap: 14 },
  optionCard: {
    backgroundColor: '#243147',
    borderRadius: 16,
    padding: 20,
    gap: 8,
    borderWidth: 1,
    borderColor: '#334155',
  },
  optionIcon: { width: 52, height: 52, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  optionTitle: { fontSize: 18, fontFamily: 'PlusJakartaSans_700Bold', color: '#f8fafc' },
  optionDesc: { fontSize: 14, fontFamily: 'PlusJakartaSans_400Regular', color: '#94a3b8' },
  form: { gap: 12 },
  backBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
  backText: { fontSize: 15, fontFamily: 'PlusJakartaSans_500Medium', color: '#f97316' },
  formTitle: { fontSize: 22, fontFamily: 'PlusJakartaSans_700Bold', color: '#fff', marginBottom: 4 },
  formLabel: { fontSize: 14, fontFamily: 'PlusJakartaSans_500Medium', color: '#94a3b8' },
  input: {
    height: 52, backgroundColor: '#243147', borderRadius: 10, borderWidth: 1, borderColor: '#334155',
    paddingHorizontal: 16, fontSize: 16, fontFamily: 'PlusJakartaSans_400Regular', color: '#f8fafc',
  },
  submitBtn: {
    height: 52, backgroundColor: '#f97316', borderRadius: 10,
    alignItems: 'center', justifyContent: 'center', marginTop: 4,
  },
  submitBtnText: { fontSize: 16, fontFamily: 'PlusJakartaSans_600SemiBold', color: '#fff' },
});
