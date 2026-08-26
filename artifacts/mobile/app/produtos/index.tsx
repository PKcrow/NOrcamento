import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  RefreshControl,
  Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  useListProducts,
  useCreateProduct,
  useUpdateProduct,
  useDeleteProduct,
} from '@workspace/api-client-react';
import Colors from '@/constants/colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useQueryClient } from '@tanstack/react-query';

type Product = { id: number; name: string; description: string | null; price: number };

const fmt = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

function ProductForm({
  visible,
  initial,
  onClose,
  onSubmit,
  loading,
}: {
  visible: boolean;
  initial?: Partial<Product>;
  onClose: () => void;
  onSubmit: (data: { name: string; description: string; price: string }) => void;
  loading: boolean;
}) {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme];
  const [name, setName] = useState(initial?.name ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [price, setPrice] = useState(initial?.price != null ? String(initial.price) : '');

  React.useEffect(() => {
    if (visible) {
      setName(initial?.name ?? '');
      setDescription(initial?.description ?? '');
      setPrice(initial?.price != null ? String(initial.price) : '');
    }
  }, [visible, initial]);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={[styles.modalSheet, { backgroundColor: theme.card }]}>
          <View style={styles.modalHeader}>
            <Text style={[styles.modalTitle, { color: theme.foreground }]}>
              {initial?.id ? 'Editar produto' : 'Novo produto'}
            </Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color={theme.mutedForeground} />
            </TouchableOpacity>
          </View>

          <View style={styles.formField}>
            <Text style={[styles.formLabel, { color: theme.mutedForeground }]}>Nome *</Text>
            <TextInput
              style={[styles.input, { borderColor: theme.border, color: theme.foreground, backgroundColor: theme.background }]}
              value={name}
              onChangeText={setName}
              placeholder="Ex: Instalação elétrica"
              placeholderTextColor={theme.mutedForeground}
            />
          </View>
          <View style={styles.formField}>
            <Text style={[styles.formLabel, { color: theme.mutedForeground }]}>Descrição</Text>
            <TextInput
              style={[styles.textarea, { borderColor: theme.border, color: theme.foreground, backgroundColor: theme.background }]}
              value={description}
              onChangeText={setDescription}
              placeholder="Descrição do produto ou serviço"
              placeholderTextColor={theme.mutedForeground}
              multiline
              numberOfLines={2}
            />
          </View>
          <View style={styles.formField}>
            <Text style={[styles.formLabel, { color: theme.mutedForeground }]}>Preço padrão</Text>
            <TextInput
              style={[styles.input, { borderColor: theme.border, color: theme.foreground, backgroundColor: theme.background }]}
              value={price}
              onChangeText={setPrice}
              placeholder="0,00"
              placeholderTextColor={theme.mutedForeground}
              keyboardType="decimal-pad"
            />
          </View>

          <TouchableOpacity
            style={[styles.submitBtn, { backgroundColor: theme.primary }, loading && { opacity: 0.6 }]}
            onPress={() => onSubmit({ name, description, price })}
            disabled={loading}
          >
            {loading ? <ActivityIndicator color="#fff" size="small" /> : (
              <Text style={styles.submitBtnText}>Salvar</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

export default function ProdutosScreen() {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme];
  const queryClient = useQueryClient();

  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | undefined>();

  const { data: products, isRefetching, refetch } = useListProducts({ search: search || undefined });
  const { mutate: createProduct, isPending: creating } = useCreateProduct();
  const { mutate: updateProduct, isPending: updating } = useUpdateProduct();
  const { mutate: deleteProduct } = useDeleteProduct();

  const openCreate = () => { setEditingProduct(undefined); setShowForm(true); };
  const openEdit = (p: Product) => { setEditingProduct(p); setShowForm(true); };

  const handleSubmit = ({ name, description, price }: { name: string; description: string; price: string }) => {
    if (!name.trim()) { Alert.alert('Campo obrigatório', 'Informe o nome.'); return; }
    const parsedPrice = parseFloat(price.replace(',', '.')) || 0;
    const data = { name: name.trim(), description: description.trim() || null, price: parsedPrice } as any;

    if (editingProduct) {
      updateProduct(
        { id: editingProduct.id, data },
        {
          onSuccess: () => { setShowForm(false); queryClient.invalidateQueries(); },
          onError: () => Alert.alert('Erro', 'Não foi possível atualizar.'),
        }
      );
    } else {
      createProduct(
        { data },
        {
          onSuccess: () => { setShowForm(false); queryClient.invalidateQueries(); },
          onError: () => Alert.alert('Erro', 'Não foi possível criar.'),
        }
      );
    }
  };

  const handleDelete = (p: Product) => {
    Alert.alert('Excluir', `Excluir "${p.name}"?`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Excluir',
        style: 'destructive',
        onPress: () =>
          deleteProduct(
            { id: p.id },
            { onSuccess: () => queryClient.invalidateQueries() }
          ),
      },
    ]);
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={[styles.searchRow, { backgroundColor: theme.card, borderBottomColor: theme.border }]}>
        <Ionicons name="search-outline" size={18} color={theme.mutedForeground} />
        <TextInput
          style={[styles.searchInput, { color: theme.foreground }]}
          placeholder="Buscar produto ou serviço..."
          placeholderTextColor={theme.mutedForeground}
          value={search}
          onChangeText={setSearch}
        />
        {search ? (
          <TouchableOpacity onPress={() => setSearch('')}>
            <Ionicons name="close-circle" size={18} color={theme.mutedForeground} />
          </TouchableOpacity>
        ) : null}
      </View>

      <FlatList
        data={products ?? []}
        keyExtractor={item => String(item.id)}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={theme.primary} />}
        contentContainerStyle={styles.listContent}
        renderItem={({ item }) => (
          <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <View style={styles.cardRow}>
              <View style={[styles.productIcon, { backgroundColor: theme.primary + '18' }]}>
                <Ionicons name="pricetag-outline" size={20} color={theme.primary} />
              </View>
              <View style={styles.cardMain}>
                <Text style={[styles.cardName, { color: theme.foreground }]}>{item.name}</Text>
                {item.description && (
                  <Text style={[styles.cardDesc, { color: theme.mutedForeground }]} numberOfLines={1}>
                    {item.description}
                  </Text>
                )}
                <Text style={[styles.cardPrice, { color: theme.primary }]}>{fmt(item.price)}</Text>
              </View>
              <View style={styles.cardActions}>
                <TouchableOpacity onPress={() => openEdit(item)} style={styles.iconBtn}>
                  <Ionicons name="pencil-outline" size={18} color={theme.mutedForeground} />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => handleDelete(item)} style={styles.iconBtn}>
                  <Ionicons name="trash-outline" size={18} color={theme.destructive} />
                </TouchableOpacity>
              </View>
            </View>
          </View>
        )}
        ListEmptyComponent={() => (
          <View style={styles.empty}>
            <Ionicons name="pricetags-outline" size={48} color={theme.mutedForeground} />
            <Text style={[styles.emptyText, { color: theme.mutedForeground }]}>
              {search ? 'Nenhum produto encontrado.' : 'Nenhum produto cadastrado.'}
            </Text>
            <Text style={[styles.emptyHint, { color: theme.mutedForeground }]}>
              Cadastre produtos e serviços para adicioná-los rapidamente aos orçamentos.
            </Text>
          </View>
        )}
      />

      <TouchableOpacity
        style={[styles.fab, { backgroundColor: theme.primary }]}
        onPress={openCreate}
      >
        <Ionicons name="add" size={28} color="#fff" />
      </TouchableOpacity>

      <ProductForm
        visible={showForm}
        initial={editingProduct}
        onClose={() => setShowForm(false)}
        onSubmit={handleSubmit}
        loading={creating || updating}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: 1,
    gap: 8,
  },
  searchInput: { flex: 1, fontSize: 15, fontFamily: 'PlusJakartaSans_400Regular', paddingVertical: 0 },
  listContent: { padding: 12, paddingBottom: 80 },
  card: { borderRadius: 10, borderWidth: 1, padding: 12, marginBottom: 8 },
  cardRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  productIcon: { width: 44, height: 44, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  cardMain: { flex: 1 },
  cardName: { fontSize: 15, fontFamily: 'PlusJakartaSans_600SemiBold', marginBottom: 2 },
  cardDesc: { fontSize: 12, fontFamily: 'PlusJakartaSans_400Regular', marginBottom: 4 },
  cardPrice: { fontSize: 14, fontFamily: 'PlusJakartaSans_700Bold' },
  cardActions: { flexDirection: 'row', gap: 4 },
  iconBtn: { padding: 6 },
  empty: { alignItems: 'center', paddingVertical: 60, gap: 10, paddingHorizontal: 32 },
  emptyText: { fontSize: 15, fontFamily: 'PlusJakartaSans_600SemiBold' },
  emptyHint: { fontSize: 13, fontFamily: 'PlusJakartaSans_400Regular', textAlign: 'center' },
  fab: {
    position: 'absolute', right: 20, bottom: 24,
    width: 56, height: 56, borderRadius: 28,
    alignItems: 'center', justifyContent: 'center',
    elevation: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 4,
  },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  modalSheet: { borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24, paddingBottom: 40 },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 },
  modalTitle: { fontSize: 18, fontFamily: 'PlusJakartaSans_700Bold' },
  formField: { marginBottom: 14 },
  formLabel: { fontSize: 13, fontFamily: 'PlusJakartaSans_500Medium', marginBottom: 6 },
  input: {
    height: 46, borderWidth: 1, borderRadius: 8,
    paddingHorizontal: 12, fontSize: 15, fontFamily: 'PlusJakartaSans_400Regular',
  },
  textarea: {
    borderWidth: 1, borderRadius: 8,
    paddingHorizontal: 12, paddingVertical: 10,
    fontSize: 14, fontFamily: 'PlusJakartaSans_400Regular',
    minHeight: 70, textAlignVertical: 'top',
  },
  submitBtn: { height: 50, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginTop: 6 },
  submitBtnText: { fontSize: 16, fontFamily: 'PlusJakartaSans_600SemiBold', color: '#fff' },
});
