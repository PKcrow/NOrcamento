import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import {
  useListClients,
  useCreateClient,
  useCreateTask,
  getListClientsQueryKey,
} from '@workspace/api-client-react';
import Colors from '@/constants/colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useQueryClient } from '@tanstack/react-query';

export default function NovaTarefaScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ clientId?: string }>();
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme ?? 'light'];
  const queryClient = useQueryClient();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [selectedClientId, setSelectedClientId] = useState<number | null>(
    params.clientId ? Number(params.clientId) : null
  );
  const [showClientPicker, setShowClientPicker] = useState(false);
  const [clientSearch, setClientSearch] = useState('');
  const [showNewClientForm, setShowNewClientForm] = useState(false);
  const [newClientName, setNewClientName] = useState('');
  const [newClientPhone, setNewClientPhone] = useState('');
  const [newClientEmail, setNewClientEmail] = useState('');
  const [dueAt, setDueAt] = useState('');
  const [startTime, setStartTime] = useState('08:00');
  const [endTime, setEndTime] = useState('17:00');

  const { data: clients } = useListClients({ search: clientSearch || undefined });
  const { mutate: createTask, isPending } = useCreateTask();
  const { mutate: createClient, isPending: isCreatingClient } = useCreateClient();

  const selectedClient = clients?.find(c => c.id === selectedClientId);

  const handleCreateClient = () => {
    if (!newClientName.trim()) {
      Alert.alert('Campo obrigatório', 'Informe o nome do cliente.');
      return;
    }

    createClient(
      {
        data: {
          name: newClientName.trim(),
          phone: newClientPhone.trim() || undefined,
          email: newClientEmail.trim() || undefined,
        } as any,
      },
      {
        onSuccess: (client: any) => {
          queryClient.invalidateQueries({ queryKey: getListClientsQueryKey() });
          setSelectedClientId(client.id);
          setShowNewClientForm(false);
          setShowClientPicker(false);
          setClientSearch('');
          setNewClientName('');
          setNewClientPhone('');
          setNewClientEmail('');
        },
        onError: () => {
          Alert.alert('Erro', 'Não foi possível cadastrar o cliente.');
        },
      },
    );
  };

  const handleSubmit = () => {
    if (!title.trim()) {
      Alert.alert('Campo obrigatório', 'Informe o título da ordem de serviço.');
      return;
    }
    if (!dueAt.trim()) {
      Alert.alert('Campo obrigatório', 'Informe a data de início (DD/MM/AAAA).');
      return;
    }
    if (!/^\d{2}\/\d{2}\/\d{4}$/.test(dueAt) || !/^\d{2}:\d{2}$/.test(startTime) || !/^\d{2}:\d{2}$/.test(endTime)) {
      Alert.alert('Data ou horário inválido', 'Use DD/MM/AAAA e horários no formato HH:MM.');
      return;
    }
    const [day, month, year] = dueAt.split('/');
    const parsedDate = new Date(`${year}-${month}-${day}T${startTime}:00`);
    const parsedEnd = new Date(`${year}-${month}-${day}T${endTime}:00`);
    if (isNaN(parsedDate.getTime()) || isNaN(parsedEnd.getTime()) || parsedEnd <= parsedDate) {
      Alert.alert('Horário inválido', 'O término deve ser posterior ao início.');
      return;
    }
    createTask(
      {
        data: {
          title: title.trim(),
          description: description.trim() || undefined,
          clientId: selectedClientId,
          dueAt: parsedDate.toISOString(),
          endAt: parsedEnd.toISOString(),
        } as any,
      },
      {
        onSuccess: (task: any) => {
          queryClient.invalidateQueries();
          router.replace(`/tarefa/${task.id}`);
        },
        onError: () => {
          Alert.alert('Erro', 'Não foi possível criar a ordem de serviço.');
        },
      }
    );
  };

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.background }]}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      {/* Title */}
      <View style={styles.section}>
        <Text style={[styles.label, { color: theme.foreground }]}>Título *</Text>
        <TextInput
          style={[styles.input, { borderColor: theme.border, color: theme.foreground, backgroundColor: theme.card }]}
          placeholder="Ex: Instalação elétrica, Pintura sala..."
          placeholderTextColor={theme.mutedForeground}
          value={title}
          onChangeText={setTitle}
          returnKeyType="next"
        />
      </View>

      {/* Description */}
      <View style={styles.section}>
        <Text style={[styles.label, { color: theme.foreground }]}>Descrição</Text>
        <TextInput
          style={[styles.textarea, { borderColor: theme.border, color: theme.foreground, backgroundColor: theme.card }]}
          placeholder="Detalhe o serviço a ser realizado..."
          placeholderTextColor={theme.mutedForeground}
          value={description}
          onChangeText={setDescription}
          multiline
          numberOfLines={3}
        />
      </View>

      {/* Client picker */}
      <View style={styles.section}>
        <Text style={[styles.label, { color: theme.foreground }]}>Cliente</Text>
        <TouchableOpacity
          style={[styles.pickerBtn, { borderColor: theme.border, backgroundColor: theme.card }]}
          onPress={() => setShowClientPicker(v => !v)}
        >
          <Ionicons name="person-outline" size={18} color={theme.mutedForeground} />
          <Text style={[styles.pickerBtnText, { color: selectedClient ? theme.foreground : theme.mutedForeground }]}>
            {selectedClient ? selectedClient.name : 'Selecionar cliente (opcional)'}
          </Text>
          <Ionicons name={showClientPicker ? 'chevron-up' : 'chevron-down'} size={16} color={theme.mutedForeground} />
        </TouchableOpacity>
        {showClientPicker && (
          <View style={[styles.dropdown, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <TextInput
              style={[styles.dropdownSearch, { borderColor: theme.border, color: theme.foreground }]}
              placeholder="Buscar..."
              placeholderTextColor={theme.mutedForeground}
              value={clientSearch}
              onChangeText={setClientSearch}
            />
            <TouchableOpacity
              style={styles.dropdownItem}
              onPress={() => { setSelectedClientId(null); setShowClientPicker(false); }}
            >
              <Text style={[styles.dropdownItemText, { color: theme.mutedForeground }]}>Nenhum</Text>
            </TouchableOpacity>
            {(clients ?? []).slice(0, 8).map(c => (
              <TouchableOpacity
                key={c.id}
                style={[
                  styles.dropdownItem,
                  selectedClientId === c.id && { backgroundColor: theme.primary + '11' },
                ]}
                onPress={() => {
                  setSelectedClientId(c.id);
                  setShowClientPicker(false);
                  setClientSearch('');
                }}
              >
                <Text style={[styles.dropdownItemText, { color: theme.foreground }]}>{c.name}</Text>
                {selectedClientId === c.id && (
                  <Ionicons name="checkmark" size={16} color={theme.primary} />
                )}
              </TouchableOpacity>
            ))}
            <TouchableOpacity
              style={[styles.newClientButton, { borderTopColor: theme.border }]}
              onPress={() => setShowNewClientForm(v => !v)}
            >
              <Ionicons name="add-circle-outline" size={18} color={theme.primary} />
              <Text style={[styles.newClientButtonText, { color: theme.primary }]}>
                Novo cliente
              </Text>
              <Ionicons
                name={showNewClientForm ? 'chevron-up' : 'chevron-down'}
                size={16}
                color={theme.primary}
              />
            </TouchableOpacity>
            {showNewClientForm && (
              <View style={[styles.newClientForm, { backgroundColor: theme.background }]}>
                <TextInput
                  style={[styles.newClientInput, { borderColor: theme.border, color: theme.foreground, backgroundColor: theme.card }]}
                  placeholder="Nome do cliente *"
                  placeholderTextColor={theme.mutedForeground}
                  value={newClientName}
                  onChangeText={setNewClientName}
                  autoFocus
                />
                <TextInput
                  style={[styles.newClientInput, { borderColor: theme.border, color: theme.foreground, backgroundColor: theme.card }]}
                  placeholder="Telefone (opcional)"
                  placeholderTextColor={theme.mutedForeground}
                  value={newClientPhone}
                  onChangeText={setNewClientPhone}
                  keyboardType="phone-pad"
                />
                <TextInput
                  style={[styles.newClientInput, { borderColor: theme.border, color: theme.foreground, backgroundColor: theme.card }]}
                  placeholder="E-mail (opcional)"
                  placeholderTextColor={theme.mutedForeground}
                  value={newClientEmail}
                  onChangeText={setNewClientEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
                <View style={styles.newClientActions}>
                  <TouchableOpacity
                    style={[styles.newClientCancel, { borderColor: theme.border }]}
                    onPress={() => setShowNewClientForm(false)}
                    disabled={isCreatingClient}
                  >
                    <Text style={[styles.newClientCancelText, { color: theme.foreground }]}>Cancelar</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.newClientSave, { backgroundColor: theme.primary }, isCreatingClient && { opacity: 0.6 }]}
                    onPress={handleCreateClient}
                    disabled={isCreatingClient}
                  >
                    {isCreatingClient ? (
                      <ActivityIndicator color="#ffffff" size="small" />
                    ) : (
                      <Text style={styles.newClientSaveText}>Salvar</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>
        )}
      </View>

      {/* Date */}
      <View style={styles.section}>
        <Text style={[styles.label, { color: theme.foreground }]}>Data de início *</Text>
        <View style={[styles.inputRow, { borderColor: theme.border, backgroundColor: theme.card }]}>
          <Ionicons name="calendar-outline" size={18} color={theme.mutedForeground} style={{ marginLeft: 12 }} />
          <TextInput
            style={[styles.inlineInput, { color: theme.foreground }]}
            placeholder="DD/MM/AAAA"
            placeholderTextColor={theme.mutedForeground}
            value={dueAt}
            onChangeText={v => {
              const cleaned = v.replace(/\D/g, '');
              let formatted = cleaned;
              if (cleaned.length > 2) formatted = `${cleaned.slice(0, 2)}/${cleaned.slice(2)}`;
              if (cleaned.length > 4) formatted = `${cleaned.slice(0, 2)}/${cleaned.slice(2, 4)}/${cleaned.slice(4, 8)}`;
              setDueAt(formatted);
            }}
            keyboardType="numeric"
            maxLength={10}
          />
        </View>
      </View>

      <View style={styles.section}>
        <Text style={[styles.label, { color: theme.foreground }]}>Horário *</Text>
        <View style={styles.timeRow}>
          <TextInput
            style={[styles.timeInput, { borderColor: theme.border, color: theme.foreground, backgroundColor: theme.card }]}
            placeholder="Início (08:00)"
            placeholderTextColor={theme.mutedForeground}
            value={startTime}
            onChangeText={setStartTime}
            keyboardType="numeric"
            maxLength={5}
          />
          <TextInput
            style={[styles.timeInput, { borderColor: theme.border, color: theme.foreground, backgroundColor: theme.card }]}
            placeholder="Término (17:00)"
            placeholderTextColor={theme.mutedForeground}
            value={endTime}
            onChangeText={setEndTime}
            keyboardType="numeric"
            maxLength={5}
          />
        </View>
        <Text style={[styles.scheduleHint, { color: theme.mutedForeground }]}>Atendimentos no mesmo dia são permitidos quando os horários não se sobrepõem.</Text>
      </View>

      {/* Submit */}
      <TouchableOpacity
        style={[styles.submitBtn, { backgroundColor: theme.primary }, isPending && { opacity: 0.6 }]}
        onPress={handleSubmit}
        disabled={isPending}
      >
        {isPending ? (
          <ActivityIndicator color="#ffffff" />
        ) : (
          <Text style={styles.submitBtnText}>Criar ordem de serviço</Text>
        )}
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16, paddingBottom: 40 },
  section: { marginBottom: 20 },
  label: { fontSize: 15, fontFamily: 'PlusJakartaSans_600SemiBold', marginBottom: 8 },
  input: {
    height: 48,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 14,
    fontSize: 15,
    fontFamily: 'PlusJakartaSans_400Regular',
  },
  textarea: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_400Regular',
    minHeight: 80,
    textAlignVertical: 'top',
  },
  pickerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 14,
    height: 48,
  },
  pickerBtnText: { flex: 1, fontSize: 15, fontFamily: 'PlusJakartaSans_400Regular' },
  dropdown: { borderWidth: 1, borderRadius: 8, marginTop: 4, overflow: 'hidden' },
  dropdownSearch: {
    height: 40,
    borderBottomWidth: 1,
    paddingHorizontal: 12,
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_400Regular',
  },
  dropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  newClientButton: {
    minHeight: 44,
    borderTopWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
  },
  newClientButtonText: {
    flex: 1,
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_600SemiBold',
  },
  newClientForm: {
    gap: 8,
    padding: 12,
  },
  newClientInput: {
    height: 42,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_400Regular',
  },
  newClientActions: {
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'flex-end',
  },
  newClientCancel: {
    minHeight: 40,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  newClientCancelText: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_600SemiBold',
  },
  newClientSave: {
    minHeight: 40,
    borderRadius: 8,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  newClientSaveText: {
    color: '#ffffff',
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_600SemiBold',
  },
  dropdownItemText: { fontSize: 14, fontFamily: 'PlusJakartaSans_400Regular' },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 8,
    height: 48,
  },
  inlineInput: {
    flex: 1,
    height: '100%',
    paddingHorizontal: 12,
    fontSize: 15,
    fontFamily: 'PlusJakartaSans_400Regular',
  },
  timeRow: { flexDirection: 'row', gap: 10 },
  timeInput: { flex: 1, height: 48, borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, fontSize: 15, fontFamily: 'PlusJakartaSans_400Regular' },
  scheduleHint: { marginTop: 8, fontSize: 12, lineHeight: 18, fontFamily: 'PlusJakartaSans_400Regular' },
  submitBtn: {
    height: 52,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitBtnText: { fontSize: 16, fontFamily: 'PlusJakartaSans_600SemiBold', color: '#ffffff' },
});
