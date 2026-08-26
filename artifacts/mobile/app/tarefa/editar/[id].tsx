import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useListTasks, useUpdateTask, useListClients } from '@workspace/api-client-react';
import Colors from '@/constants/colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useQueryClient } from '@tanstack/react-query';

function parseDisplayDate(str: string): Date | null {
  const parts = str.split('/');
  if (parts.length !== 3) return null;
  const d = parseInt(parts[0]), m = parseInt(parts[1]) - 1, y = parseInt(parts[2]);
  if (isNaN(d) || isNaN(m) || isNaN(y)) return null;
  return new Date(y, m, d);
}

function toDisplayDate(d: Date | string | null | undefined): string {
  if (!d) return '';
  const date = new Date(d);
  if (isNaN(date.getTime())) return '';
  return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function toDisplayTime(d: Date | string | null | undefined): string {
  if (!d) return '';
  const date = new Date(d);
  return Number.isNaN(date.getTime()) ? '' : `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

function formatDateInput(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
}

export default function EditarTarefaScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const taskId = Number(id);
  const router = useRouter();
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme];
  const queryClient = useQueryClient();

  const { data: tasks, isLoading } = useListTasks({});
  const { data: clients } = useListClients({});
  const { mutate: updateTask, isPending } = useUpdateTask();

  const task = tasks?.find(t => t.id === taskId);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [dueTime, setDueTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [selectedClientId, setSelectedClientId] = useState<number | undefined>();
  const [clientSearch, setClientSearch] = useState('');
  const [showClientPicker, setShowClientPicker] = useState(false);

  useEffect(() => {
    if (task) {
      setTitle(task.title ?? '');
      setDescription((task as any).description ?? '');
      setDueDate(toDisplayDate(task.dueAt));
      setDueTime(toDisplayTime(task.dueAt));
      setEndDate(toDisplayDate((task as any).endAt) || toDisplayDate(task.dueAt));
      setEndTime(toDisplayTime((task as any).endAt) || '17:00');
      setSelectedClientId(task.clientId ?? undefined);
    }
  }, [task]);

  const selectedClient = clients?.find(c => c.id === selectedClientId);
  const filteredClients = clients?.filter(c =>
    c.name.toLowerCase().includes(clientSearch.toLowerCase())
  ) ?? [];

  const handleSave = () => {
    if (!title.trim()) { Alert.alert('Campo obrigatório', 'Informe o título.'); return; }
    const dueAt = parseDisplayDate(dueDate);
    const endAt = parseDisplayDate(endDate);
    if (!dueAt || !endAt || !/^\d{2}:\d{2}$/.test(dueTime) || !/^\d{2}:\d{2}$/.test(endTime)) {
      Alert.alert('Data ou horário inválido', 'Informe início e término em DD/MM/AAAA e HH:MM.'); return;
    }
    const start = new Date(`${dueDate.split('/').reverse().join('-')}T${dueTime}:00`);
    const end = new Date(`${endDate.split('/').reverse().join('-')}T${endTime}:00`);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) {
      Alert.alert('Término inválido', 'O término deve ser posterior ao início.'); return;
    }

    updateTask(
      {
        id: taskId,
        data: {
          title: title.trim(),
          description: description.trim() || null,
          clientId: selectedClientId ?? null,
          dueAt: start.toISOString(),
          endAt: end.toISOString(),
        } as any,
      },
      {
        onSuccess: () => { queryClient.invalidateQueries(); router.back(); },
        onError: () => Alert.alert('Erro', 'Não foi possível atualizar a O.S.'),
      }
    );
  };

  if (isLoading) {
    return (
      <View style={[styles.loading, { backgroundColor: theme.background }]}>
        <ActivityIndicator color={theme.primary} />
      </View>
    );
  }

  if (!task) {
    return (
      <View style={[styles.loading, { backgroundColor: theme.background }]}>
        <Text style={{ color: theme.mutedForeground }}>Ordem não encontrada.</Text>
      </View>
    );
  }

  const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
    <View style={styles.fieldGroup}>
      <Text style={[styles.label, { color: theme.mutedForeground }]}>{label}</Text>
      {children}
    </View>
  );

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.background }]}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <Field label="Título *">
        <TextInput
          style={[styles.input, { borderColor: theme.border, color: theme.foreground, backgroundColor: theme.card }]}
          value={title}
          onChangeText={setTitle}
          placeholder="Ex: Instalação elétrica"
          placeholderTextColor={theme.mutedForeground}
        />
      </Field>

      <Field label="Descrição">
        <TextInput
          style={[styles.textarea, { borderColor: theme.border, color: theme.foreground, backgroundColor: theme.card }]}
          value={description}
          onChangeText={setDescription}
          placeholder="Detalhes do serviço..."
          placeholderTextColor={theme.mutedForeground}
          multiline
          numberOfLines={3}
        />
      </Field>

      <Field label="Cliente">
        <TouchableOpacity
          style={[styles.pickerBtn, { borderColor: theme.border, backgroundColor: theme.card }]}
          onPress={() => setShowClientPicker(v => !v)}
        >
          <Ionicons name="person-outline" size={18} color={theme.mutedForeground} />
          <Text style={[styles.pickerText, { color: selectedClient ? theme.foreground : theme.mutedForeground }]}>
            {selectedClient?.name ?? 'Selecionar cliente (opcional)'}
          </Text>
          <Ionicons name={showClientPicker ? 'chevron-up' : 'chevron-down'} size={16} color={theme.mutedForeground} />
        </TouchableOpacity>
        {showClientPicker && (
          <View style={[styles.dropdown, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <TextInput
              style={[styles.searchInput, { borderColor: theme.border, color: theme.foreground }]}
              placeholder="Buscar..."
              placeholderTextColor={theme.mutedForeground}
              value={clientSearch}
              onChangeText={setClientSearch}
            />
            <TouchableOpacity style={styles.dropdownItem} onPress={() => { setSelectedClientId(undefined); setShowClientPicker(false); }}>
              <Text style={[styles.dropdownItemText, { color: theme.mutedForeground }]}>— Sem cliente —</Text>
            </TouchableOpacity>
            {filteredClients.slice(0, 8).map(c => (
              <TouchableOpacity
                key={c.id}
                style={[styles.dropdownItem, selectedClientId === c.id && { backgroundColor: theme.primary + '18' }]}
                onPress={() => { setSelectedClientId(c.id); setShowClientPicker(false); setClientSearch(''); }}
              >
                <Text style={[styles.dropdownItemText, { color: theme.foreground }]}>{c.name}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </Field>

      <View style={styles.dateRow}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.label, { color: theme.mutedForeground }]}>Data de início *</Text>
          <TextInput
            style={[styles.input, { borderColor: theme.border, color: theme.foreground, backgroundColor: theme.card }]}
            value={dueDate}
            onChangeText={v => setDueDate(formatDateInput(v))}
            placeholder="DD/MM/AAAA"
            placeholderTextColor={theme.mutedForeground}
            keyboardType="number-pad"
            maxLength={10}
          />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.label, { color: theme.mutedForeground }]}>Término *</Text>
          <TextInput
            style={[styles.input, { borderColor: theme.border, color: theme.foreground, backgroundColor: theme.card }]}
            value={endDate}
            onChangeText={v => setEndDate(formatDateInput(v))}
            placeholder="DD/MM/AAAA"
            placeholderTextColor={theme.mutedForeground}
            keyboardType="number-pad"
            maxLength={10}
          />
        </View>
      </View>
      <View style={styles.dateRow}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.label, { color: theme.mutedForeground }]}>Hora de início *</Text>
          <TextInput
            style={[styles.input, { borderColor: theme.border, color: theme.foreground, backgroundColor: theme.card }]}
            value={dueTime}
            onChangeText={setDueTime}
            placeholder="08:00"
            placeholderTextColor={theme.mutedForeground}
            keyboardType="number-pad"
            maxLength={5}
          />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.label, { color: theme.mutedForeground }]}>Hora de término *</Text>
          <TextInput
            style={[styles.input, { borderColor: theme.border, color: theme.foreground, backgroundColor: theme.card }]}
            value={endTime}
            onChangeText={setEndTime}
            placeholder="17:00"
            placeholderTextColor={theme.mutedForeground}
            keyboardType="number-pad"
            maxLength={5}
          />
        </View>
      </View>

      <TouchableOpacity
        style={[styles.saveBtn, { backgroundColor: theme.primary }, isPending && { opacity: 0.6 }]}
        onPress={handleSave}
        disabled={isPending}
      >
        {isPending ? <ActivityIndicator color="#fff" /> : (
          <Text style={styles.saveBtnText}>Salvar alterações</Text>
        )}
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16, paddingBottom: 40 },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  fieldGroup: { marginBottom: 16 },
  label: { fontSize: 11, fontFamily: 'PlusJakartaSans_600SemiBold', letterSpacing: 0.8, marginBottom: 8 },
  input: {
    height: 48, borderWidth: 1, borderRadius: 8,
    paddingHorizontal: 12, fontSize: 15, fontFamily: 'PlusJakartaSans_400Regular',
  },
  textarea: {
    borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10,
    fontSize: 14, fontFamily: 'PlusJakartaSans_400Regular', minHeight: 80, textAlignVertical: 'top',
  },
  pickerBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    height: 48, borderWidth: 1, borderRadius: 8, paddingHorizontal: 12,
  },
  pickerText: { flex: 1, fontSize: 15, fontFamily: 'PlusJakartaSans_400Regular' },
  dropdown: { borderWidth: 1, borderRadius: 8, marginTop: 4, overflow: 'hidden' },
  searchInput: { height: 40, borderBottomWidth: 1, paddingHorizontal: 12, fontSize: 14, fontFamily: 'PlusJakartaSans_400Regular' },
  dropdownItem: { padding: 12 },
  dropdownItemText: { fontSize: 14, fontFamily: 'PlusJakartaSans_400Regular' },
  dateRow: { flexDirection: 'row', gap: 12, marginBottom: 16 },
  saveBtn: { height: 52, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  saveBtnText: { fontSize: 16, fontFamily: 'PlusJakartaSans_600SemiBold', color: '#fff' },
});
