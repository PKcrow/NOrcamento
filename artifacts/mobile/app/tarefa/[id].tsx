import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Platform,
  TextInput,
  Modal,
  Linking,
} from 'react-native';
import { useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Share } from 'react-native';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import {
  useAddTaskPhoto,
  useCreateTaskFeedbackLink,
  useDeleteTask,
  useDeleteTaskPhoto,
  useListTasks,
  useRequestUploadUrl,
  useUpdateTask,
} from '@workspace/api-client-react';
import Colors from '@/constants/colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useQueryClient } from '@tanstack/react-query';
import { sharePdfDocument, taskPdfHtml } from '@/lib/nativePdf';
import {
  formatPaymentDate,
  formatPaymentDateInput,
  parsePaymentDate,
} from '@/lib/payment';

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

const fmtDate = (d: Date | string) =>
  new Date(d).toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric' });

function getStorageUrl(value: string | null | undefined): string | null {
  if (!value) return null;
  if (/^https?:\/\//i.test(value)) return value;
  const domain = process.env.EXPO_PUBLIC_DOMAIN;
  if (!domain) return null;
  const path = value.startsWith('/objects/')
    ? `/api/storage${value}`
    : value.startsWith('/') ? value : `/${value}`;
  return `https://${domain}${path}`;
}

export default function TarefaDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const taskId = Number(id);
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme ?? 'light'];
  const queryClient = useQueryClient();
  const navigation = useNavigation();
  const router = useRouter();

  const [showPayModal, setShowPayModal] = useState(false);
  const [payAmount, setPayAmount] = useState('');
  const [showEditPaymentModal, setShowEditPaymentModal] = useState(false);
  const [editPayAmount, setEditPayAmount] = useState('');
  const [editPayDate, setEditPayDate] = useState('');
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [selectedPhotoUrl, setSelectedPhotoUrl] = useState<string | null>(null);
  const [sharingPdf, setSharingPdf] = useState(false);

  const { data: tasks, isLoading } = useListTasks({});
  const task = tasks?.find(t => t.id === taskId);

  const { mutate: updateTask, isPending: isUpdating } = useUpdateTask();
  const { mutate: deleteTask, isPending: isDeleting } = useDeleteTask();
  const { mutate: createFeedbackLink, isPending: isCreatingFeedbackLink } = useCreateTaskFeedbackLink();
  const { mutateAsync: requestUploadUrl } = useRequestUploadUrl();
  const { mutateAsync: addTaskPhotoAsync } = useAddTaskPhoto();
  const { mutate: deleteTaskPhoto, isPending: isDeletingPhoto } = useDeleteTaskPhoto();

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
      { id: taskId, data: { status: newStatus } },
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
        data: { status: 'paid', paidAmount: amount, paidAt: new Date().toISOString() },
      },
      { onSuccess: () => { queryClient.invalidateQueries(); setShowPayModal(false); } }
    );
  };

  const handleEditPayment = () => {
    if (!task) return;
    setEditPayAmount(task.paidAmount != null ? String(task.paidAmount).replace('.', ',') : '');
    setEditPayDate(formatPaymentDate(task.paidAt));
    setShowEditPaymentModal(true);
  };

  const handleSavePayment = () => {
    const amount = parseFloat(editPayAmount.replace(',', '.'));
    const date = parsePaymentDate(editPayDate);
    if (!Number.isFinite(amount) || amount <= 0) {
      Alert.alert('Valor inválido', 'Informe o valor recebido.');
      return;
    }
    if (!date || !/^\d{2}\/\d{2}\/\d{4}$/.test(editPayDate)) {
      Alert.alert('Data inválida', 'Informe a data no formato DD/MM/AAAA.');
      return;
    }
    updateTask(
      { id: taskId, data: { paidAmount: amount, paidAt: date.toISOString(), status: 'paid' } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries();
          setShowEditPaymentModal(false);
        },
        onError: () => Alert.alert('Erro', 'Não foi possível atualizar o pagamento.'),
      },
    );
  };

  const handleUndoPayment = () => {
    Alert.alert(
      'Desfazer pagamento',
      'A O.S. voltará para concluída e o registro do pagamento será removido.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Desfazer',
          style: 'destructive',
          onPress: () => updateTask(
            { id: taskId, data: { status: 'completed', paidAmount: null, paidAt: null } },
            {
              onSuccess: () => queryClient.invalidateQueries(),
              onError: () => Alert.alert('Erro', 'Não foi possível desfazer o pagamento.'),
            },
          ),
        },
      ],
    );
  };

  const handleAddPhoto = async () => {
    if (isUploadingPhoto || isDeletingPhoto) return;
    if (Platform.OS !== 'web') {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        const settingsAction = !permission.canAskAgain
          ? [{ text: 'Abrir ajustes', onPress: () => void Linking.openSettings() }]
          : [];
        Alert.alert(
          'Permissão necessária',
          'Permita o acesso às fotos para anexar uma imagem à O.S.',
          [{ text: 'Cancelar', style: 'cancel' }, ...settingsAction],
        );
        return;
      }
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: false,
      quality: 0.8,
    });
    if (result.canceled || !result.assets?.[0]) return;

    const asset = result.assets[0];
    if (asset.fileSize && asset.fileSize > 5 * 1024 * 1024) {
      Alert.alert('Arquivo muito grande', 'Escolha uma imagem de até 5 MB.');
      return;
    }

    const contentType = asset.mimeType ?? 'image/jpeg';
    setIsUploadingPhoto(true);
    try {
      const upload = await requestUploadUrl({
        data: {
          name: asset.fileName ?? `os-${taskId}-${Date.now()}.jpg`,
          size: asset.fileSize ?? 1,
          contentType,
        },
      });
      const uploaded = await FileSystem.uploadAsync(upload.uploadURL, asset.uri, {
        httpMethod: 'PUT',
        uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
        headers: { 'Content-Type': contentType },
      });
      if (uploaded.status < 200 || uploaded.status >= 300) throw new Error('Photo upload failed');

      const photoUrl = getStorageUrl(upload.objectPath);
      if (!photoUrl) throw new Error('Storage domain is not configured');
      await addTaskPhotoAsync({ id: taskId, data: { url: photoUrl } });
      queryClient.invalidateQueries();
    } catch {
      Alert.alert('Erro', 'Não foi possível anexar a foto. Tente novamente.');
    } finally {
      setIsUploadingPhoto(false);
    }
  };

  const handleDeletePhoto = (photoId: number) => {
    Alert.alert('Excluir foto', 'Deseja remover esta foto da O.S.?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Excluir',
        style: 'destructive',
        onPress: () => deleteTaskPhoto(
          { id: taskId, photoId },
          {
            onSuccess: () => queryClient.invalidateQueries(),
            onError: () => Alert.alert('Erro', 'Não foi possível excluir a foto.'),
          },
        ),
      },
    ]);
  };

  const handleChangeStatus = (newStatus: TaskStatus) => {
    setShowStatusModal(false);
    if (newStatus === task?.status) return;
    if (newStatus === 'paid') {
      setPayAmount('');
      setShowPayModal(true);
      return;
    }
    updateTask(
      { id: taskId, data: { status: newStatus } },
      {
        onSuccess: () => queryClient.invalidateQueries(),
        onError: () => Alert.alert('Erro', 'Não foi possível alterar o status da O.S.'),
      },
    );
  };

  const handleDelete = () => {
    const confirmDelete = () => {
      deleteTask(
        { id: taskId },
        {
          onSuccess: () => {
            queryClient.invalidateQueries();
            router.replace('/(tabs)/tarefas');
          },
          onError: () => Alert.alert('Erro', 'Não foi possível excluir a O.S.'),
        },
      );
    };

    const message = 'Tem certeza que deseja excluir esta ordem de serviço? Essa ação não pode ser desfeita.';
    if (Platform.OS === 'web') {
      if (window.confirm(`Excluir O.S.\n\n${message}`)) {
        confirmDelete();
      }
      return;
    }

    Alert.alert(
      'Excluir O.S.',
      message,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Excluir',
          style: 'destructive',
          onPress: confirmDelete,
        },
      ],
    );
  };

  const handleFeedbackLink = () => {
    createFeedbackLink(
      { id: taskId },
      {
        onSuccess: async (data) => {
          const webDomain = process.env.EXPO_PUBLIC_WEB_DOMAIN ?? process.env.EXPO_PUBLIC_DOMAIN;
          if (!webDomain) {
            Alert.alert('Erro', 'O domínio público do web não está configurado.');
            return;
          }
          const link = `https://${webDomain}/feedback/${data.feedbackToken}`;
          try {
            await Share.share({
              message: `Olá! Quando puder, avalie o serviço realizado:\n${link}`,
              url: link,
              title: `Avaliação — ${task?.title ?? 'serviço'}`,
            });
          } catch {}
          queryClient.invalidateQueries();
        },
        onError: () => Alert.alert('Erro', 'Só é possível pedir feedback após concluir a O.S.'),
      },
    );
  };

  const handleSharePdf = async () => {
    if (!task || sharingPdf) return;
    setSharingPdf(true);
    try {
      await sharePdfDocument(`Ordem de serviço #${task.id}`, taskPdfHtml(task));
    } catch {
      Alert.alert('Erro', 'Não foi possível gerar ou compartilhar o PDF da O.S.');
    } finally {
      setSharingPdf(false);
    }
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

      {/* Photos */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: theme.mutedForeground }]}>FOTOS DO SERVIÇO</Text>
          <TouchableOpacity
            style={[styles.addPhotoButton, { borderColor: theme.primary }]}
            onPress={handleAddPhoto}
            disabled={isUploadingPhoto || isDeletingPhoto}
          >
            {isUploadingPhoto ? (
              <ActivityIndicator size="small" color={theme.primary} />
            ) : (
              <Ionicons name="camera-outline" size={16} color={theme.primary} />
            )}
            <Text style={[styles.addPhotoText, { color: theme.primary }]}>
              {isUploadingPhoto ? 'Enviando...' : 'Adicionar'}
            </Text>
          </TouchableOpacity>
        </View>
        {task.photos?.length ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.photoList}>
            {task.photos.map((photo, index) => {
              const photoUrl = getStorageUrl(photo.url);
              if (!photoUrl) return null;
              return (
                <View key={photo.id} style={styles.photoItem}>
                  <TouchableOpacity onPress={() => setSelectedPhotoUrl(photoUrl)} accessibilityLabel={`Abrir foto ${index + 1}`}>
                    <Image source={photoUrl} style={styles.photoThumbnail} contentFit="cover" />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.removePhotoButton}
                    onPress={() => handleDeletePhoto(photo.id)}
                    disabled={isDeletingPhoto}
                    accessibilityLabel={`Excluir foto ${index + 1}`}
                  >
                    <Ionicons name="close" size={13} color="#ffffff" />
                  </TouchableOpacity>
                </View>
              );
            })}
          </ScrollView>
        ) : (
          <View style={[styles.emptyPhotos, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <Ionicons name="images-outline" size={20} color={theme.mutedForeground} />
            <Text style={[styles.emptyPhotosText, { color: theme.mutedForeground }]}>
              Nenhuma foto anexada
            </Text>
          </View>
        )}
      </View>

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
          style={[styles.statusButton, { borderColor: theme.border, backgroundColor: theme.card }]}
          onPress={() => setShowStatusModal(true)}
          disabled={isUpdating || isDeleting}
        >
          <Ionicons name="swap-horizontal-outline" size={20} color={theme.primary} />
          <Text style={[styles.statusButtonText, { color: theme.primary }]}>Alterar status</Text>
        </TouchableOpacity>
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
          <>
            <View style={[styles.paidBadge, { backgroundColor: '#f3e8ff' }]}>
              <Ionicons name="checkmark-circle" size={20} color="#8b5cf6" />
              <Text style={{ color: '#7c3aed', fontFamily: 'PlusJakartaSans_600SemiBold' }}>
                Ordem de serviço paga
              </Text>
            </View>
            <TouchableOpacity
              style={[styles.secondaryBtn, { borderColor: '#8b5cf6' }]}
              onPress={handleEditPayment}
              disabled={isUpdating}
            >
              <Ionicons name="create-outline" size={19} color="#8b5cf6" />
              <Text style={[styles.secondaryBtnText, { color: '#8b5cf6' }]}>Editar pagamento</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.secondaryBtn, { borderColor: theme.border }]}
              onPress={handleUndoPayment}
              disabled={isUpdating}
            >
              <Ionicons name="arrow-undo-outline" size={19} color={theme.mutedForeground} />
              <Text style={[styles.secondaryBtnText, { color: theme.mutedForeground }]}>Desfazer pagamento</Text>
            </TouchableOpacity>
          </>
        )}
        {(st === 'completed' || st === 'paid') && (
          task.feedbackSubmittedAt && task.feedbackRating != null ? (
            <View
              style={[styles.ratingCard, { backgroundColor: theme.card, borderColor: theme.border }]}
              accessibilityLabel={`Avaliação recebida: ${task.feedbackRating} de 5 estrelas`}
            >
              <Ionicons name="star" size={20} color="#f59e0b" />
              <View style={styles.ratingStars}>
                {Array.from({ length: 5 }, (_, index) => (
                  <Ionicons
                    key={index}
                    name={index < task.feedbackRating! ? 'star' : 'star-outline'}
                    size={18}
                    color={index < task.feedbackRating! ? '#f59e0b' : theme.border}
                  />
                ))}
              </View>
              <Text style={[styles.ratingText, { color: theme.foreground }]}>
                {task.feedbackRating}/5
              </Text>
            </View>
          ) : (
            <TouchableOpacity
              style={[styles.secondaryBtn, { borderColor: theme.primary }]}
              onPress={handleFeedbackLink}
              disabled={isCreatingFeedbackLink}
            >
              {isCreatingFeedbackLink ? (
                <ActivityIndicator color={theme.primary} />
              ) : (
                <Ionicons name="star-outline" size={20} color={theme.primary} />
              )}
              <Text style={[styles.secondaryBtnText, { color: theme.primary }]}>
                Pedir avaliação do cliente
              </Text>
            </TouchableOpacity>
          )
        )}
      </View>

      <TouchableOpacity
        style={[styles.deleteButton, { borderColor: '#fecaca' }]}
        onPress={handleDelete}
        disabled={isUpdating || isDeleting}
      >
        {isDeleting ? (
          <ActivityIndicator color="#dc2626" />
        ) : (
          <>
            <Ionicons name="trash-outline" size={19} color="#dc2626" />
            <Text style={styles.deleteButtonText}>Excluir O.S.</Text>
          </>
        )}
      </TouchableOpacity>

      <Modal
        visible={showStatusModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowStatusModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalSheet, { backgroundColor: theme.card }]}>
            <View style={styles.statusModalHeader}>
              <Text style={[styles.modalTitle, { color: theme.foreground }]}>Alterar status</Text>
              <TouchableOpacity onPress={() => setShowStatusModal(false)} accessibilityLabel="Fechar">
                <Ionicons name="close" size={24} color={theme.mutedForeground} />
              </TouchableOpacity>
            </View>
            {(['scheduled', 'in_progress', 'completed', 'paid'] as TaskStatus[]).map(statusOption => (
              <TouchableOpacity
                key={statusOption}
                style={[
                  styles.statusOption,
                  { borderColor: theme.border },
                  statusOption === st && { backgroundColor: STATUS_COLORS[statusOption] + '18' },
                ]}
                onPress={() => handleChangeStatus(statusOption)}
                disabled={isUpdating}
              >
                <View style={[styles.statusDot, { backgroundColor: STATUS_COLORS[statusOption] }]} />
                <Text style={[styles.statusOptionText, { color: theme.foreground }]}>
                  {STATUS_LABELS[statusOption]}
                </Text>
                {statusOption === st && (
                  <Ionicons name="checkmark" size={20} color={STATUS_COLORS[statusOption]} />
                )}
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </Modal>

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

      {/* Edit payment modal */}
      <Modal
        visible={showEditPaymentModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowEditPaymentModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalSheet, { backgroundColor: theme.card }]}>
            <Text style={[styles.modalTitle, { color: theme.foreground }]}>Editar pagamento</Text>
            <Text style={[styles.modalSub, { color: theme.mutedForeground }]}>
              Atualize o valor recebido e a data do pagamento.
            </Text>
            <TextInput
              style={[styles.modalInput, { borderColor: theme.border, color: theme.foreground, backgroundColor: theme.background }]}
              placeholder="Valor recebido"
              placeholderTextColor={theme.mutedForeground}
              value={editPayAmount}
              onChangeText={setEditPayAmount}
              keyboardType="decimal-pad"
            />
            <TextInput
              style={[styles.dateModalInput, { borderColor: theme.border, color: theme.foreground, backgroundColor: theme.background }]}
              placeholder="DD/MM/AAAA"
              placeholderTextColor={theme.mutedForeground}
              value={editPayDate}
              onChangeText={value => setEditPayDate(formatPaymentDateInput(value))}
              keyboardType="number-pad"
              maxLength={10}
            />
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalCancelBtn, { borderColor: theme.border }]}
                onPress={() => setShowEditPaymentModal(false)}
              >
                <Text style={[styles.modalCancelText, { color: theme.foreground }]}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalConfirmBtn, { backgroundColor: '#8b5cf6' }]}
                onPress={handleSavePayment}
                disabled={isUpdating}
              >
                {isUpdating ? (
                  <ActivityIndicator color="#ffffff" size="small" />
                ) : (
                  <Text style={styles.modalConfirmText}>Salvar</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Fullscreen photo preview */}
      <Modal
        visible={!!selectedPhotoUrl}
        transparent
        animationType="fade"
        onRequestClose={() => setSelectedPhotoUrl(null)}
      >
        <View style={styles.photoPreviewOverlay}>
          <TouchableOpacity
            style={styles.photoPreviewClose}
            onPress={() => setSelectedPhotoUrl(null)}
            accessibilityLabel="Fechar foto"
          >
            <Ionicons name="close" size={28} color="#ffffff" />
          </TouchableOpacity>
          {selectedPhotoUrl && (
            <Image source={selectedPhotoUrl} style={styles.photoPreview} contentFit="contain" />
          )}
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
  section: { marginBottom: 16 },
  sectionTitle: { fontSize: 11, fontFamily: 'PlusJakartaSans_600SemiBold', letterSpacing: 0.8, marginBottom: 8 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  notesCard: { borderRadius: 10, borderWidth: 1, padding: 14 },
  notesText: { fontSize: 14, fontFamily: 'PlusJakartaSans_400Regular', lineHeight: 22 },
  addPhotoButton: { flexDirection: 'row', alignItems: 'center', gap: 5, borderWidth: 1, borderRadius: 8, paddingHorizontal: 9, paddingVertical: 5 },
  addPhotoText: { fontSize: 12, fontFamily: 'PlusJakartaSans_600SemiBold' },
  photoList: { gap: 10, paddingVertical: 2 },
  photoItem: { position: 'relative' },
  photoThumbnail: { width: 92, height: 92, borderRadius: 10, backgroundColor: '#e5e7eb' },
  removePhotoButton: { position: 'absolute', top: 4, right: 4, width: 22, height: 22, borderRadius: 11, backgroundColor: 'rgba(0,0,0,0.65)', alignItems: 'center', justifyContent: 'center' },
  emptyPhotos: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderWidth: 1, borderRadius: 10, padding: 14 },
  emptyPhotosText: { fontSize: 13, fontFamily: 'PlusJakartaSans_400Regular' },
  actions: { gap: 10 },
  statusButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 46, borderRadius: 10, borderWidth: 1 },
  statusButtonText: { fontSize: 14, fontFamily: 'PlusJakartaSans_600SemiBold' },
  primaryBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 50, borderRadius: 10 },
  primaryBtnText: { fontSize: 16, fontFamily: 'PlusJakartaSans_600SemiBold', color: '#ffffff' },
  secondaryBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 46, borderRadius: 10, borderWidth: 1.5 },
  secondaryBtnText: { fontSize: 14, fontFamily: 'PlusJakartaSans_600SemiBold' },
  ratingCard: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 46, borderRadius: 10, borderWidth: 1 },
  ratingStars: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  ratingText: { fontSize: 14, fontFamily: 'PlusJakartaSans_700Bold' },
  paidBadge: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 46, borderRadius: 10 },
  deleteButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 46, borderRadius: 10, borderWidth: 1, marginTop: 18 },
  deleteButtonText: { color: '#dc2626', fontSize: 14, fontFamily: 'PlusJakartaSans_600SemiBold' },
  statusModalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  statusOption: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 50, borderWidth: 1, borderRadius: 10, paddingHorizontal: 14, marginBottom: 8 },
  statusDot: { width: 10, height: 10, borderRadius: 5 },
  statusOptionText: { flex: 1, fontSize: 15, fontFamily: 'PlusJakartaSans_600SemiBold' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  modalSheet: { borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24, paddingBottom: 40 },
  modalTitle: { fontSize: 18, fontFamily: 'PlusJakartaSans_700Bold', marginBottom: 6 },
  modalSub: { fontSize: 14, fontFamily: 'PlusJakartaSans_400Regular', marginBottom: 16 },
  modalInput: { height: 52, borderWidth: 1, borderRadius: 10, paddingHorizontal: 16, fontSize: 22, fontFamily: 'PlusJakartaSans_600SemiBold', marginBottom: 20, textAlign: 'center' },
  dateModalInput: { height: 48, borderWidth: 1, borderRadius: 10, paddingHorizontal: 16, fontSize: 16, fontFamily: 'PlusJakartaSans_500Medium', marginBottom: 20, textAlign: 'center' },
  modalActions: { flexDirection: 'row', gap: 12 },
  modalCancelBtn: { flex: 1, height: 48, borderRadius: 10, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  modalCancelText: { fontSize: 15, fontFamily: 'PlusJakartaSans_600SemiBold' },
  modalConfirmBtn: { flex: 1, height: 48, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  modalConfirmText: { fontSize: 15, fontFamily: 'PlusJakartaSans_600SemiBold', color: '#ffffff' },
  photoPreviewOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.92)', alignItems: 'center', justifyContent: 'center' },
  photoPreview: { width: '100%', height: '78%' },
  photoPreviewClose: { position: 'absolute', top: 52, right: 20, zIndex: 1, width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.15)' },
});
