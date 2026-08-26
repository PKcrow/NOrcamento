import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  TextInput,
  Modal,
} from 'react-native';
import { useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useListTasks, useUpdateTask } from '@workspace/api-client-react';
import Colors from '@/constants/colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useQueryClient } from '@tanstack/react-query';

type TaskStatus = 'scheduled' | 'in_progress' | 'completed' | 'paid';

const STATUS_LABELS: Record<TaskStatus, string> = {
  scheduled: 'Agendada',
  in_progress: 'Em andamento',
  completed: 'Concluída',
  paid: 'Paga',
};
const STATUS_COLORS: Record<TaskStatus, string> = {
  scheduled: '#f59e0b',
  in_progress: '#3b82f6',
  completed: '#22c55e',
  paid: '#8b5cf6',
};

const fmt = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

const fmtDate = (d: Date | string) =>
  new Date(d).toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric' });

export default function TarefaDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const taskId = Number(id);
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme];
  const queryClient = useQueryClient();
  const navigation = useNavigation();
  const router = useRouter();

  const [showPayModal, setShowPayModal] = useState(false);
  const [payAmount, setPayAmount] = useState('');

  const { data: tasks, isLoading } = useListTasks({});
  const task = tasks?.find(t => t.id === taskId);

  const { mutate: updateTask, isPending: isUpdating } = useUpdateTask();

  // Edit button in header
  useEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <TouchableOpacity
          onPress={() => router.push(`/tarefa/editar/${taskId}`)}
          style={{ paddingHorizontal: 16 }}
        >
          <Ionicons name="pencil-outline" size={20} color={theme.primary} />
        </TouchableOpacity>
      ),
    });
  }, [taskId, navigation, theme.primary]);

  const handleMarkStatus = (newStatus: TaskStatus) => {
    updateTask(
      { id: taskId, data: { status: newStatus } as any },
      { onSuccess: () => queryClient.invalidateQueries() }
    );
  };

  const handleMarkPaid = () => {
    const amount = parseFloat(payAmount.replace(',', '.'));
    if (isNaN(amount) || amount <= 0) {
      Alert.alert('Valor inválido', 'Informe o valor recebido.');
      return;
    }
    updateTask(
      {
        id: taskId,
        data: { status: 'paid', paidAmount: amount, paidAt: new Date().toISOString() } as any,
      },
      { onSuccess: () => { queryClient.invalidateQueries(); setShowPayModal(false); } }
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
        <Text style={{ color: theme.mutedForeground }}>Ordem de serviço não encontrada.</Text>
      </View>
    );
  }

  const st = task.status as TaskStatus;

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.background }]}
      contentContainerStyle={styles.content}
    >
      {/* Header card */}
      <View style={[styles.headerCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
        <View style={styles.headerTop}>
          <View style={[styles.badge, { backgroundColor: STATUS_COLORS[st] + '22' }]}>
            <Text style={[styles.badgeText, { color: STATUS_COLORS[st] }]}>{STATUS_LABELS[st]}</Text>
          </View>
        </View>
        <Text style={[styles.taskTitle, { color: theme.foreground }]}>{task.title}</Text>
        {task.clientName && (
          <View style={styles.infoRow}>
            <Ionicons name="person-outline" size={14} color={theme.mutedForeground} />
            <Text style={[styles.infoText, { color: theme.mutedForeground }]}>{task.clientName}</Text>
          </View>
        )}
        <View style={styles.infoRow}>
          <Ionicons name="calendar-outline" size={14} color={theme.mutedForeground} />
          <Text style={[styles.infoText, { color: theme.mutedForeground }]}>
            {fmtDate(task.dueAt)} · {new Date(task.dueAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
            {task.endAt ? ` – ${new Date(task.endAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}` : ' · defina o término'}
          </Text>
        </View>
        {task.endAt && new Date(task.endAt).toDateString() !== new Date(task.dueAt).toDateString() && (
          <View style={styles.infoRow}>
            <Ionicons name="flag-outline" size={14} color={theme.mutedForeground} />
            <Text style={[styles.infoText, { color: theme.mutedForeground }]}>
              Termina em: {fmtDate(task.endAt)}
            </Text>
          </View>
        )}
        {task.paidAmount != null && (
          <View style={[styles.paidBanner, { backgroundColor: '#f3e8ff' }]}>
            <Ionicons name="cash-outline" size={16} color="#8b5cf6" />
            <Text style={{ color: '#7c3aed', fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 15 }}>
              Pago: {fmt(task.paidAmount)}
            </Text>
            {task.paidAt && (
              <Text style={{ color: '#9d71e0', fontSize: 12, fontFamily: 'PlusJakartaSans_400Regular' }}>
                em {fmtDate(task.paidAt)}
              </Text>
            )}
          </View>
        )}
      </View>

      {/* Description */}
      {task.description && (
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.mutedForeground }]}>DESCRIÇÃO</Text>
          <View style={[styles.notesCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <Text style={[styles.notesText, { color: theme.foreground }]}>{task.description}</Text>
          </View>
        </View>
      )}

      {/* Photos count */}
      {task.photos && task.photos.length > 0 && (
        <View style={[styles.photosBanner, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <Ionicons name="images-outline" size={18} color={theme.primary} />
          <Text style={[styles.photosText, { color: theme.foreground }]}>
            {task.photos.length} {task.photos.length === 1 ? 'foto anexada' : 'fotos anexadas'}
          </Text>
        </View>
      )}

      {/* Actions */}
      <View style={styles.actions}>
        {st === 'scheduled' && (
          <TouchableOpacity
            style={[styles.primaryBtn, { backgroundColor: theme.primary }]}
            onPress={() => handleMarkStatus('in_progress')}
            disabled={isUpdating}
          >
            <Ionicons name="play-circle-outline" size={20} color="#ffffff" />
            <Text style={styles.primaryBtnText}>Iniciar</Text>
          </TouchableOpacity>
        )}
        {(st === 'scheduled' || st === 'in_progress') && (
          <TouchableOpacity
            style={[styles.secondaryBtn, { borderColor: '#22c55e' }]}
            onPress={() => handleMarkStatus('completed')}
            disabled={isUpdating}
          >
            <Ionicons name="checkmark-circle-outline" size={20} color="#22c55e" />
            <Text style={[styles.secondaryBtnText, { color: '#22c55e' }]}>Marcar como concluída</Text>
          </TouchableOpacity>
        )}
        {(st === 'in_progress' || st === 'completed') && (
          <TouchableOpacity
            style={[styles.primaryBtn, { backgroundColor: '#8b5cf6' }]}
            onPress={() => setShowPayModal(true)}
            disabled={isUpdating}
          >
            <Ionicons name="cash-outline" size={20} color="#ffffff" />
            <Text style={styles.primaryBtnText}>Registrar pagamento</Text>
          </TouchableOpacity>
        )}
        {st === 'paid' && (
          <View style={[styles.paidBadge, { backgroundColor: '#f3e8ff' }]}>
            <Ionicons name="checkmark-circle" size={20} color="#8b5cf6" />
            <Text style={{ color: '#7c3aed', fontFamily: 'PlusJakartaSans_600SemiBold' }}>
              Ordem de serviço paga
            </Text>
          </View>
        )}
      </View>

      {/* Pay modal */}
      <Modal
        visible={showPayModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowPayModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalSheet, { backgroundColor: theme.card }]}>
            <Text style={[styles.modalTitle, { color: theme.foreground }]}>Registrar pagamento</Text>
            <Text style={[styles.modalSub, { color: theme.mutedForeground }]}>
              Informe o valor recebido pelo serviço.
            </Text>
            <TextInput
              style={[styles.modalInput, { borderColor: theme.border, color: theme.foreground, backgroundColor: theme.background }]}
              placeholder="0,00"
              placeholderTextColor={theme.mutedForeground}
              value={payAmount}
              onChangeText={setPayAmount}
              keyboardType="decimal-pad"
              autoFocus
            />
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalCancelBtn, { borderColor: theme.border }]}
                onPress={() => setShowPayModal(false)}
              >
                <Text style={[styles.modalCancelText, { color: theme.foreground }]}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalConfirmBtn, { backgroundColor: '#8b5cf6' }]}
                onPress={handleMarkPaid}
                disabled={isUpdating}
              >
                {isUpdating ? (
                  <ActivityIndicator color="#ffffff" size="small" />
                ) : (
                  <Text style={styles.modalConfirmText}>Confirmar</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16, paddingBottom: 40 },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  headerCard: { borderRadius: 12, borderWidth: 1, padding: 16, marginBottom: 16 },
  headerTop: { flexDirection: 'row', marginBottom: 10 },
  badge: { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
  badgeText: { fontSize: 12, fontFamily: 'PlusJakartaSans_600SemiBold' },
  taskTitle: { fontSize: 20, fontFamily: 'PlusJakartaSans_700Bold', marginBottom: 10 },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 },
  infoText: { fontSize: 13, fontFamily: 'PlusJakartaSans_400Regular' },
  paidBanner: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12, padding: 10, borderRadius: 8, flexWrap: 'wrap' },
  section: { marginBottom: 16 },
  sectionTitle: { fontSize: 11, fontFamily: 'PlusJakartaSans_600SemiBold', letterSpacing: 0.8, marginBottom: 8 },
  notesCard: { borderRadius: 10, borderWidth: 1, padding: 14 },
  notesText: { fontSize: 14, fontFamily: 'PlusJakartaSans_400Regular', lineHeight: 22 },
  photosBanner: { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 10, borderWidth: 1, padding: 12, marginBottom: 16 },
  photosText: { fontSize: 14, fontFamily: 'PlusJakartaSans_500Medium' },
  actions: { gap: 10 },
  primaryBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 50, borderRadius: 10 },
  primaryBtnText: { fontSize: 16, fontFamily: 'PlusJakartaSans_600SemiBold', color: '#ffffff' },
  secondaryBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 46, borderRadius: 10, borderWidth: 1.5 },
  secondaryBtnText: { fontSize: 14, fontFamily: 'PlusJakartaSans_600SemiBold' },
  paidBadge: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 46, borderRadius: 10 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  modalSheet: { borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24, paddingBottom: 40 },
  modalTitle: { fontSize: 18, fontFamily: 'PlusJakartaSans_700Bold', marginBottom: 6 },
  modalSub: { fontSize: 14, fontFamily: 'PlusJakartaSans_400Regular', marginBottom: 16 },
  modalInput: { height: 52, borderWidth: 1, borderRadius: 10, paddingHorizontal: 16, fontSize: 22, fontFamily: 'PlusJakartaSans_600SemiBold', marginBottom: 20, textAlign: 'center' },
  modalActions: { flexDirection: 'row', gap: 12 },
  modalCancelBtn: { flex: 1, height: 48, borderRadius: 10, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  modalCancelText: { fontSize: 15, fontFamily: 'PlusJakartaSans_600SemiBold' },
  modalConfirmBtn: { flex: 1, height: 48, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  modalConfirmText: { fontSize: 15, fontFamily: 'PlusJakartaSans_600SemiBold', color: '#ffffff' },
});
