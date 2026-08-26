import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  Switch,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import {
  useListClients,
  useListServiceTemplates,
  useCreateQuote,
} from '@workspace/api-client-react';
import Colors from '@/constants/colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useQueryClient } from '@tanstack/react-query';

type Item = {
  description: string;
  quantity: string;
  unitPrice: string;
};

const parseMoney = (s: string) => parseFloat(s.replace(',', '.')) || 0;

export default function NovoOrcamentoScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ clientId?: string }>();
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme ?? 'light'];
  const queryClient = useQueryClient();

  const [selectedClientId, setSelectedClientId] = useState<number | null>(
    params.clientId ? Number(params.clientId) : null
  );
  const [showClientPicker, setShowClientPicker] = useState(false);
  const [clientSearch, setClientSearch] = useState('');
  const [showTemplatePicker, setShowTemplatePicker] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState<number | null>(null);
  const [notes, setNotes] = useState('');
  const [laborCost, setLaborCost] = useState('');
  const [serviceScopeEnabled, setServiceScopeEnabled] = useState(false);
  const [serviceDescription, setServiceDescription] = useState('');
  const [items, setItems] = useState<Item[]>([
    { description: '', quantity: '1', unitPrice: '' },
  ]);

  const { data: clients } = useListClients({ search: clientSearch || undefined });
  const { data: serviceTemplates } = useListServiceTemplates();
  const { mutate: createQuote, isPending } = useCreateQuote();

  const selectedClient = clients?.find(c => c.id === selectedClientId);

  const itemTotal = items.reduce(
    (sum, it) => sum + parseMoney(it.quantity) * parseMoney(it.unitPrice),
    0
  );
  const total = itemTotal + parseMoney(laborCost);

  const fmt = (v: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

  const addItem = () =>
    setItems(prev => [{ description: '', quantity: '1', unitPrice: '' }, ...prev]);

  const updateItem = (i: number, field: keyof Item, value: string) =>
    setItems(prev => prev.map((it, idx) => (idx === i ? { ...it, [field]: value } : it)));

  const removeItem = (i: number) =>
    setItems(prev => prev.length > 1 ? prev.filter((_, idx) => idx !== i) : prev);

  const applyTemplate = (templateId: number) => {
    const template = serviceTemplates?.find((entry) => entry.id === templateId);
    if (!template) return;
    setSelectedTemplateId(template.id);
    setItems(template.items.map((item) => ({
      description: item.description,
      quantity: String(item.quantity),
      unitPrice: String(item.unitPrice),
    })));
    setLaborCost(String(template.laborCost || ''));
    setServiceScopeEnabled(template.serviceScopeEnabled);
    setServiceDescription(template.serviceDescription ?? '');
    setNotes(template.notes ?? '');
    setShowTemplatePicker(false);
  };

  const handleSubmit = () => {
    if (!selectedClientId) {
      Alert.alert('Campo obrigatório', 'Selecione um cliente.');
      return;
    }
    const validItems = items.filter(it => it.description.trim() && parseMoney(it.unitPrice) > 0);
    if (validItems.length === 0) {
      Alert.alert('Campo obrigatório', 'Adicione pelo menos um item com descrição e valor.');
      return;
    }
    createQuote(
      {
        data: {
          clientId: selectedClientId,
          notes: notes.trim() || undefined,
          laborCost: parseMoney(laborCost),
          serviceScopeEnabled,
          serviceDescription: serviceScopeEnabled ? serviceDescription.trim() || null : null,
          items: validItems.map(it => ({
            description: it.description.trim(),
            quantity: parseMoney(it.quantity) || 1,
            unitPrice: parseMoney(it.unitPrice),
          })),
        } as any,
      },
      {
        onSuccess: (quote: any) => {
          queryClient.invalidateQueries();
          router.replace(`/orcamento/${quote.id}`);
        },
        onError: () => {
          Alert.alert('Erro', 'Não foi possível criar o orçamento. Tente novamente.');
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
      {/* Client picker */}
      <View style={styles.section}>
        <Text style={[styles.label, { color: theme.foreground }]}>Cliente *</Text>
        <TouchableOpacity
          style={[styles.pickerBtn, { borderColor: theme.border, backgroundColor: theme.card }]}
          onPress={() => setShowClientPicker(v => !v)}
        >
          <Ionicons name="person-outline" size={18} color={theme.mutedForeground} />
          <Text style={[styles.pickerBtnText, { color: selectedClient ? theme.foreground : theme.mutedForeground }]}>
            {selectedClient ? selectedClient.name : 'Selecionar cliente...'}
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
            {(clients ?? []).length === 0 && (
              <Text style={[styles.dropdownEmpty, { color: theme.mutedForeground }]}>
                Nenhum cliente encontrado.
              </Text>
            )}
          </View>
        )}
      </View>

      {/* Template picker */}
      <View style={styles.section}>
        <Text style={[styles.label, { color: theme.foreground }]}>Começar com um modelo</Text>
        <TouchableOpacity
          style={[styles.pickerBtn, { borderColor: theme.primary + '66', backgroundColor: theme.card }]}
          onPress={() => setShowTemplatePicker(v => !v)}
        >
          <Ionicons name="clipboard-outline" size={18} color={theme.primary} />
          <Text style={[styles.pickerBtnText, { color: selectedTemplateId ? theme.foreground : theme.mutedForeground }]}>
            {selectedTemplateId
              ? serviceTemplates?.find(template => template.id === selectedTemplateId)?.name ?? 'Modelo selecionado'
              : 'Preencher manualmente'}
          </Text>
          <Ionicons name={showTemplatePicker ? 'chevron-up' : 'chevron-down'} size={16} color={theme.mutedForeground} />
        </TouchableOpacity>
        <Text style={[styles.templateHint, { color: theme.mutedForeground }]}>
          Itens, valores, escopo e condições serão copiados e podem ser ajustados.
        </Text>
        {showTemplatePicker && (
          <View style={[styles.dropdown, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <TouchableOpacity
              style={styles.dropdownItem}
              onPress={() => {
                setSelectedTemplateId(null);
                setShowTemplatePicker(false);
              }}
            >
              <Text style={[styles.dropdownItemText, { color: theme.foreground }]}>Preencher manualmente</Text>
            </TouchableOpacity>
            {(serviceTemplates ?? []).map(template => (
              <TouchableOpacity
                key={template.id}
                style={[
                  styles.dropdownItem,
                  selectedTemplateId === template.id && { backgroundColor: theme.primary + '11' },
                ]}
                onPress={() => applyTemplate(template.id)}
              >
                <View style={styles.templateChoiceCopy}>
                  <Text style={[styles.dropdownItemText, { color: theme.foreground }]}>{template.name}</Text>
                  <Text style={[styles.templateChoiceMeta, { color: theme.mutedForeground }]}>
                    {template.items.length} {template.items.length === 1 ? 'item' : 'itens'}
                  </Text>
                </View>
                {selectedTemplateId === template.id && (
                  <Ionicons name="checkmark" size={16} color={theme.primary} />
                )}
              </TouchableOpacity>
            ))}
            {(serviceTemplates ?? []).length === 0 && (
              <Text style={[styles.dropdownEmpty, { color: theme.mutedForeground }]}>
                Nenhum modelo salvo. Crie um em Mais › Modelos de serviço.
              </Text>
            )}
          </View>
        )}
      </View>

      {/* Service scope */}
      <View style={[styles.scopeBox, { borderColor: theme.border, backgroundColor: theme.card }]}>
        <View style={styles.scopeCopy}>
          <Text style={[styles.label, { color: theme.foreground, marginBottom: 2 }]}>Adicionar escopo do serviço</Text>
          <Text style={[styles.scopeHint, { color: theme.mutedForeground }]}>
            Descreva o que será realizado e o que está incluído.
          </Text>
        </View>
        <Switch
          value={serviceScopeEnabled}
          onValueChange={(enabled) => {
            setServiceScopeEnabled(enabled);
            if (!enabled) setServiceDescription('');
          }}
          trackColor={{ false: theme.border, true: theme.primary + '88' }}
          thumbColor={serviceScopeEnabled ? theme.primary : '#f4f4f5'}
        />
      </View>
      {serviceScopeEnabled && (
        <View style={styles.section}>
          <TextInput
            style={[styles.textarea, { borderColor: theme.border, color: theme.foreground, backgroundColor: theme.card }]}
            placeholder="Descreva o serviço que será realizado..."
            placeholderTextColor={theme.mutedForeground}
            value={serviceDescription}
            onChangeText={setServiceDescription}
            multiline
            numberOfLines={4}
          />
        </View>
      )}

      {/* Items */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={[styles.label, { color: theme.foreground }]}>Itens</Text>
          <TouchableOpacity onPress={addItem} style={[styles.addItemBtn, { borderColor: theme.primary }]}>
            <Ionicons name="add" size={16} color={theme.primary} />
            <Text style={[styles.addItemText, { color: theme.primary }]}>Adicionar</Text>
          </TouchableOpacity>
        </View>
        {items.map((item, i) => (
          <View key={i} style={[styles.itemCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <View style={styles.itemHeaderRow}>
              <Text style={[styles.itemLabel, { color: theme.mutedForeground }]}>Item {i + 1}</Text>
              {items.length > 1 && (
                <TouchableOpacity onPress={() => removeItem(i)}>
                  <Ionicons name="trash-outline" size={16} color={theme.destructive} />
                </TouchableOpacity>
              )}
            </View>
            <TextInput
              style={[styles.input, { borderColor: theme.border, color: theme.foreground }]}
              placeholder="Descrição do item *"
              placeholderTextColor={theme.mutedForeground}
              value={item.description}
              onChangeText={v => updateItem(i, 'description', v)}
            />
            <View style={styles.itemRow}>
              <View style={styles.inputGroup}>
                <Text style={[styles.inputLabel, { color: theme.mutedForeground }]}>Qtd</Text>
                <TextInput
                  style={[styles.input, { borderColor: theme.border, color: theme.foreground }]}
                  placeholder="1"
                  placeholderTextColor={theme.mutedForeground}
                  value={item.quantity}
                  onChangeText={v => updateItem(i, 'quantity', v)}
                  keyboardType="decimal-pad"
                />
              </View>
              <View style={[styles.inputGroup, { flex: 2 }]}>
                <Text style={[styles.inputLabel, { color: theme.mutedForeground }]}>Valor unit.</Text>
                <TextInput
                  style={[styles.input, { borderColor: theme.border, color: theme.foreground }]}
                  placeholder="0,00"
                  placeholderTextColor={theme.mutedForeground}
                  value={item.unitPrice}
                  onChangeText={v => updateItem(i, 'unitPrice', v)}
                  keyboardType="decimal-pad"
                />
              </View>
              <View style={styles.inputGroup}>
                <Text style={[styles.inputLabel, { color: theme.mutedForeground }]}>Total</Text>
                <View style={[styles.totalCell, { borderColor: theme.border }]}>
                  <Text style={[styles.totalCellText, { color: theme.foreground }]}>
                    {fmt(parseMoney(item.quantity) * parseMoney(item.unitPrice))}
                  </Text>
                </View>
              </View>
            </View>
          </View>
        ))}
      </View>

      {/* Labor cost */}
      <View style={styles.section}>
        <Text style={[styles.label, { color: theme.foreground }]}>Mão de obra (opcional)</Text>
        <TextInput
          style={[styles.input, { borderColor: theme.border, color: theme.foreground, backgroundColor: theme.card }]}
          placeholder="0,00"
          placeholderTextColor={theme.mutedForeground}
          value={laborCost}
          onChangeText={setLaborCost}
          keyboardType="decimal-pad"
        />
      </View>

      {/* Notes */}
      <View style={styles.section}>
        <Text style={[styles.label, { color: theme.foreground }]}>Observações</Text>
        <TextInput
          style={[styles.textarea, { borderColor: theme.border, color: theme.foreground, backgroundColor: theme.card }]}
          placeholder="Condições de pagamento, prazo, etc."
          placeholderTextColor={theme.mutedForeground}
          value={notes}
          onChangeText={setNotes}
          multiline
          numberOfLines={3}
        />
      </View>

      {/* Total preview */}
      <View style={[styles.totalRow, { backgroundColor: theme.card, borderColor: theme.border }]}>
        <Text style={[styles.totalLabel, { color: theme.mutedForeground }]}>Total do orçamento</Text>
        <Text style={[styles.totalValue, { color: theme.foreground }]}>{fmt(total)}</Text>
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
          <Text style={styles.submitBtnText}>Criar orçamento</Text>
        )}
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16, paddingBottom: 40 },
  section: { marginBottom: 20 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  label: { fontSize: 15, fontFamily: 'PlusJakartaSans_600SemiBold', marginBottom: 8 },
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
  dropdown: {
    borderWidth: 1,
    borderRadius: 8,
    marginTop: 4,
    overflow: 'hidden',
  },
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
  dropdownItemText: { fontSize: 14, fontFamily: 'PlusJakartaSans_400Regular' },
  dropdownEmpty: { padding: 12, fontSize: 13, fontFamily: 'PlusJakartaSans_400Regular' },
  templateHint: { fontSize: 12, lineHeight: 17, fontFamily: 'PlusJakartaSans_400Regular', marginTop: 6 },
  templateChoiceCopy: { flex: 1 },
  templateChoiceMeta: { fontSize: 11, fontFamily: 'PlusJakartaSans_400Regular', marginTop: 2 },
  scopeBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderRadius: 10,
    padding: 13,
    marginBottom: 12,
  },
  scopeCopy: { flex: 1, paddingRight: 12 },
  scopeHint: { fontSize: 12, lineHeight: 17, fontFamily: 'PlusJakartaSans_400Regular' },
  addItemBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  addItemText: { fontSize: 12, fontFamily: 'PlusJakartaSans_500Medium' },
  itemCard: { borderWidth: 1, borderRadius: 10, padding: 12, marginBottom: 10 },
  itemHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  itemLabel: { fontSize: 12, fontFamily: 'PlusJakartaSans_500Medium' },
  itemRow: { flexDirection: 'row', gap: 8, marginTop: 8 },
  inputGroup: { flex: 1 },
  inputLabel: { fontSize: 11, fontFamily: 'PlusJakartaSans_400Regular', marginBottom: 4 },
  input: {
    height: 44,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_400Regular',
  },
  textarea: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_400Regular',
    minHeight: 80,
    textAlignVertical: 'top',
  },
  totalCell: {
    height: 44,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  totalCellText: { fontSize: 12, fontFamily: 'PlusJakartaSans_600SemiBold' },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderRadius: 10,
    borderWidth: 1,
    padding: 14,
    marginBottom: 20,
  },
  totalLabel: { fontSize: 14, fontFamily: 'PlusJakartaSans_500Medium' },
  totalValue: { fontSize: 20, fontFamily: 'PlusJakartaSans_700Bold' },
  submitBtn: {
    height: 52,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitBtnText: { fontSize: 16, fontFamily: 'PlusJakartaSans_600SemiBold', color: '#ffffff' },
});
