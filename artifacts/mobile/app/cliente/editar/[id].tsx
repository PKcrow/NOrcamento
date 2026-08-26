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
import { useGetClient, useUpdateClient } from '@workspace/api-client-react';
import Colors from '@/constants/colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useQueryClient } from '@tanstack/react-query';

export default function EditarClienteScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const clientId = Number(id);
  const router = useRouter();
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme];
  const queryClient = useQueryClient();

  const { data: client, isLoading } = useGetClient(clientId);
  const { mutate: updateClient, isPending } = useUpdateClient();

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (client) {
      setName(client.name ?? '');
      setPhone(client.phone ?? '');
      setEmail(client.email ?? '');
      setNotes((client as any).notes ?? '');
    }
  }, [client]);

  const handleSave = () => {
    if (!name.trim()) { Alert.alert('Campo obrigatório', 'Informe o nome do cliente.'); return; }
    updateClient(
      {
        id: clientId,
        data: {
          name: name.trim(),
          phone: phone.trim() || null,
          email: email.trim() || null,
          notes: notes.trim() || null,
        } as any,
      },
      {
        onSuccess: () => { queryClient.invalidateQueries(); router.back(); },
        onError: () => Alert.alert('Erro', 'Não foi possível atualizar o cliente.'),
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

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.background }]}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      {[
        { key: 'name', label: 'Nome *', value: name, onChange: setName, placeholder: 'Nome do cliente', icon: 'person-outline' as const, keyboard: 'default' as const, cap: 'words' as const },
        { key: 'phone', label: 'Telefone', value: phone, onChange: setPhone, placeholder: '(11) 99999-9999', icon: 'call-outline' as const, keyboard: 'phone-pad' as const, cap: 'none' as const },
        { key: 'email', label: 'E-mail', value: email, onChange: setEmail, placeholder: 'cliente@email.com', icon: 'mail-outline' as const, keyboard: 'email-address' as const, cap: 'none' as const },
      ].map(f => (
        <View key={f.key} style={styles.fieldGroup}>
          <Text style={[styles.label, { color: theme.mutedForeground }]}>{f.label}</Text>
          <View style={[styles.inputRow, { borderColor: theme.border, backgroundColor: theme.card }]}>
            <Ionicons name={f.icon} size={18} color={theme.mutedForeground} style={styles.inputIcon} />
            <TextInput
              style={[styles.input, { color: theme.foreground }]}
              value={f.value}
              onChangeText={f.onChange}
              placeholder={f.placeholder}
              placeholderTextColor={theme.mutedForeground}
              keyboardType={f.keyboard}
              autoCapitalize={f.cap}
            />
          </View>
        </View>
      ))}

      <View style={styles.fieldGroup}>
        <Text style={[styles.label, { color: theme.mutedForeground }]}>Observações</Text>
        <View style={[styles.textareaRow, { borderColor: theme.border, backgroundColor: theme.card }]}>
          <Ionicons name="document-text-outline" size={18} color={theme.mutedForeground} style={[styles.inputIcon, { paddingTop: 2 }]} />
          <TextInput
            style={[styles.textarea, { color: theme.foreground }]}
            value={notes}
            onChangeText={setNotes}
            placeholder="Anotações sobre o cliente..."
            placeholderTextColor={theme.mutedForeground}
            multiline
            numberOfLines={3}
          />
        </View>
      </View>

      <TouchableOpacity
        style={[styles.saveBtn, { backgroundColor: theme.primary }, isPending && { opacity: 0.6 }]}
        onPress={handleSave}
        disabled={isPending}
      >
        {isPending ? <ActivityIndicator color="#fff" /> : (
          <>
            <Ionicons name="checkmark-circle-outline" size={20} color="#fff" />
            <Text style={styles.saveBtnText}>Salvar alterações</Text>
          </>
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
  inputRow: {
    flexDirection: 'row', alignItems: 'center',
    borderWidth: 1, borderRadius: 8, height: 48, paddingRight: 12,
  },
  inputIcon: { paddingHorizontal: 12 },
  input: { flex: 1, height: '100%', fontSize: 15, fontFamily: 'PlusJakartaSans_400Regular', paddingVertical: 0 },
  textareaRow: {
    flexDirection: 'row', borderWidth: 1, borderRadius: 8,
    paddingVertical: 10, paddingRight: 12, minHeight: 88, alignItems: 'flex-start',
  },
  textarea: { flex: 1, fontSize: 14, fontFamily: 'PlusJakartaSans_400Regular', textAlignVertical: 'top', paddingTop: 0 },
  saveBtn: {
    height: 52, borderRadius: 10, alignItems: 'center', justifyContent: 'center',
    flexDirection: 'row', gap: 8, marginTop: 8,
  },
  saveBtnText: { fontSize: 16, fontFamily: 'PlusJakartaSans_600SemiBold', color: '#fff' },
});
