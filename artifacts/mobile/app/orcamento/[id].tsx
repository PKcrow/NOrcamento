import React, { useEffect, useState } from 'react';
import { useAuth } from '@clerk/expo';
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
} from 'react-native';
import { useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import {
  useGetQuote,
  useShareQuote,
  useUpdateQuote,
  useRevokeQuotePublicLink,
  useConvertQuoteToTask,
  useDeleteQuote,
  useGetCompany,
} from '@workspace/api-client-react';
import Colors from '@/constants/colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useQueryClient } from '@tanstack/react-query';
import {
  getCompanyLogoDataUri,
  quotePdfHtml,
  sharePdfDocument,
} from '@/lib/nativePdf';
import {
  DatePickerField,
  isScheduleEndBeforeStart,
  TimePickerField,
} from '@/components/SchedulePickerFields';

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
  const theme = Colors[colorScheme ?? 'light'];
  const queryClient = useQueryClient();
  const navigation = useNavigation();
  const router = useRouter();

  const [sharing, setSharing] = useState(false);
  const [sharingPdf, setSharingPdf] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const { data: quote, isLoading, refetch, isRefetching } = useGetQuote(quoteId);
  const { data: company } = useGetCompany();
  const { getToken } = useAuth();
  const { mutate: shareQuote } = useShareQuote();
  const { mutate: updateQuote, isPending: isUpdating } = useUpdateQuote();
  const { mutate: revokeLink, isPending: isRevoking } = useRevokeQuotePublicLink();
  const { mutate: convertQuoteToTask, isPending: isConverting } = useConvertQuoteToTask();
  const { mutate: deleteQuote, isPending: isDeleting } = useDeleteQuote();
  const [isScheduleOpen, setIsScheduleOpen] = useState(false);
  const [scheduledDate, setScheduledDate] = useState<Date | null>(null);
  const [scheduledTime, setScheduledTime] = useState('00:00');
  const [endDate, setEndDate] = useState<Date | null>(null);
  const [endTime, setEndTime] = useState('00:00');
  const isEndBeforeStart = isScheduleEndBeforeStart(
    scheduledDate,
    scheduledTime,
    endDate,
    endTime,
  );

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
        onSuccess: async (data) => {
          const token = data?.publicToken ?? quote?.publicToken;
          if (!token) {
            Alert.alert('Erro', 'Não foi possível gerar o link de aprovação.');
            return;
          }
          const webDomain = process.env.EXPO_PUBLIC_WEB_DOMAIN ?? process.env.EXPO_PUBLIC_DOMAIN;
          if (!webDomain) {
            Alert.alert('Erro', 'O domínio público do web não está configurado.');
            return;
          }
          const link = `https://${webDomain}/orcamento-publico/${token}`;
          try {
            await Share.share({
              message: `Segue o orçamento para aprovação:\n${link}`,
              url: link,
              title: `Orçamento — ${quote?.clientName}`,
            });
           } catch {
             Alert.alert(
               'Link gerado',
               `Não foi possível abrir o compartilhamento. Envie este link manualmente:\n\n${link}`,
             );
           }
          queryClient.invalidateQueries();
        },
        onError: () => Alert.alert('Erro', 'Não foi possível gerar o link de aprovação.'),
        onSettled: () => setSharing(false),
      }
    );
  };

  const handleSharePdf = async () => {
    if (!quote || sharingPdf) return;
    setSharingPdf(true);
    try {
      const token = await getToken();
      const logoDataUri = await getCompanyLogoDataUri(company?.logoUrl, token);
      const companyWithEmbeddedLogo = company
        ? { ...company, logoUrl: logoDataUri }
        : undefined;
      await sharePdfDocument(
        `Orçamento #${quote.id}`,
        quotePdfHtml(quote, companyWithEmbeddedLogo),
      );
    } catch {
      Alert.alert('Erro', 'Não foi possível gerar ou compartilhar o PDF do orçamento.');
    } finally {
      setSharingPdf(false);
    }
  };

  const handleDelete = () => {
    setDeleteError(null);
    setIsDeleteOpen(true);
  };

  const confirmDelete = () => {
    setDeleteError(null);
    deleteQuote(
      { id: quoteId },
      {
        onSuccess: () => {
          setIsDeleteOpen(false);
          queryClient.invalidateQueries();
          router.replace('/(tabs)/orcamentos');
        },
        onError: () =>
          setDeleteError('Não foi possível excluir o orçamento e a O.S. vinculada. Tente novamente.'),
      },
    );
  };

  const handleStatusChange = (newStatus: QuoteStatus) => {
    updateQuote(
      { id: quoteId, data: { status: newStatus } },
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
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    setScheduledDate(start);
    setScheduledTime('00:00');
    setEndDate(end);
    setEndTime('00:00');
    setIsScheduleOpen(true);
  };

  const handleScheduleService = () => {
    if (!quote) return;
    if (!scheduledDate || !endDate) {
      Alert.alert('Campo obrigatório', 'Selecione as datas de início e término.');
      return;
    }
    const startTimeParts = scheduledTime.match(/^(\d{2}):(\d{2})$/);
    if (
      !startTimeParts ||
      Number(startTimeParts[1]) > 23 ||
      Number(startTimeParts[2]) > 59
    ) {
      Alert.alert('Horário inválido', 'Selecione um horário de início válido.');
      return;
    }
    const dueAt = new Date(scheduledDate);
    dueAt.setHours(Number(startTimeParts[1]), Number(startTimeParts[2]), 0, 0);
    if (
      Number.isNaN(dueAt.getTime())
    ) {
      Alert.alert('Data inválida', 'Selecione uma data e um horário válidos.');
      return;
    }

    const endTimeParts = endTime.match(/^(\d{2}):(\d{2})$/);
    if (
      !endTimeParts ||
      Number(endTimeParts[1]) > 23 ||
      Number(endTimeParts[2]) > 59
    ) {
      Alert.alert('Horário inválido', 'Selecione um horário de término válido.');
      return;
    }
    const end = new Date(endDate);
    end.setHours(Number(endTimeParts[1]), Number(endTimeParts[2]), 0, 0);
    if (
      Number.isNaN(end.getTime()) ||
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
        onError: (error) => {
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

      {/* Service scope */}
      {quote.serviceScopeEnabled && quote.serviceDescription?.trim() && (
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.mutedForeground }]}>ESCOPO DO SERVIÇO</Text>
          <View style={[styles.notesCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <Text style={[styles.notesText, { color: theme.foreground }]}>
              {quote.serviceDescription.trim()}
            </Text>
          </View>
        </View>
      )}

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
        <TouchableOpacity
          style={[styles.secondaryBtn, { borderColor: theme.primary }]}
          onPress={handleSharePdf}
          disabled={sharingPdf}
        >
          {sharingPdf ? (
            <ActivityIndicator color={theme.primary} size="small" />
          ) : (
            <Ionicons name="document-text-outline" size={20} color={theme.primary} />
          )}
          <Text style={[styles.secondaryBtnText, { color: theme.primary }]}>
            {sharingPdf ? 'Gerando PDF...' : 'Imprimir / compartilhar PDF'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.secondaryBtn, { borderColor: theme.primary }]}
          onPress={() => router.push(`/orcamento/novo?duplicar=${quoteId}`)}
        >
          <Ionicons name="copy-outline" size={20} color={theme.primary} />
          <Text style={[styles.secondaryBtnText, { color: theme.primary }]}>Duplicar orçamento</Text>
        </TouchableOpacity>

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

        <TouchableOpacity
          style={[styles.secondaryBtn, { borderColor: theme.destructive }]}
          onPress={handleDelete}
          disabled={isDeleting || isUpdating || isConverting}
        >
          {isDeleting ? (
            <ActivityIndicator color={theme.destructive} size="small" />
          ) : (
            <Ionicons name="trash-outline" size={18} color={theme.destructive} />
          )}
          <Text style={[styles.secondaryBtnText, { color: theme.destructive }]}>
            Excluir orçamento
          </Text>
        </TouchableOpacity>
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
              <View style={styles.dateInput}>
                <DatePickerField
                  value={scheduledDate}
                  onChange={setScheduledDate}
                  accessibilityLabel="Selecionar data de início"
                />
              </View>
              <View style={styles.timeInput}>
                <TimePickerField
                  value={scheduledTime}
                  onChange={setScheduledTime}
                  accessibilityLabel="Selecionar horário de início"
                />
              </View>
            </View>

            <Text style={[styles.inputLabel, { color: theme.foreground }]}>Término *</Text>
            <View style={styles.dateTimeRow}>
              <View style={styles.dateInput}>
                <DatePickerField
                  value={endDate}
                  onChange={setEndDate}
                  accessibilityLabel="Selecionar data de término"
                />
              </View>
              <View style={styles.timeInput}>
                <TimePickerField
                  value={endTime}
                  onChange={setEndTime}
                  accessibilityLabel="Selecionar horário de término"
                />
              </View>
            </View>

            {isEndBeforeStart ? (
              <Text
                accessibilityRole="alert"
                style={[styles.modalError, { color: theme.destructive }]}
              >
                O término não pode ser anterior ao início.
              </Text>
            ) : (
              <Text style={[styles.modalHint, { color: theme.mutedForeground }]}>
                Você pode agendar outro serviço no mesmo dia desde que os horários não se sobreponham.
              </Text>
            )}
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

      <Modal
        visible={isDeleteOpen}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => !isDeleting && setIsDeleteOpen(false)}
      >
        <View style={styles.deleteOverlay}>
          <View style={[styles.deleteModal, { backgroundColor: theme.card }]}>
            <View style={[styles.deleteIcon, { backgroundColor: theme.secondary }]}>
              <Ionicons name="trash-outline" size={26} color={theme.destructive} />
            </View>

            <Text style={[styles.deleteTitle, { color: theme.foreground }]}>
              Excluir orçamento?
            </Text>
            <Text style={[styles.deleteDescription, { color: theme.mutedForeground }]}>
              Esta ação apaga permanentemente o orçamento
              {quote?.convertedTaskId ? ' e a O.S. vinculada' : ''}.
            </Text>

            {quote?.convertedTaskId ? (
              <View style={[styles.deleteWarning, { backgroundColor: theme.secondary, borderColor: theme.border }]}>
                <Ionicons name="warning-outline" size={20} color={theme.destructive} />
                <View style={styles.deleteWarningText}>
                  <Text style={[styles.deleteWarningTitle, { color: theme.foreground }]}>
                    1 O.S. vinculada
                  </Text>
                  <Text style={[styles.deleteWarningDescription, { color: theme.mutedForeground }]}>
                    Ela também será apagada e não poderá ser recuperada.
                  </Text>
                </View>
              </View>
            ) : null}

            {deleteError ? (
              <Text style={[styles.deleteError, { color: theme.destructive }]}>
                {deleteError}
              </Text>
            ) : null}

            <View style={styles.deleteActions}>
              <TouchableOpacity
                style={[styles.deleteCancel, { borderColor: theme.border }]}
                onPress={() => setIsDeleteOpen(false)}
                disabled={isDeleting}
              >
                <Text style={[styles.deleteCancelText, { color: theme.foreground }]}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.deleteConfirm, { backgroundColor: theme.destructive }, isDeleting && styles.disabledButton]}
                onPress={confirmDelete}
                disabled={isDeleting}
              >
                {isDeleting ? (
                  <ActivityIndicator color={theme.destructiveForeground} size="small" />
                ) : (
                  <>
                    <Ionicons name="trash-outline" size={18} color={theme.destructiveForeground} />
                    <Text style={[styles.deleteConfirmText, { color: theme.destructiveForeground }]}>
                      Excluir tudo
                    </Text>
                  </>
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
  dateInput: { flex: 1 },
  timeInput: { width: 128 },
  modalHint: { fontSize: 12, fontFamily: 'PlusJakartaSans_400Regular', lineHeight: 18, marginTop: 2 },
  modalError: { fontSize: 12, fontFamily: 'PlusJakartaSans_600SemiBold', lineHeight: 18, marginTop: 2 },
  modalActions: { flexDirection: 'row', gap: 10, marginTop: 8 },
  modalCancel: { flex: 1, height: 48, borderWidth: 1, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  modalCancelText: { fontSize: 14, fontFamily: 'PlusJakartaSans_600SemiBold' },
  modalSubmit: { flex: 1, height: 48, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  modalSubmitText: { color: '#ffffff', fontSize: 14, fontFamily: 'PlusJakartaSans_600SemiBold' },
  deleteOverlay: { flex: 1, justifyContent: 'center', padding: 20, backgroundColor: 'rgba(15, 23, 42, 0.62)' },
  deleteModal: { width: '100%', maxWidth: 420, alignSelf: 'center', borderRadius: 20, padding: 22 },
  deleteIcon: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center', marginBottom: 18 },
  deleteTitle: { fontSize: 22, fontFamily: 'PlusJakartaSans_700Bold', marginBottom: 8 },
  deleteDescription: { fontSize: 14, lineHeight: 21, fontFamily: 'PlusJakartaSans_400Regular' },
  deleteWarning: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, borderWidth: 1, borderRadius: 12, padding: 14, marginTop: 18 },
  deleteWarningText: { flex: 1 },
  deleteWarningTitle: { fontSize: 14, fontFamily: 'PlusJakartaSans_700Bold', marginBottom: 3 },
  deleteWarningDescription: { fontSize: 13, lineHeight: 18, fontFamily: 'PlusJakartaSans_400Regular' },
  deleteError: { fontSize: 13, lineHeight: 18, fontFamily: 'PlusJakartaSans_500Medium', marginTop: 14 },
  deleteActions: { flexDirection: 'row', gap: 10, marginTop: 22 },
  deleteCancel: { flex: 1, height: 50, borderWidth: 1, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  deleteCancelText: { fontSize: 14, fontFamily: 'PlusJakartaSans_600SemiBold' },
  deleteConfirm: { flex: 1.15, height: 50, borderRadius: 10, flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center' },
  deleteConfirmText: { fontSize: 14, fontFamily: 'PlusJakartaSans_700Bold' },
  disabledButton: { opacity: 0.65 },
});
