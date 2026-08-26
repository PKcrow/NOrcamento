import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Share,
  Alert,
  ActivityIndicator,
  RefreshControl,
  Modal,
  TextInput,
} from 'react-native';
import { useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import {
  useGetQuote,
  useShareQuote,
  useUpdateQuote,
  useRevokeQuotePublicLink,
  useConvertQuoteToTask,
} from '@workspace/api-client-react';
import Colors from '@/constants/colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useQueryClient } from '@tanstack/react-query';

type QuoteStatus = 'draft' | 'sent' | 'approved' | 'rejected';

const STATUS_LABELS: Record<QuoteStatus, string> = {
  draft: 'Rascunho',
  sent: 'Enviado',
  approved: 'Aprovado',
  rejected: 'Recusado',
};
const STATUS_COLORS: Record<QuoteStatus, string> = {
  draft: '#94a3b8',
  sent: '#3b82f6',
  approved: '#22c55e',
  rejected: '#ef4444',
};

const fmt = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

const fmtDate = (d: Date | string) =>
  new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });

export default function OrcamentoDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const quoteId = Number(id);
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme];
  const queryClient = useQueryClient();
  const navigation = useNavigation();
  const router = useRouter();

  const [sharing, setSharing] = useState(false);

  const { data: quote, isLoading, refetch, isRefetching } = useGetQuote(quoteId);
  const { mutate: shareQuote } = useShareQuote();
  const { mutate: updateQuote, isPending: isUpdating } = useUpdateQuote();
  const { mutate: revokeLink, isPending: isRevoking } = useRevokeQuotePublicLink();
  const { mutate: convertQuoteToTask, isPending: isConverting } = useConvertQuoteToTask();
  const [isScheduleOpen, setIsScheduleOpen] = useState(false);
  const [scheduledDate, setScheduledDate] = useState('');
  const [scheduledTime, setScheduledTime] = useState('08:00');
  const [endDate, setEndDate] = useState('');
  const [endTime, setEndTime] = useState('18:00');

  // Edit button in header
  useEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <TouchableOpacity
          onPress={() => router.push(`/orcamento/editar/${quoteId}`)}
          style={{ paddingHorizontal: 16 }}
        >
          <Ionicons name="pencil-outline" size={20} color={theme.primary} />
        </TouchableOpacity>
      ),
    });
  }, [quoteId, navigation, theme.primary]);

  const handleShare = () => {
    setSharing(true);
    shareQuote(
      { id: quoteId },
      {
        onSuccess: async (data: any) => {
          const token = data?.publicToken ?? quote?.publicToken;
          if (!token) {
            Alert.alert('Erro', 'Não foi possível gerar o link de aprovação.');
            return;
          }
          const link = `https://${process.env.EXPO_PUBLIC_DOMAIN}/orcamento-publico/${token}`;
          try {
            await Share.share({
              message: `Segue o orçamento para aprovação:\n${link}`,
              url: link,
              title: `Orçamento — ${quote?.clientName}`,
            });
          } catch {}
          queryClient.invalidateQueries();
        },
        onError: () => Alert.alert('Erro', 'Não foi possível gerar o link de aprovação.'),
        onSettled: () => setSharing(false),
      }
    );
  };

  const handleStatusChange = (newStatus: QuoteStatus) => {
    updateQuote(
      { id: quoteId, data: { status: newStatus } as any },
      { onSuccess: () => queryClient.invalidateQueries() }
    );
  };

  const handleRevoke = () => {
    Alert.alert(
      'Revogar link',
      'O cliente não conseguirá mais acessar ou aprovar o orçamento pelo link existente.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Revogar',
          style: 'destructive',
          onPress: () =>
            revokeLink({ id: quoteId }, { onSuccess: () => queryClient.invalidateQueries() }),
        },
      ]
    );
  };

  const handleConvertToTask = () => {
    if (!quote) return;
    if (quote.convertedTaskId) {
      router.push(`/tarefa/${quote.convertedTaskId}`);
      return;
    }
    const now = new Date();
    setScheduledDate(now.toLocaleDateString('pt-BR'));
    setScheduledTime(`${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`);
    setEndDate(now.toLocaleDateString('pt-BR'));
    setEndTime('18:00');
    setIsScheduleOpen(true);
  };

  const handleScheduleService = () => {
    if (!quote) return;
    const [day, month, year] = scheduledDate.split('/');
    const [hours, minutes] = scheduledTime.split(':').map(Number);
    const dueAt = new Date(`${year}-${month}-${day}T${scheduledTime}:00`);
    if (
      !/^\d{2}\/\d{2}\/\d{4}$/.test(scheduledDate) ||
      !/^\d{2}:\d{2}$/.test(scheduledTime) ||
      Number.isNaN(dueAt.getTime()) ||
      dueAt.getFullYear() !== Number(year) ||
      dueAt.getMonth() + 1 !== Number(month) ||
      dueAt.getDate() !== Number(day) ||
      hours > 23 ||
      minutes > 59
    ) {
      Alert.alert('Data inválida', 'Informe a data no formato DD/MM/AAAA e um horário válido.');
      return;
    }

    const [endDay, endMonth, endYear] = endDate.split('/');
    const [endHours, endMinutes] = endTime.split(':').map(Number);
    const end = new Date(`${endYear}-${endMonth}-${endDay}T${endTime}:00`);
    if (
      !/^\d{2}\/\d{2}\/\d{4}$/.test(endDate) ||
      !/^\d{2}:\d{2}$/.test(endTime) ||
      Number.isNaN(end.getTime()) ||
      end.getFullYear() !== Number(endYear) ||
      end.getMonth() + 1 !== Number(endMonth) ||
      end.getDate() !== Number(endDay) ||
      endHours > 23 ||
      endMinutes > 59 ||
      end.getTime() <= dueAt.getTime()
    ) {
      Alert.alert('Término inválido', 'Informe uma data e horário posteriores ao início.');
      return;
    }

    convertQuoteToTask(
      { id: quoteId, data: { dueAt: dueAt.toISOString(), endAt: end.toISOString() } },
      {
        onSuccess: (task) => {
          queryClient.invalidateQueries();
          setIsScheduleOpen(false);
          Alert.alert(
            'Serviço agendado!',
            'A ordem de serviço foi vinculada ao orçamento.',
            [
              { text: 'Abrir O.S.', onPress: () => router.push(`/tarefa/${task.id}`) },
              { text: 'Ver agenda', onPress: () => router.push('/tarefas') },
            ],
          );
        },
        onError: (error: any) => {
          Alert.alert(
            'Não foi possível agendar',
            error?.message ?? 'Verifique se não há conflito na agenda e tente novamente.',
          );
        },
      },
    );
  };

  if (isLoading) {
    return (
      <View style={[styles.loading, { backgroundColor: theme.background }]}>
        <ActivityIndicator color={theme.primary} />
      </View>
    );
  }

  if (!quote) {
    return (
      <View style={[styles.loading, { backgroundColor: theme.background }]}>
        <Text style={{ color: theme.mutedForeground }}>Orçamento não encontrado.</Text>
      </View>
    );
  }

  const st = quote.status as QuoteStatus;
  const hasActiveLink =
    quote.publicToken &&
    !quote.publicLinkRevokedAt &&
    (!quote.publicLinkExpiresAt || new Date(quote.publicLinkExpiresAt) > new Date());

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.background }]}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={theme.primary} />}
    >
      {/* Header */}
      <View style={[styles.headerCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
        <View style={styles.headerRow}>
          <View style={styles.headerMain}>
            <Text style={[styles.clientName, { color: theme.foreground }]}>{quote.clientName ?? 'Sem cliente'}</Text>
            <Text style={[styles.dateText, { color: theme.mutedForeground }]}>{fmtDate(quote.createdAt)}</Text>
          </View>
          <View style={[styles.badge, { backgroundColor: STATUS_COLORS[st] + '22' }]}>
            <Text style={[styles.badgeText, { color: STATUS_COLORS[st] }]}>{STATUS_LABELS[st]}</Text>
          </View>
        </View>
        <Text style={[styles.totalText, { color: theme.foreground }]}>{fmt(quote.total)}</Text>
        {quote.laborCost > 0 && (
          <Text style={[styles.laborText, { color: theme.mutedForeground }]}>
            Mão de obra: {fmt(quote.laborCost)}
          </Text>
        )}
        {quote.convertedTaskId && (
          <TouchableOpacity
            style={[styles.linkedTask, { borderColor: theme.primary, backgroundColor: theme.primary + '10' }]}
            onPress={() => router.push(`/tarefa/${quote.convertedTaskId}`)}
          >
            <Ionicons name="clipboard-outline" size={17} color={theme.primary} />
            <Text style={[styles.linkedTaskText, { color: theme.primary }]}>
              O.S. #{quote.convertedTaskId} agendada
            </Text>
            <Ionicons name="chevron-forward" size={16} color={theme.primary} />
          </TouchableOpacity>
        )}
      </View>

      {/* Items */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: theme.mutedForeground }]}>ITENS</Text>
        <View style={[styles.itemsCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
          {quote.items.map((item, i) => (
            <View
              key={item.id}
              style={[
                styles.itemRow,
                i < quote.items.length - 1 && { borderBottomWidth: 1, borderBottomColor: theme.border },
              ]}
            >
              <View style={styles.itemMain}>
                <Text style={[styles.itemDesc, { color: theme.foreground }]}>{item.description}</Text>
                <Text style={[styles.itemQty, { color: theme.mutedForeground }]}>
                  {item.quantity} × {fmt(item.unitPrice)}
                </Text>
              </View>
              <Text style={[styles.itemTotal, { color: theme.foreground }]}>{fmt(item.total)}</Text>
            </View>
          ))}
          <View style={[styles.totalRow, { borderTopColor: theme.border }]}>
            <Text style={[styles.totalLabel, { color: theme.mutedForeground }]}>Total</Text>
            <Text style={[styles.totalValue, { color: theme.foreground }]}>{fmt(quote.total)}</Text>
          </View>
        </View>
      </View>

      {/* Notes */}
      {quote.notes && (
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.mutedForeground }]}>OBSERVAÇÕES</Text>
          <View style={[styles.notesCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <Text style={[styles.notesText, { color: theme.foreground }]}>{quote.notes}</Text>
          </View>
        </View>
      )}

      {/* Client response */}
      {quote.respondedAt && (
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.mutedForeground }]}>RESPOSTA DO CLIENTE</Text>
          <View
            style={[
              styles.notesCard,
              {
                backgroundColor: st === 'approved' ? '#dcfce7' : '#fee2e2',
                borderColor: st === 'approved' ? '#22c55e' : '#ef4444',
              },
            ]}
          >
            <Text style={{ color: st === 'approved' ? '#166534' : '#991b1b', fontFamily: 'PlusJakartaSans_600SemiBold' }}>
              {st === 'approved' ? '✓ Aprovado' : '✗ Recusado'} em {fmtDate(quote.respondedAt)}
            </Text>
            {quote.clientResponseNote && (
              <Text style={{ color: st === 'approved' ? '#166534' : '#991b1b', marginTop: 4, fontFamily: 'PlusJakartaSans_400Regular' }}>
                "{quote.clientResponseNote}"
              </Text>
            )}
          </View>
        </View>
      )}

      {/* Actions */}
      <View style={styles.actions}>
        {/* Share link */}
        {(st === 'draft' || st === 'sent') && (
          <TouchableOpacity
            style={[styles.primaryBtn, { backgroundColor: theme.primary }]}
            onPress={handleShare}
            disabled={sharing}
          >
            {sharing ? (
              <ActivityIndicator color="#ffffff" size="small" />
            ) : (
              <>
                <Ionicons name="share-outline" size={20} color="#ffffff" />
                <Text style={styles.primaryBtnText}>Enviar link de aprovação</Text>
              </>
            )}
          </TouchableOpacity>
        )}

        {/* Conversion is available only after approval. */}
        {st === 'approved' && (
          <TouchableOpacity
            style={[styles.primaryBtn, { backgroundColor: quote.convertedTaskId ? theme.primary : '#8b5cf6' }]}
            onPress={handleConvertToTask}
            disabled={isConverting}
          >
            {isConverting ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <>
                <Ionicons name="clipboard-outline" size={20} color="#ffffff" />
                <Text style={styles.primaryBtnText}>
                  {quote.convertedTaskId ? 'Abrir O.S. agendada' : 'Agendar serviço'}
                </Text>
              </>
            )}
          </TouchableOpacity>
        )}

        {/* Revoke link */}
        {hasActiveLink && st === 'sent' && (
          <TouchableOpacity
            style={[styles.secondaryBtn, { borderColor: theme.destructive }]}
            onPress={handleRevoke}
            disabled={isRevoking}
          >
            <Ionicons name="ban-outline" size={18} color={theme.destructive} />
            <Text style={[styles.secondaryBtnText, { color: theme.destructive }]}>Revogar link</Text>
          </TouchableOpacity>
        )}

        {/* Status changes */}
        {st === 'draft' && (
          <TouchableOpacity
            style={[styles.secondaryBtn, { borderColor: theme.border }]}
            onPress={() => handleStatusChange('sent')}
            disabled={isUpdating}
          >
            <Ionicons name="paper-plane-outline" size={18} color={theme.foreground} />
            <Text style={[styles.secondaryBtnText, { color: theme.foreground }]}>Marcar como enviado</Text>
          </TouchableOpacity>
        )}
        {st === 'sent' && (
          <>
            <TouchableOpacity
              style={[styles.secondaryBtn, { borderColor: '#22c55e' }]}
              onPress={() => handleStatusChange('approved')}
              disabled={isUpdating}
            >
              <Ionicons name="checkmark-circle-outline" size={18} color="#22c55e" />
              <Text style={[styles.secondaryBtnText, { color: '#22c55e' }]}>Marcar como aprovado</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.secondaryBtn, { borderColor: theme.destructive }]}
              onPress={() => handleStatusChange('rejected')}
              disabled={isUpdating}
            >
              <Ionicons name="close-circle-outline" size={18} color={theme.destructive} />
              <Text style={[styles.secondaryBtnText, { color: theme.destructive }]}>Marcar como recusado</Text>
            </TouchableOpacity>
          </>
        )}
      </View>

      <Modal visible={isScheduleOpen} transparent animationType="slide" onRequestClose={() => setIsScheduleOpen(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.scheduleModal, { backgroundColor: theme.card }]}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={[styles.modalTitle, { color: theme.foreground }]}>Agendar serviço</Text>
                <Text style={[styles.modalSubtitle, { color: theme.mutedForeground }]}>
                   Escolha o horário de início e término da O.S.
                </Text>
              </View>
              <TouchableOpacity onPress={() => setIsScheduleOpen(false)} disabled={isConverting}>
                <Ionicons name="close" size={24} color={theme.mutedForeground} />
              </TouchableOpacity>
            </View>

            <Text style={[styles.inputLabel, { color: theme.foreground }]}>Início *</Text>
            <View style={styles.dateTimeRow}>
              <TextInput
                style={[styles.scheduleInput, styles.dateInput, { borderColor: theme.border, color: theme.foreground, backgroundColor: theme.background }]}
                placeholder="DD/MM/AAAA"
                placeholderTextColor={theme.mutedForeground}
                keyboardType="numeric"
                maxLength={10}
                value={scheduledDate}
                onChangeText={(value) => setScheduledDate(value.replace(/\D/g, '').replace(/(\d{2})(\d)/, '$1/$2').replace(/(\d{2}\/\d{2})(\d)/, '$1/$2'))}
              />
              <TextInput
                style={[styles.scheduleInput, styles.timeInput, { borderColor: theme.border, color: theme.foreground, backgroundColor: theme.background }]}
                placeholder="08:00"
                placeholderTextColor={theme.mutedForeground}
                keyboardType="numeric"
                maxLength={5}
                value={scheduledTime}
                onChangeText={setScheduledTime}
              />
            </View>

             <Text style={[styles.inputLabel, { color: theme.foreground }]}>Término *</Text>
            <View style={styles.dateTimeRow}>
              <TextInput
                style={[styles.scheduleInput, styles.dateInput, { borderColor: theme.border, color: theme.foreground, backgroundColor: theme.background }]}
                placeholder="DD/MM/AAAA"
                placeholderTextColor={theme.mutedForeground}
                keyboardType="numeric"
                maxLength={10}
                value={endDate}
                onChangeText={(value) => setEndDate(value.replace(/\D/g, '').replace(/(\d{2})(\d)/, '$1/$2').replace(/(\d{2}\/\d{2})(\d)/, '$1/$2'))}
              />
              <TextInput
                style={[styles.scheduleInput, styles.timeInput, { borderColor: theme.border, color: theme.foreground, backgroundColor: theme.background }]}
                placeholder="18:00"
                placeholderTextColor={theme.mutedForeground}
                keyboardType="numeric"
                maxLength={5}
                value={endTime}
                onChangeText={setEndTime}
              />
            </View>

            <Text style={[styles.modalHint, { color: theme.mutedForeground }]}>
               Você pode agendar outro serviço no mesmo dia desde que os horários não se sobreponham.
            </Text>
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalCancel, { borderColor: theme.border }]}
                onPress={() => setIsScheduleOpen(false)}
                disabled={isConverting}
              >
                <Text style={[styles.modalCancelText, { color: theme.foreground }]}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalSubmit, { backgroundColor: theme.primary }, isConverting && { opacity: 0.65 }]}
                onPress={handleScheduleService}
                disabled={isConverting}
              >
                {isConverting ? <ActivityIndicator color="#ffffff" size="small" /> : <Text style={styles.modalSubmitText}>Agendar</Text>}
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
  headerRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 10 },
  headerMain: { flex: 1, paddingRight: 10 },
  clientName: { fontSize: 20, fontFamily: 'PlusJakartaSans_700Bold', marginBottom: 3 },
  dateText: { fontSize: 13, fontFamily: 'PlusJakartaSans_400Regular' },
  badge: { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
  badgeText: { fontSize: 12, fontFamily: 'PlusJakartaSans_600SemiBold' },
  totalText: { fontSize: 28, fontFamily: 'PlusJakartaSans_700Bold' },
  laborText: { fontSize: 13, fontFamily: 'PlusJakartaSans_400Regular', marginTop: 2 },
  linkedTask: { flexDirection: 'row', alignItems: 'center', gap: 7, borderWidth: 1, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, marginTop: 12 },
  linkedTaskText: { flex: 1, fontSize: 13, fontFamily: 'PlusJakartaSans_600SemiBold' },
  section: { marginBottom: 16 },
  sectionTitle: { fontSize: 11, fontFamily: 'PlusJakartaSans_600SemiBold', letterSpacing: 0.8, marginBottom: 8 },
  itemsCard: { borderRadius: 10, borderWidth: 1, overflow: 'hidden' },
  itemRow: { flexDirection: 'row', alignItems: 'center', padding: 12, gap: 10 },
  itemMain: { flex: 1 },
  itemDesc: { fontSize: 14, fontFamily: 'PlusJakartaSans_500Medium', marginBottom: 2 },
  itemQty: { fontSize: 12, fontFamily: 'PlusJakartaSans_400Regular' },
  itemTotal: { fontSize: 14, fontFamily: 'PlusJakartaSans_600SemiBold' },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', padding: 12, borderTopWidth: 1 },
  totalLabel: { fontSize: 14, fontFamily: 'PlusJakartaSans_500Medium' },
  totalValue: { fontSize: 16, fontFamily: 'PlusJakartaSans_700Bold' },
  notesCard: { borderRadius: 10, borderWidth: 1, padding: 14 },
  notesText: { fontSize: 14, fontFamily: 'PlusJakartaSans_400Regular', lineHeight: 22 },
  actions: { gap: 10, marginTop: 8 },
  primaryBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 50, borderRadius: 10 },
  primaryBtnText: { fontSize: 16, fontFamily: 'PlusJakartaSans_600SemiBold', color: '#ffffff' },
  secondaryBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 46, borderRadius: 10, borderWidth: 1.5 },
  secondaryBtnText: { fontSize: 14, fontFamily: 'PlusJakartaSans_600SemiBold' },
  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(15, 23, 42, 0.48)' },
  scheduleModal: { borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, gap: 10 },
  modalHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 6 },
  modalTitle: { fontSize: 19, fontFamily: 'PlusJakartaSans_700Bold' },
  modalSubtitle: { fontSize: 13, fontFamily: 'PlusJakartaSans_400Regular', marginTop: 3 },
  inputLabel: { fontSize: 13, fontFamily: 'PlusJakartaSans_600SemiBold', marginTop: 4 },
  dateTimeRow: { flexDirection: 'row', gap: 8 },
  scheduleInput: { height: 46, borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, fontSize: 15, fontFamily: 'PlusJakartaSans_400Regular' },
  dateInput: { flex: 1 },
  timeInput: { width: 86 },
  modalHint: { fontSize: 12, fontFamily: 'PlusJakartaSans_400Regular', lineHeight: 18, marginTop: 2 },
  modalActions: { flexDirection: 'row', gap: 10, marginTop: 8 },
  modalCancel: { flex: 1, height: 48, borderWidth: 1, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  modalCancelText: { fontSize: 14, fontFamily: 'PlusJakartaSans_600SemiBold' },
  modalSubmit: { flex: 1, height: 48, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  modalSubmitText: { color: '#ffffff', fontSize: 14, fontFamily: 'PlusJakartaSans_600SemiBold' },
});
