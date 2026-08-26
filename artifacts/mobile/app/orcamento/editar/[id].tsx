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
import {
  useGetQuote,
  useUpdateQuote,
  useListClients,
} from '@workspace/api-client-react';
import Colors from '@/constants/colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useQueryClient } from '@tanstack/react-query';

type Item = { id?: number; description: string; quantity: string; unitPrice: string };

export default function EditarOrcamentoScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const quoteId = Number(id);
  const router = useRouter();
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme];
  const queryClient = useQueryClient();

  const { data: quote, isLoading } = useGetQuote(quoteId);
  const { data: clients } = useListClients({});
  const { mutate: updateQuote, isPending } = useUpdateQuote();

  const [clientSearch, setClientSearch] = useState('');
  const [selectedClientId, setSelectedClientId] = useState<number | undefined>();
  const [showClientPicker, setShowClientPicker] = useState(false);
  const [items, setItems] = useState<Item[]>([{ description: '', quantity: '1', unitPrice: '' }]);
  const [laborCost, setLaborCost] = useState('');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (quote) {
      setSelectedClientId(quote.clientId ?? undefined);
      setItems(
        quote.items.length > 0
          ? quote.items.map(i => ({
              id: i.id,
              description: i.description,
              quantity: String(i.quantity),
              unitPrice: String(i.unitPrice),
            }))
          : [{ description: '', quantity: '1', unitPrice: '' }]
      );
      setLaborCost(quote.laborCost > 0 ? String(quote.laborCost) : '');
      setNotes(quote.notes ?? '');
    }
  }, [quote]);

  const selectedClient = clients?.find(c => c.id === selectedClientId);
  const filteredClients = clients?.filter(c =>
    c.name.toLowerCase().includes(clientSearch.toLowerCase())
  ) ?? [];

  const itemTotal = items.reduce((acc, item) => {
    const q = parseFloat(item.quantity) || 0;
    const p = parseFloat(item.unitPrice.replace(',', '.')) || 0;
    return acc + q * p;
  }, 0);
  const labor = parseFloat(laborCost.replace(',', '.')) || 0;
  const total = itemTotal + labor;

  const fmt = (v: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

  const addItem = () => setItems(prev => [{ description: '', quantity: '1', unitPrice: '' }, ...prev]);
  const removeItem = (i: number) => setItems(prev => prev.filter((_, idx) => idx !== i));
  const updateItem = (i: number, field: keyof Item, value: string) =>
    setItems(prev => prev.map((item, idx) => idx === i ? { ...item, [field]: value } : item));

  const handleSave = () => {
    const validItems = items.filter(i => i.description.trim());
    if (validItems.length === 0) {
      Alert.alert('Itens obrigatórios', 'Adicione pelo menos um item ao orçamento.');
      return;
    }
    updateQuote(
      {
        id: quoteId,
        data: {
          clientId: selectedClientId ?? null,
          notes: notes.trim() || null,
          laborCost: labor,
          items: validItems.map(i => ({
            description: i.description.trim(),
            quantity: parseFloat(i.quantity) || 1,
            unitPrice: parseFloat(i.unitPrice.replace(',', '.')) || 0,
          })),
        } as any,
      },
      {
        onSuccess: () => {
          queryClient.invalidateQueries();
          router.back();
        },
        onError: () => Alert.alert('Erro', 'Não foi possível atualizar o orçamento.'),
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
      {/* Client */}
      <View style={styles.section}>
        <Text style={[styles.label, { color: theme.mutedForeground }]}>Cliente</Text>
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
            <TouchableOpacity
              style={styles.dropdownItem}
              onPress={() => { setSelectedClientId(undefined); setShowClientPicker(false); }}
            >
              <Text style={[styles.dropdownItemText, { color: theme.mutedForeground }]}>— Sem cliente —</Text>
            </TouchableOpacity>
            {filteredClients.slice(0, 10).map(c => (
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
      </View>

      {/* Items */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={[styles.label, { color: theme.mutedForeground }]}>ITENS</Text>
          <TouchableOpacity onPress={addItem} style={[styles.addBtn, { backgroundColor: theme.primary + '18' }]}>
            <Ionicons name="add" size={16} color={theme.primary} />
            <Text style={[styles.addBtnText, { color: theme.primary }]}>Adicionar</Text>
          </TouchableOpacity>
        </View>
        {items.map((item, i) => (
          <View key={i} style={[styles.itemCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <View style={styles.itemRow}>
              <TextInput
                style={[styles.itemDesc, { borderColor: theme.border, color: theme.foreground }]}
                placeholder="Descrição do item"
                placeholderTextColor={theme.mutedForeground}
                value={item.description}
                onChangeText={v => updateItem(i, 'description', v)}
              />
              {items.length > 1 && (
                <TouchableOpacity onPress={() => removeItem(i)} style={styles.removeBtn}>
                  <Ionicons name="trash-outline" size={16} color={theme.destructive} />
                </TouchableOpacity>
              )}
            </View>
            <View style={styles.itemPriceRow}>
              <TextInput
                style={[styles.itemSmall, { borderColor: theme.border, color: theme.foreground }]}
                placeholder="Qtd."
                placeholderTextColor={theme.mutedForeground}
                value={item.quantity}
                onChangeText={v => updateItem(i, 'quantity', v)}
                keyboardType="decimal-pad"
              />
              <Text style={[styles.timesText, { color: theme.mutedForeground }]}>×</Text>
              <TextInput
                style={[styles.itemPrice, { borderColor: theme.border, color: theme.foreground }]}
                placeholder="Preço unit."
                placeholderTextColor={theme.mutedForeground}
                value={item.unitPrice}
                onChangeText={v => updateItem(i, 'unitPrice', v)}
                keyboardType="decimal-pad"
              />
              <Text style={[styles.itemSubtotal, { color: theme.foreground }]}>
                {fmt((parseFloat(item.quantity) || 0) * (parseFloat(item.unitPrice.replace(',', '.')) || 0))}
              </Text>
            </View>
          </View>
        ))}
      </View>

      {/* Labor */}
      <View style={styles.section}>
        <Text style={[styles.label, { color: theme.mutedForeground }]}>Mão de obra</Text>
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
        <Text style={[styles.label, { color: theme.mutedForeground }]}>Observações</Text>
        <TextInput
          style={[styles.textarea, { borderColor: theme.border, color: theme.foreground, backgroundColor: theme.card }]}
          placeholder="Condições, prazo, garantia..."
          placeholderTextColor={theme.mutedForeground}
          value={notes}
          onChangeText={setNotes}
          multiline
          numberOfLines={3}
        />
      </View>

      {/* Total */}
      <View style={[styles.totalBox, { backgroundColor: theme.card, borderColor: theme.border }]}>
        <Text style={[styles.totalLabel, { color: theme.mutedForeground }]}>Total do orçamento</Text>
        <Text style={[styles.totalValue, { color: theme.foreground }]}>{fmt(total)}</Text>
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
  section: { marginBottom: 20 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  label: { fontSize: 11, fontFamily: 'PlusJakartaSans_600SemiBold', letterSpacing: 0.8, marginBottom: 8 },
  pickerBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    height: 48, borderWidth: 1, borderRadius: 8, paddingHorizontal: 12,
  },
  pickerText: { flex: 1, fontSize: 15, fontFamily: 'PlusJakartaSans_400Regular' },
  dropdown: { borderWidth: 1, borderRadius: 8, marginTop: 4, overflow: 'hidden', maxHeight: 200 },
  searchInput: {
    height: 40, borderBottomWidth: 1, paddingHorizontal: 12,
    fontSize: 14, fontFamily: 'PlusJakartaSans_400Regular',
  },
  dropdownItem: { padding: 12 },
  dropdownItemText: { fontSize: 14, fontFamily: 'PlusJakartaSans_400Regular' },
  addBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 },
  addBtnText: { fontSize: 13, fontFamily: 'PlusJakartaSans_600SemiBold' },
  itemCard: { borderRadius: 8, borderWidth: 1, padding: 10, marginBottom: 8, gap: 8 },
  itemRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  itemDesc: {
    flex: 1, height: 40, borderWidth: 1, borderRadius: 6,
    paddingHorizontal: 10, fontSize: 14, fontFamily: 'PlusJakartaSans_400Regular',
  },
  removeBtn: { padding: 4 },
  itemPriceRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  itemSmall: {
    width: 60, height: 36, borderWidth: 1, borderRadius: 6,
    paddingHorizontal: 8, fontSize: 13, fontFamily: 'PlusJakartaSans_400Regular', textAlign: 'center',
  },
  timesText: { fontSize: 14, fontFamily: 'PlusJakartaSans_400Regular' },
  itemPrice: {
    flex: 1, height: 36, borderWidth: 1, borderRadius: 6,
    paddingHorizontal: 8, fontSize: 13, fontFamily: 'PlusJakartaSans_400Regular',
  },
  itemSubtotal: { fontSize: 13, fontFamily: 'PlusJakartaSans_700Bold', minWidth: 70, textAlign: 'right' },
  input: {
    height: 48, borderWidth: 1, borderRadius: 8,
    paddingHorizontal: 12, fontSize: 15, fontFamily: 'PlusJakartaSans_400Regular',
  },
  textarea: {
    borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10,
    fontSize: 14, fontFamily: 'PlusJakartaSans_400Regular', minHeight: 80, textAlignVertical: 'top',
  },
  totalBox: {
    borderRadius: 10, borderWidth: 1, padding: 16,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16,
  },
  totalLabel: { fontSize: 14, fontFamily: 'PlusJakartaSans_500Medium' },
  totalValue: { fontSize: 22, fontFamily: 'PlusJakartaSans_700Bold' },
  saveBtn: { height: 52, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  saveBtnText: { fontSize: 16, fontFamily: 'PlusJakartaSans_600SemiBold', color: '#fff' },
});
