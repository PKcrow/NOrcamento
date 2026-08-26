import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  FlatList,
  Switch,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  useCreateServiceTemplate,
  useDeleteServiceTemplate,
  useListServiceTemplates,
  useUpdateServiceTemplate,
  type ServiceTemplate,
} from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import Colors from '@/constants/colors';
import { useColorScheme } from '@/hooks/useColorScheme';

type DraftItem = {
  description: string;
  quantity: string;
  unitPrice: string;
};

type Draft = {
  name: string;
  serviceScopeEnabled: boolean;
  serviceDescription: string;
  laborCost: string;
  notes: string;
  items: DraftItem[];
};

const parseNumber = (value: string) => parseFloat(value.replace(',', '.')) || 0;
const formatMoney = (value: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

function emptyDraft(): Draft {
  return {
    name: '',
    serviceScopeEnabled: false,
    serviceDescription: '',
    laborCost: '',
    notes: '',
    items: [{ description: '', quantity: '1', unitPrice: '' }],
  };
}

function draftFromTemplate(template?: ServiceTemplate): Draft {
  if (!template) return emptyDraft();
  return {
    name: template.name,
    serviceScopeEnabled: template.serviceScopeEnabled,
    serviceDescription: template.serviceDescription ?? '',
    laborCost: String(template.laborCost || ''),
    notes: template.notes ?? '',
    items: template.items.map((item) => ({
      description: item.description,
      quantity: String(item.quantity),
      unitPrice: String(item.unitPrice),
    })),
  };
}

function TemplateEditor({
  visible,
  template,
  onClose,
  onSave,
  saving,
}: {
  visible: boolean;
  template?: ServiceTemplate;
  onClose: () => void;
  onSave: (draft: Draft) => void;
  saving: boolean;
}) {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme ?? 'light'];
  const [draft, setDraft] = useState<Draft>(emptyDraft);

  useEffect(() => {
    if (visible) setDraft(draftFromTemplate(template));
  }, [visible, template]);

  const itemTotal = useMemo(
    () => draft.items.reduce((sum, item) => sum + parseNumber(item.quantity) * parseNumber(item.unitPrice), 0),
    [draft.items],
  );

  const updateItem = (index: number, field: keyof DraftItem, value: string) => {
    setDraft((current) => ({
      ...current,
      items: current.items.map((item, itemIndex) =>
        itemIndex === index ? { ...item, [field]: value } : item,
      ),
    }));
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={[styles.editorContainer, { backgroundColor: theme.background }]}>
        <View style={[styles.editorHeader, { borderBottomColor: theme.border, backgroundColor: theme.card }]}>
          <View>
            <Text style={[styles.editorTitle, { color: theme.foreground }]}>
              {template ? 'Editar modelo' : 'Novo modelo'}
            </Text>
            <Text style={[styles.editorSubtitle, { color: theme.mutedForeground }]}>
              Use valores que você costuma repetir.
            </Text>
          </View>
          <TouchableOpacity onPress={onClose} style={styles.iconButton}>
            <Ionicons name="close" size={25} color={theme.mutedForeground} />
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.editorContent} keyboardShouldPersistTaps="handled">
          <Text style={[styles.label, { color: theme.foreground }]}>Nome do modelo *</Text>
          <TextInput
            style={[styles.input, { color: theme.foreground, borderColor: theme.border, backgroundColor: theme.card }]}
            value={draft.name}
            onChangeText={(name) => setDraft((current) => ({ ...current, name }))}
            placeholder="Ex.: Limpeza completa"
            placeholderTextColor={theme.mutedForeground}
          />

          <View style={[styles.scopeBox, { borderColor: theme.border, backgroundColor: theme.card }]}>
            <View style={styles.scopeCopy}>
              <Text style={[styles.label, { color: theme.foreground, marginBottom: 2 }]}>Incluir escopo do serviço</Text>
              <Text style={[styles.hint, { color: theme.mutedForeground }]}>A descrição será copiada para o orçamento.</Text>
            </View>
            <Switch
              value={draft.serviceScopeEnabled}
              onValueChange={(serviceScopeEnabled) =>
                setDraft((current) => ({
                  ...current,
                  serviceScopeEnabled,
                  serviceDescription: serviceScopeEnabled ? current.serviceDescription : '',
                }))
              }
              trackColor={{ false: theme.border, true: theme.primary + '88' }}
              thumbColor={draft.serviceScopeEnabled ? theme.primary : '#f4f4f5'}
            />
          </View>
          {draft.serviceScopeEnabled && (
            <TextInput
              style={[styles.textarea, { color: theme.foreground, borderColor: theme.border, backgroundColor: theme.card }]}
              value={draft.serviceDescription}
              onChangeText={(serviceDescription) => setDraft((current) => ({ ...current, serviceDescription }))}
              placeholder="Descreva o que está incluído no serviço"
              placeholderTextColor={theme.mutedForeground}
              multiline
            />
          )}

          <View style={styles.itemsHeader}>
            <Text style={[styles.label, { color: theme.foreground, marginBottom: 0 }]}>Itens *</Text>
            <TouchableOpacity
              style={[styles.addButton, { borderColor: theme.primary }]}
              onPress={() =>
                setDraft((current) => ({
                  ...current,
                  items: [...current.items, { description: '', quantity: '1', unitPrice: '' }],
                }))
              }
            >
              <Ionicons name="add" size={16} color={theme.primary} />
              <Text style={[styles.addButtonText, { color: theme.primary }]}>Adicionar</Text>
            </TouchableOpacity>
          </View>

          {draft.items.map((item, index) => (
            <View key={index} style={[styles.itemCard, { borderColor: theme.border, backgroundColor: theme.card }]}>
              <View style={styles.itemCardHeader}>
                <Text style={[styles.itemTitle, { color: theme.mutedForeground }]}>Item {index + 1}</Text>
                {draft.items.length > 1 && (
                  <TouchableOpacity
                    onPress={() =>
                      setDraft((current) => ({
                        ...current,
                        items: current.items.filter((_, itemIndex) => itemIndex !== index),
                      }))
                    }
                  >
                    <Ionicons name="trash-outline" size={18} color={theme.destructive} />
                  </TouchableOpacity>
                )}
              </View>
              <TextInput
                style={[styles.input, { color: theme.foreground, borderColor: theme.border, backgroundColor: theme.background }]}
                value={item.description}
                onChangeText={(value) => updateItem(index, 'description', value)}
                placeholder="Descrição do item *"
                placeholderTextColor={theme.mutedForeground}
              />
              <View style={styles.itemInputs}>
                <View style={styles.flexOne}>
                  <Text style={[styles.inputLabel, { color: theme.mutedForeground }]}>Qtd</Text>
                  <TextInput
                    style={[styles.input, { color: theme.foreground, borderColor: theme.border, backgroundColor: theme.background }]}
                    value={item.quantity}
                    onChangeText={(value) => updateItem(index, 'quantity', value)}
                    keyboardType="decimal-pad"
                  />
                </View>
                <View style={[styles.flexOne, { flex: 1.4 }]}>
                  <Text style={[styles.inputLabel, { color: theme.mutedForeground }]}>Valor unit.</Text>
                  <TextInput
                    style={[styles.input, { color: theme.foreground, borderColor: theme.border, backgroundColor: theme.background }]}
                    value={item.unitPrice}
                    onChangeText={(value) => updateItem(index, 'unitPrice', value)}
                    placeholder="0,00"
                    placeholderTextColor={theme.mutedForeground}
                    keyboardType="decimal-pad"
                  />
                </View>
              </View>
            </View>
          ))}

          <Text style={[styles.label, { color: theme.foreground }]}>Mão de obra (R$)</Text>
          <TextInput
            style={[styles.input, { color: theme.foreground, borderColor: theme.border, backgroundColor: theme.card }]}
            value={draft.laborCost}
            onChangeText={(laborCost) => setDraft((current) => ({ ...current, laborCost }))}
            placeholder="0,00"
            placeholderTextColor={theme.mutedForeground}
            keyboardType="decimal-pad"
          />

          <View style={[styles.totalBox, { backgroundColor: theme.primary + '12', borderColor: theme.primary + '33' }]}>
            <Text style={[styles.hint, { color: theme.mutedForeground }]}>Total sugerido</Text>
            <Text style={[styles.totalValue, { color: theme.primary }]}>{formatMoney(itemTotal + parseNumber(draft.laborCost))}</Text>
          </View>

          <Text style={[styles.label, { color: theme.foreground }]}>Observações e condições</Text>
          <TextInput
            style={[styles.textarea, { color: theme.foreground, borderColor: theme.border, backgroundColor: theme.card }]}
            value={draft.notes}
            onChangeText={(notes) => setDraft((current) => ({ ...current, notes }))}
            placeholder="Prazo, garantia ou condições de pagamento"
            placeholderTextColor={theme.mutedForeground}
            multiline
          />
        </ScrollView>

        <View style={[styles.editorFooter, { borderTopColor: theme.border, backgroundColor: theme.card }]}>
          <TouchableOpacity style={[styles.cancelButton, { borderColor: theme.border }]} onPress={onClose}>
            <Text style={[styles.cancelText, { color: theme.foreground }]}>Cancelar</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.saveButton, { backgroundColor: theme.primary }, saving && { opacity: 0.6 }]}
            onPress={() => onSave(draft)}
            disabled={saving}
          >
            {saving ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.saveText}>Salvar modelo</Text>}
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

