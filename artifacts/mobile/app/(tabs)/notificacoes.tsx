import React from 'react';
import {
  ActivityIndicator,
  Alert,
  RefreshControl,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@clerk/expo';
import {
  getGetNotificationsQueryKey,
  useGetNotifications,
  useUpdateTask,
  type Task,
} from '@workspace/api-client-react';
import Colors from '@/constants/colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import {
  formatPaymentDate,
  formatPaymentDateInput,
  parsePaymentAmount,
  parsePaymentDate,
} from '@/lib/payment';

const formatDate = (value: Date | string) =>
  new Date(value).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });

type TaskSection = {
  title: string;
  description: string;
  icon: React.ComponentProps<typeof Ionicons>['name'];
  color: string;
  tasks: Task[];
};

export default function NotificationsScreen() {
  const router = useRouter();
  const { signOut } = useAuth();
  const queryClient = useQueryClient();
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme ?? 'light'];
  const [paymentTask, setPaymentTask] = React.useState<Task | null>(null);
  const [payAmount, setPayAmount] = React.useState('');
  const [payDate, setPayDate] = React.useState('');
  const { mutate: updateTask, isPending: isUpdating } = useUpdateTask();
  const {
    data: notifications,
    error,
    isLoading,
    isError,
    isRefetching,
    refetch,
  } = useGetNotifications({
    query: {
      queryKey: getGetNotificationsQueryKey(),
      refetchInterval: 60_000,
    },
  });
  const isSessionExpired = error?.status === 401;

  const handleReturnToLogin = async () => {
    try {
      await signOut();
      queryClient.clear();
      router.replace('/sign-in');
    } catch {
      Alert.alert(
        'Não foi possível sair',
        'Tente novamente para voltar à tela de login.',
      );
    }
  };

  const openPaymentModal = (task: Task) => {
    setPaymentTask(task);
    setPayAmount('');
    setPayDate(formatPaymentDate(new Date()));
  };

  const closePaymentModal = (force = false) => {
    if (isUpdating && !force) return;
    setPaymentTask(null);
    setPayAmount('');
    setPayDate('');
  };

  const handleRegisterPayment = () => {
    if (!paymentTask) return;

    const amount = parsePaymentAmount(payAmount);
    if (amount === null) {
      Alert.alert('Valor inválido', 'Informe um valor pago maior que zero.');
      return;
    }

    const date = parsePaymentDate(payDate);
    if (!date) {
      Alert.alert('Data inválida', 'Informe uma data válida no formato DD/MM/AAAA.');
      return;
    }

    updateTask(
      {
        id: paymentTask.id,
        data: {
          status: 'paid',
          paidAmount: amount,
          paidAt: date.toISOString(),
        },
      },
      {
        onSuccess: () => {
          void queryClient.invalidateQueries();
          closePaymentModal(true);
        },
        onError: () => {
          Alert.alert('Erro', 'Não foi possível registrar o pagamento.');
        },
      },
    );
  };

  const sections: TaskSection[] = [
    {
      title: 'Atrasadas',
      description: 'Ordens agendadas que precisam de atenção.',
      icon: 'alert-circle-outline',
      color: '#dc2626',
      tasks: notifications?.overdueTasks ?? [],
    },
    {
      title: 'Próximas',
      description: 'Ordens para as próximas 48 horas.',
      icon: 'time-outline',
      color: '#d97706',
      tasks: notifications?.dueSoonTasks ?? [],
    },
    {
      title: 'Pagamento pendente',
      description: 'Serviços concluídos que ainda não foram pagos.',
      icon: 'wallet-outline',
      color: '#7c3aed',
      tasks: notifications?.pendingPaymentTasks ?? [],
    },
  ];

  const totalTaskNotifications = sections.reduce(
    (total, section) => total + section.tasks.length,
    0,
  );
  const quoteResponseCount = notifications?.quoteResponses.length ?? 0;

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.background }]}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={isRefetching}
          onRefresh={refetch}
          tintColor={theme.primary}
        />
      }
    >
      <View style={styles.header}>
        <Text style={[styles.eyebrow, { color: theme.primary }]}>CENTRAL</Text>
        <Text style={[styles.title, { color: theme.foreground }]}>
          Notificações
        </Text>
        <Text style={[styles.subtitle, { color: theme.mutedForeground }]}>
          {totalTaskNotifications + quoteResponseCount > 0
            ? `${totalTaskNotifications + quoteResponseCount} pendência${totalTaskNotifications + quoteResponseCount === 1 ? '' : 's'} para revisar`
            : 'Tudo em dia por enquanto.'}
        </Text>
      </View>

      {isLoading && (
        <View style={styles.state}>
          <ActivityIndicator color={theme.primary} />
        </View>
      )}

      {isError && !isLoading && (
        <View
          style={[
            styles.stateCard,
            { backgroundColor: theme.card, borderColor: theme.border },
          ]}
        >
          <Ionicons
            name="cloud-offline-outline"
            size={30}
            color={theme.mutedForeground}
          />
          {isSessionExpired ? (
            <>
              <Text style={[styles.stateTitle, { color: theme.foreground }]}>
                Sessão expirada
              </Text>
              <Text style={[styles.stateDescription, { color: theme.mutedForeground }]}>
                Sua sessão perdeu a validade. Renove a sessão ou entre novamente
                para continuar.
              </Text>
              <TouchableOpacity
                onPress={() => void refetch()}
                disabled={isRefetching}
                style={[styles.retryButton, { backgroundColor: theme.primary }]}
              >
                {isRefetching ? (
                  <ActivityIndicator color="#ffffff" size="small" />
                ) : (
                  <Text style={styles.retryButtonText}>Renovar sessão</Text>
                )}
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => void handleReturnToLogin()}
                disabled={isRefetching}
                style={[styles.loginButton, { borderColor: theme.border }]}
              >
                <Text style={[styles.loginButtonText, { color: theme.foreground }]}>
                  Voltar ao login
                </Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <Text style={[styles.stateTitle, { color: theme.foreground }]}>
                Não foi possível carregar as notificações
              </Text>
              <TouchableOpacity
                onPress={() => void refetch()}
                style={[styles.retryButton, { backgroundColor: theme.primary }]}
              >
                <Text style={styles.retryButtonText}>Tentar novamente</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      )}

      {!isLoading &&
        !isError &&
        sections.map((section) => (
          <View key={section.title} style={styles.section}>
            <View style={styles.sectionHeader}>
              <View
                style={[
                  styles.sectionIcon,
                  { backgroundColor: `${section.color}18` },
                ]}
              >
                <Ionicons name={section.icon} size={19} color={section.color} />
              </View>
              <View style={styles.sectionHeading}>
                <Text style={[styles.sectionTitle, { color: theme.foreground }]}>
                  {section.title}
                </Text>
                <Text
                  style={[styles.sectionDescription, { color: theme.mutedForeground }]}
                >
                  {section.description}
                </Text>
              </View>
              <View
                style={[styles.count, { backgroundColor: `${section.color}18` }]}
              >
                <Text style={[styles.countText, { color: section.color }]}>
                  {section.tasks.length}
                </Text>
              </View>
            </View>

            {section.tasks.length === 0 ? (
              <View
                style={[
                  styles.emptyCard,
                  { backgroundColor: theme.card, borderColor: theme.border },
                ]}
              >
                <Text style={[styles.emptyText, { color: theme.mutedForeground }]}>
                  Nenhuma ordem nesta categoria.
                </Text>
              </View>
            ) : (
              section.tasks.map((task) => (
                <TaskNotificationCard
                  key={task.id}
                  task={task}
                  color={section.color}
                  theme={theme}
                  onPress={() => router.push(`/tarefa/${task.id}`)}
                  isPaymentPending={section.title === 'Pagamento pendente'}
                  onRegisterPayment={() => openPaymentModal(task)}
                  isRegisteringPayment={isUpdating && paymentTask?.id === task.id}
                />
              ))
            )}
          </View>
        ))}

      {!isLoading && !isError && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View
              style={[styles.sectionIcon, { backgroundColor: '#2563eb18' }]}
            >
              <Ionicons
                name="chatbubble-ellipses-outline"
                size={19}
                color="#2563eb"
              />
            </View>
            <View style={styles.sectionHeading}>
              <Text style={[styles.sectionTitle, { color: theme.foreground }]}>
                Respostas de orçamento
              </Text>
              <Text
                style={[styles.sectionDescription, { color: theme.mutedForeground }]}
              >
                Respostas recebidas nos últimos 7 dias.
              </Text>
            </View>
            <View style={[styles.count, { backgroundColor: '#2563eb18' }]}>
              <Text style={[styles.countText, { color: '#2563eb' }]}>
                {quoteResponseCount}
              </Text>
            </View>
          </View>

          {quoteResponseCount === 0 ? (
            <View
              style={[
                styles.emptyCard,
                { backgroundColor: theme.card, borderColor: theme.border },
              ]}
            >
              <Text style={[styles.emptyText, { color: theme.mutedForeground }]}>
                Nenhuma resposta recente.
              </Text>
            </View>
          ) : (
            notifications?.quoteResponses.map((quote) => (
              <TouchableOpacity
                key={quote.id}
                onPress={() => router.push(`/orcamento/${quote.id}`)}
                style={[
                  styles.notificationCard,
                  { backgroundColor: theme.card, borderColor: theme.border },
                ]}
              >
                <View style={[styles.cardIcon, { backgroundColor: '#2563eb18' }]}>
                  <Ionicons name="document-text-outline" size={19} color="#2563eb" />
                </View>
                <View style={styles.cardContent}>
                  <Text
                    style={[styles.cardTitle, { color: theme.foreground }]}
                    numberOfLines={1}
                  >
                    {quote.clientName}
                  </Text>
                  <Text style={[styles.cardSubtitle, { color: theme.mutedForeground }]}>
                    Orçamento {quote.status === 'approved' ? 'aprovado' : 'recusado'} ·{' '}
                    {formatDate(quote.respondedAt)}
                  </Text>
                </View>
                <Ionicons
                  name="chevron-forward"
                  size={17}
                  color={theme.mutedForeground}
                />
              </TouchableOpacity>
            ))
          )}
        </View>
      )}

      <Modal
        visible={paymentTask !== null}
        transparent
        animationType="slide"
        onRequestClose={() => closePaymentModal()}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalSheet, { backgroundColor: theme.card }]}>
            <Text style={[styles.modalTitle, { color: theme.foreground }]}>
              Registrar pagamento
            </Text>
            <Text style={[styles.modalSub, { color: theme.mutedForeground }]}>
              {paymentTask?.title ?? 'Informe o valor e a data recebidos.'}
            </Text>
            <TextInput
              style={[
                styles.modalInput,
                {
                  borderColor: theme.border,
                  color: theme.foreground,
                  backgroundColor: theme.background,
                },
              ]}
              placeholder="Valor pago"
              placeholderTextColor={theme.mutedForeground}
              value={payAmount}
              onChangeText={setPayAmount}
              keyboardType="decimal-pad"
              autoFocus
            />
            <TextInput
              style={[
                styles.dateModalInput,
                {
                  borderColor: theme.border,
                  color: theme.foreground,
                  backgroundColor: theme.background,
                },
              ]}
              placeholder="DD/MM/AAAA"
              placeholderTextColor={theme.mutedForeground}
              value={payDate}
              onChangeText={(value) => setPayDate(formatPaymentDateInput(value))}
              keyboardType="number-pad"
              maxLength={10}
            />
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalCancelBtn, { borderColor: theme.border }]}
                onPress={() => closePaymentModal()}
                disabled={isUpdating}
              >
                <Text style={[styles.modalCancelText, { color: theme.foreground }]}>
                  Cancelar
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalConfirmBtn, { backgroundColor: '#8b5cf6' }]}
                onPress={handleRegisterPayment}
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

