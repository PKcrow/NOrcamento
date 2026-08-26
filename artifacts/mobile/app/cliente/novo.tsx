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
import { useRouter } from 'expo-router';
import { useCreateClient } from '@workspace/api-client-react';
import Colors from '@/constants/colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useQueryClient } from '@tanstack/react-query';

export default function NovoClienteScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme ?? 'light'];
  const queryClient = useQueryClient();

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [notes, setNotes] = useState('');

  const { mutate: createClient, isPending } = useCreateClient();

  const handleSubmit = () => {
    if (!name.trim()) {
      Alert.alert('Campo obrigatório', 'Informe o nome do cliente.');
      return;
    }
    createClient(
      {
        data: {
          name: name.trim(),
          phone: phone.trim() || undefined,
          email: email.trim() || undefined,
          notes: notes.trim() || undefined,
        } as any,
      },
      {
        onSuccess: (client: any) => {
          queryClient.invalidateQueries();
          router.replace(`/cliente/${client.id}`);
        },
        onError: () => {
          Alert.alert('Erro', 'Não foi possível cadastrar o cliente.');
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
      <View style={styles.section}>
        <Text style={[styles.label, { color: theme.foreground }]}>Nome *</Text>
        <TextInput
          style={[styles.input, { borderColor: theme.border, color: theme.foreground, backgroundColor: theme.card }]}
          placeholder="Nome completo ou razão social"
          placeholderTextColor={theme.mutedForeground}
          value={name}
          onChangeText={setName}
          returnKeyType="next"
          autoCapitalize="words"
        />
      </View>

      <View style={styles.section}>
        <Text style={[styles.label, { color: theme.foreground }]}>Telefone</Text>
        <TextInput
          style={[styles.input, { borderColor: theme.border, color: theme.foreground, backgroundColor: theme.card }]}
          placeholder="(11) 99999-9999"
          placeholderTextColor={theme.mutedForeground}
          value={phone}
          onChangeText={setPhone}
          keyboardType="phone-pad"
          returnKeyType="next"
        />
      </View>

      <View style={styles.section}>
        <Text style={[styles.label, { color: theme.foreground }]}>E-mail</Text>
        <TextInput
          style={[styles.input, { borderColor: theme.border, color: theme.foreground, backgroundColor: theme.card }]}
          placeholder="cliente@email.com"
          placeholderTextColor={theme.mutedForeground}
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          returnKeyType="next"
        />
      </View>

      <View style={styles.section}>
        <Text style={[styles.label, { color: theme.foreground }]}>Observações</Text>
        <TextInput
          style={[styles.textarea, { borderColor: theme.border, color: theme.foreground, backgroundColor: theme.card }]}
          placeholder="Endereço, referências, informações adicionais..."
          placeholderTextColor={theme.mutedForeground}
          value={notes}
          onChangeText={setNotes}
          multiline
          numberOfLines={4}
        />
      </View>

      <TouchableOpacity
        style={[styles.submitBtn, { backgroundColor: theme.primary }, isPending && { opacity: 0.6 }]}
        onPress={handleSubmit}
        disabled={isPending}
      >
        {isPending ? (
          <ActivityIndicator color="#ffffff" />
        ) : (
          <Text style={styles.submitBtnText}>Cadastrar cliente</Text>
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
    minHeight: 100,
    textAlignVertical: 'top',
  },
  submitBtn: {
    height: 52,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitBtnText: { fontSize: 16, fontFamily: 'PlusJakartaSans_600SemiBold', color: '#ffffff' },
});