export default function ModelosScreen() {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme ?? 'light'];
  const queryClient = useQueryClient();
  const { data: templates, isLoading, refetch, isRefetching } = useListServiceTemplates();
  const { mutate: createTemplate, isPending: creating } = useCreateServiceTemplate();
  const { mutate: updateTemplate, isPending: updating } = useUpdateServiceTemplate();
  const { mutate: deleteTemplate } = useDeleteServiceTemplate();
  const [showEditor, setShowEditor] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<ServiceTemplate | undefined>();

  const openCreate = () => {
    setEditingTemplate(undefined);
    setShowEditor(true);
  };

  const saveTemplate = (draft: Draft) => {
    const validItems = draft.items.filter((item) => item.description.trim());
    if (!draft.name.trim()) {
      Alert.alert('Campo obrigatório', 'Informe o nome do modelo.');
      return;
    }
    if (!validItems.length) {
      Alert.alert('Campo obrigatório', 'Adicione pelo menos um item ao modelo.');
      return;
    }
    const data = {
      name: draft.name.trim(),
      serviceScopeEnabled: draft.serviceScopeEnabled,
      serviceDescription: draft.serviceScopeEnabled ? draft.serviceDescription.trim() || null : null,
      notes: draft.notes.trim() || null,
      laborCost: parseNumber(draft.laborCost),
      items: validItems.map((item) => ({
        description: item.description.trim(),
        quantity: parseNumber(item.quantity) || 1,
        unitPrice: parseNumber(item.unitPrice),
      })),
    } as any;
    const onSuccess = () => {
      queryClient.invalidateQueries();
      setShowEditor(false);
      setEditingTemplate(undefined);
    };
    const onError = () => Alert.alert('Erro', 'Não foi possível salvar o modelo.');
    if (editingTemplate) {
      updateTemplate({ id: editingTemplate.id, data }, { onSuccess, onError });
    } else {
      createTemplate({ data }, { onSuccess, onError });
    }
  };

  const confirmDelete = (template: ServiceTemplate) => {
    Alert.alert('Excluir modelo', `Excluir "${template.name}"? Os orçamentos existentes não serão alterados.`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Excluir',
        style: 'destructive',
        onPress: () => deleteTemplate({ id: template.id }, { onSuccess: () => queryClient.invalidateQueries() }),
      },
    ]);
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <FlatList
        data={templates ?? []}
        keyExtractor={(item) => String(item.id)}
        refreshing={isRefetching}
        onRefresh={refetch}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={
          <View style={styles.screenIntro}>
            <Text style={[styles.screenTitle, { color: theme.foreground }]}>Modelos de serviço</Text>
            <Text style={[styles.screenSubtitle, { color: theme.mutedForeground }]}>
              Reutilize preços, itens e condições para criar orçamentos em minutos.
            </Text>
          </View>
        }
        ListEmptyComponent={
          isLoading ? (
            <ActivityIndicator color={theme.primary} style={{ marginTop: 52 }} />
          ) : (
            <View style={[styles.empty, { borderColor: theme.border, backgroundColor: theme.card }]}>
              <Ionicons name="clipboard-outline" size={42} color={theme.primary} />
              <Text style={[styles.emptyTitle, { color: theme.foreground }]}>Nenhum modelo salvo</Text>
              <Text style={[styles.emptyCopy, { color: theme.mutedForeground }]}>
                Crie um modelo com os serviços que você faz com frequência.
              </Text>
              <TouchableOpacity style={[styles.emptyButton, { backgroundColor: theme.primary }]} onPress={openCreate}>
                <Text style={styles.saveText}>Criar modelo</Text>
              </TouchableOpacity>
            </View>
          )
        }
        renderItem={({ item }) => {
          const total = item.items.reduce((sum, entry) => sum + entry.quantity * entry.unitPrice, 0) + item.laborCost;
          return (
            <View style={[styles.templateCard, { borderColor: theme.border, backgroundColor: theme.card }]}>
              <View style={styles.templateHeader}>
                <View style={[styles.templateIcon, { backgroundColor: theme.primary + '18' }]}>
                  <Ionicons name="clipboard-outline" size={20} color={theme.primary} />
                </View>
                <View style={styles.templateMain}>
                  <Text style={[styles.templateName, { color: theme.foreground }]}>{item.name}</Text>
                  <Text style={[styles.templateMeta, { color: theme.mutedForeground }]}>
                    {item.items.length} {item.items.length === 1 ? 'item' : 'itens'} · {formatMoney(total)}
                  </Text>
                </View>
                <TouchableOpacity onPress={() => { setEditingTemplate(item); setShowEditor(true); }} style={styles.iconButton}>
                  <Ionicons name="pencil-outline" size={19} color={theme.mutedForeground} />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => confirmDelete(item)} style={styles.iconButton}>
                  <Ionicons name="trash-outline" size={19} color={theme.destructive} />
                </TouchableOpacity>
              </View>
              {item.serviceScopeEnabled && item.serviceDescription ? (
                <Text numberOfLines={2} style={[styles.templateDescription, { color: theme.mutedForeground }]}>
                  {item.serviceDescription}
                </Text>
              ) : null}
            </View>
          );
        }}
      />

      <TouchableOpacity style={[styles.fab, { backgroundColor: theme.primary }]} onPress={openCreate}>
        <Ionicons name="add" size={28} color="#fff" />
      </TouchableOpacity>

      <TemplateEditor
        visible={showEditor}
        template={editingTemplate}
        onClose={() => setShowEditor(false)}
        onSave={saveTemplate}
        saving={creating || updating}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  listContent: { padding: 16, paddingBottom: 94, flexGrow: 1 },
  screenIntro: { marginBottom: 16 },
  screenTitle: { fontSize: 24, fontFamily: 'PlusJakartaSans_700Bold' },
  screenSubtitle: { fontSize: 13, fontFamily: 'PlusJakartaSans_400Regular', marginTop: 5, lineHeight: 19 },
  templateCard: { borderWidth: 1, borderRadius: 12, padding: 14, marginBottom: 10 },
  templateHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  templateIcon: { height: 42, width: 42, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  templateMain: { flex: 1 },
  templateName: { fontSize: 15, fontFamily: 'PlusJakartaSans_600SemiBold' },
  templateMeta: { fontSize: 12, fontFamily: 'PlusJakartaSans_400Regular', marginTop: 3 },
  templateDescription: { fontSize: 13, fontFamily: 'PlusJakartaSans_400Regular', marginTop: 12, lineHeight: 19 },
  iconButton: { padding: 7 },
  empty: { alignItems: 'center', borderWidth: 1, borderStyle: 'dashed', borderRadius: 12, padding: 30, marginTop: 20 },
  emptyTitle: { fontSize: 16, fontFamily: 'PlusJakartaSans_600SemiBold', marginTop: 12 },
  emptyCopy: { fontSize: 13, fontFamily: 'PlusJakartaSans_400Regular', textAlign: 'center', marginTop: 5, lineHeight: 19 },
  emptyButton: { marginTop: 17, paddingHorizontal: 18, height: 42, borderRadius: 9, justifyContent: 'center' },
  fab: { position: 'absolute', right: 20, bottom: 24, height: 56, width: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center', elevation: 4 },
  editorContainer: { flex: 1 },
  editorHeader: { padding: 18, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderBottomWidth: 1 },
  editorTitle: { fontSize: 19, fontFamily: 'PlusJakartaSans_700Bold' },
  editorSubtitle: { fontSize: 12, fontFamily: 'PlusJakartaSans_400Regular', marginTop: 3 },
  editorContent: { padding: 16, paddingBottom: 30 },
  editorFooter: { flexDirection: 'row', gap: 10, padding: 14, borderTopWidth: 1 },
  label: { fontSize: 14, fontFamily: 'PlusJakartaSans_600SemiBold', marginBottom: 7 },
  input: { height: 46, borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, fontSize: 14, fontFamily: 'PlusJakartaSans_400Regular' },
  textarea: { minHeight: 85, borderWidth: 1, borderRadius: 8, padding: 12, fontSize: 14, fontFamily: 'PlusJakartaSans_400Regular', textAlignVertical: 'top', marginTop: 10 },
  scopeBox: { borderWidth: 1, borderRadius: 9, padding: 13, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 18 },
  scopeCopy: { flex: 1, paddingRight: 12 },
  hint: { fontSize: 12, fontFamily: 'PlusJakartaSans_400Regular', lineHeight: 17 },
  itemsHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 22, marginBottom: 9 },
  addButton: { flexDirection: 'row', alignItems: 'center', gap: 4, borderWidth: 1, borderRadius: 7, paddingHorizontal: 9, paddingVertical: 5 },
  addButtonText: { fontSize: 12, fontFamily: 'PlusJakartaSans_600SemiBold' },
  itemCard: { borderWidth: 1, borderRadius: 9, padding: 11, marginBottom: 9 },
  itemCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  itemTitle: { fontSize: 12, fontFamily: 'PlusJakartaSans_500Medium' },
  itemInputs: { flexDirection: 'row', gap: 8, marginTop: 8 },
  flexOne: { flex: 1 },
  inputLabel: { fontSize: 11, fontFamily: 'PlusJakartaSans_500Medium', marginBottom: 4 },
  totalBox: { borderWidth: 1, borderRadius: 9, padding: 12, marginTop: 14, marginBottom: 20 },
  totalValue: { fontSize: 21, fontFamily: 'PlusJakartaSans_700Bold', marginTop: 2 },
  cancelButton: { flex: 1, height: 48, borderWidth: 1, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  cancelText: { fontSize: 14, fontFamily: 'PlusJakartaSans_600SemiBold' },
  saveButton: { flex: 1.4, height: 48, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  saveText: { color: '#fff', fontSize: 14, fontFamily: 'PlusJakartaSans_600SemiBold' },
});