function TaskNotificationCard({
  task,
  color,
  theme,
  onPress,
  isPaymentPending,
  onRegisterPayment,
  isRegisteringPayment,
}: {
  task: Task;
  color: string;
  theme: typeof Colors.light;
  onPress: () => void;
  isPaymentPending: boolean;
  onRegisterPayment: () => void;
  isRegisteringPayment: boolean;
}) {
  return (
    <View
      style={[
        styles.notificationCard,
        { backgroundColor: theme.card, borderColor: theme.border },
      ]}
    >
      <TouchableOpacity onPress={onPress} style={styles.cardMain}>
        <View style={[styles.cardIcon, { backgroundColor: `${color}18` }]}>
          <Ionicons name="clipboard-outline" size={19} color={color} />
        </View>
        <View style={styles.cardContent}>
          <Text style={[styles.cardTitle, { color: theme.foreground }]} numberOfLines={1}>
            {task.title}
          </Text>
          <Text style={[styles.cardSubtitle, { color: theme.mutedForeground }]}>
            {task.clientName ?? 'Sem cliente'} · {formatDate(task.dueAt)}
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={17} color={theme.mutedForeground} />
      </TouchableOpacity>
      {isPaymentPending && (
        <TouchableOpacity
          onPress={onRegisterPayment}
          disabled={isRegisteringPayment}
          accessibilityRole="button"
          accessibilityLabel={`Registrar pagamento de ${task.title}`}
          style={[
            styles.paymentAction,
            { borderTopColor: theme.border, backgroundColor: '#8b5cf610' },
          ]}
        >
          {isRegisteringPayment ? (
            <ActivityIndicator size="small" color="#7c3aed" />
          ) : (
            <Ionicons name="cash-outline" size={18} color="#7c3aed" />
          )}
          <Text style={styles.paymentActionText}>Registrar pagamento</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16, paddingBottom: 36 },
  header: { marginBottom: 24 },
  eyebrow: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_700Bold',
    letterSpacing: 1,
    marginBottom: 5,
  },
  title: { fontSize: 26, fontFamily: 'PlusJakartaSans_700Bold' },
  subtitle: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_400Regular',
    marginTop: 5,
  },
  state: { alignItems: 'center', paddingVertical: 48 },
  stateCard: {
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    padding: 24,
  },
  stateTitle: {
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    marginTop: 12,
    marginBottom: 16,
    textAlign: 'center',
  },
  stateDescription: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_400Regular',
    lineHeight: 19,
    marginBottom: 16,
    textAlign: 'center',
  },
  retryButton: { borderRadius: 8, paddingHorizontal: 16, paddingVertical: 10 },
  retryButtonText: {
    color: '#fff',
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_600SemiBold',
  },
  loginButton: {
    borderRadius: 8,
    borderWidth: 1,
    marginTop: 10,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  loginButtonText: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_600SemiBold',
  },
  section: { marginBottom: 24 },
  sectionHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
    marginBottom: 10,
  },
  sectionIcon: {
    alignItems: 'center',
    borderRadius: 9,
    height: 38,
    justifyContent: 'center',
    width: 38,
  },
  sectionHeading: { flex: 1 },
  sectionTitle: { fontSize: 15, fontFamily: 'PlusJakartaSans_600SemiBold' },
  sectionDescription: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_400Regular',
    marginTop: 2,
  },
  count: {
    alignItems: 'center',
    borderRadius: 12,
    minWidth: 24,
    paddingHorizontal: 7,
    paddingVertical: 4,
  },
  countText: { fontSize: 12, fontFamily: 'PlusJakartaSans_700Bold' },
  notificationCard: {
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 8,
    overflow: 'hidden',
  },
  cardMain: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
    minHeight: 64,
    padding: 12,
  },
  cardIcon: {
    alignItems: 'center',
    borderRadius: 20,
    height: 38,
    justifyContent: 'center',
    width: 38,
  },
  cardContent: { flex: 1, minWidth: 0 },
  cardTitle: {
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    marginBottom: 3,
  },
  cardSubtitle: { fontSize: 11, fontFamily: 'PlusJakartaSans_400Regular' },
  paymentAction: {
    alignItems: 'center',
    borderTopWidth: 1,
    flexDirection: 'row',
    gap: 7,
    minHeight: 44,
    paddingHorizontal: 12,
  },
  paymentActionText: {
    color: '#7c3aed',
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_700Bold',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 24,
    paddingBottom: 40,
  },
  modalTitle: {
    fontSize: 18,
    fontFamily: 'PlusJakartaSans_700Bold',
    marginBottom: 6,
  },
  modalSub: {
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_400Regular',
    marginBottom: 16,
  },
  modalInput: {
    height: 52,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 16,
    fontSize: 22,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    marginBottom: 12,
    textAlign: 'center',
  },
  dateModalInput: {
    height: 48,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 16,
    fontSize: 16,
    fontFamily: 'PlusJakartaSans_500Medium',
    marginBottom: 20,
    textAlign: 'center',
  },
  modalActions: { flexDirection: 'row', gap: 12 },
  modalCancelBtn: {
    flex: 1,
    height: 48,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalCancelText: { fontSize: 15, fontFamily: 'PlusJakartaSans_600SemiBold' },
  modalConfirmBtn: {
    flex: 1,
    height: 48,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalConfirmText: {
    fontSize: 15,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#ffffff',
  },
  emptyCard: {
    borderRadius: 10,
    borderWidth: 1,
    padding: 14,
  },
  emptyText: { fontSize: 12, fontFamily: 'PlusJakartaSans_400Regular' },
});