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
import { Ionicons } from '@expo/vector-icons';
import { useGetCompany, useUpdateCompany } from '@workspace/api-client-react';
import Colors from '@/constants/colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useQueryClient } from '@tanstack/react-query';

export default function EmpresaScreen() {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme];
  const queryClient = useQueryClient();

  const { data: company, isLoading } = useGetCompany();
  const { mutate: updateCompany, isPending } = useUpdateCompany();

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');

  useEffect(() => {
    if (company) {
      setName(company.name ?? '');
      setPhone(company.phone ?? '');
      setEmail(company.email ?? '');
      setAddress(company.address ?? '');
    }
  }, [company]);

  const handleSave = () => {
    if (!name.trim()) {
      Alert.alert('Campo obrigatório', 'Informe o nome da empresa.');
      return;
    }
    updateCompany(
      {
        data: {
          name: name.trim(),
          phone: phone.trim() || null,
          email: email.trim() || null,
          address: address.trim() || null,
        } as any,
      },
      {
        onSuccess: () => {
          queryClient.invalidateQueries();
          Alert.alert('Salvo!', 'Dados da empresa atualizados.');
        },
        onError: () => Alert.alert('Erro', 'Não foi possível salvar.'),
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

  const Field = ({
    label,
    value,
    onChange,
    placeholder,
    keyboardType,
    icon,
  }: {
    label: string;
    value: string;
    onChange: (v: string) => void;
    placeholder?: string;
    keyboardType?: any;
    icon: React.ComponentProps<typeof Ionicons>['name'];
  }) => (
    <View style={styles.fieldGroup}>
      <Text style={[styles.label, { color: theme.mutedForeground }]}>{label}</Text>
      <View style={[styles.inputRow, { borderColor: theme.border, backgroundColor: theme.card }]}>
        <Ionicons name={icon} size={18} color={theme.mutedForeground} style={styles.inputIcon} />
        <TextInput
          style={[styles.input, { color: theme.foreground }]}
          value={value}
          onChangeText={onChange}
          placeholder={placeholder}
          placeholderTextColor={theme.mutedForeground}
          keyboardType={keyboardType}
          autoCapitalize={keyboardType === 'email-address' ? 'none' : 'words'}
        />
      </View>
    </View>
  );

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.background }]}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <View style={[styles.infoBox, { backgroundColor: theme.primary + '11', borderColor: theme.primary + '33' }]}>
        <Ionicons name="information-circle-outline" size={18} color={theme.primary} />
        <Text style={[styles.infoText, { color: theme.primary }]}>
          Esses dados aparecem nos orçamentos impressos enviados aos clientes.
        </Text>
      </View>

      <Field label="Nome da empresa *" value={name} onChange={setName} placeholder="Ex: Elétrica Silva Ltda" icon="business-outline" />
      <Field label="Telefone" value={phone} onChange={setPhone} placeholder="(11) 99999-9999" keyboardType="phone-pad" icon="call-outline" />
      <Field label="E-mail" value={email} onChange={setEmail} placeholder="contato@empresa.com" keyboardType="email-address" icon="mail-outline" />

      <View style={styles.fieldGroup}>
        <Text style={[styles.label, { color: theme.mutedForeground }]}>Endereço</Text>
        <View style={[styles.textareaRow, { borderColor: theme.border, backgroundColor: theme.card }]}>
          <Ionicons name="location-outline" size={18} color={theme.mutedForeground} style={styles.inputIcon} />
          <TextInput
            style={[styles.textarea, { color: theme.foreground }]}
            value={address}
            onChangeText={setAddress}
            placeholder="Rua, número, bairro, cidade - UF"
            placeholderTextColor={theme.mutedForeground}
            multiline
            numberOfLines={2}
          />
        </View>
      </View>

      <TouchableOpacity
        style={[styles.saveBtn, { backgroundColor: theme.primary }, isPending && { opacity: 0.6 }]}
        onPress={handleSave}
        disabled={isPending}
      >
        {isPending ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <>
            <Ionicons name="checkmark-circle-outline" size={20} color="#fff" />
            <Text style={styles.saveBtnText}>Salvar dados</Text>
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
  infoBox: {
    flexDirection: 'row',
    gap: 10,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 20,
    alignItems: 'flex-start',
  },
  infoText: { flex: 1, fontSize: 13, fontFamily: 'PlusJakartaSans_400Regular', lineHeight: 20 },
  fieldGroup: { marginBottom: 16 },
  label: { fontSize: 13, fontFamily: 'PlusJakartaSans_500Medium', marginBottom: 6 },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 8,
    height: 48,
    paddingRight: 12,
  },
  inputIcon: { paddingHorizontal: 12 },
  input: {
    flex: 1,
    height: '100%',
    fontSize: 15,
    fontFamily: 'PlusJakartaSans_400Regular',
    paddingVertical: 0,
  },
  textareaRow: {
    flexDirection: 'row',
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 10,
    paddingRight: 12,
    minHeight: 80,
    alignItems: 'flex-start',
  },
  textarea: {
    flex: 1,
    fontSize: 15,
    fontFamily: 'PlusJakartaSans_400Regular',
    textAlignVertical: 'top',
    paddingTop: 0,
  },
  saveBtn: {
    height: 52,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  saveBtnText: { fontSize: 16, fontFamily: 'PlusJakartaSans_600SemiBold', color: '#fff' },
});
