import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import * as TaskManager from 'expo-task-manager';
import { Platform } from 'react-native';

const PUSH_TOKEN_STORAGE_KEY = 'gestao-autonomos:expo-push-token';
const SCHEDULED_TASKS_STORAGE_KEY = 'gestao-autonomos:scheduled-task-notifications';
const PENDING_PAYMENT_CLEANUPS_STORAGE_KEY =
  'gestao-autonomos:pending-payment-cleanups';
const BACKGROUND_NOTIFICATION_TASK = 'gestao-autonomos-payment-notifications';
const PAYMENT_NOTIFICATION_PREFIX = 'gestao-autonomos:payment:';

type TaskNotificationItem = {
  id: number;
  title: string;
  dueAt: string;
  status: string;
};

type ScheduledTaskNotifications = Record<string, string>;
type PendingPaymentCleanups = Record<string, true>;
let localTaskSyncInFlight: Promise<void> | null = null;

export function getPaymentNotificationIdentifier(taskId: number) {
  return `${PAYMENT_NOTIFICATION_PREFIX}${taskId}`;
}

function getTaskIdFromNotification(
  notification: Notifications.Notification,
): string | null {
  const taskId = notification.request.content.data?.taskId;
  return typeof taskId === 'string' ? taskId : null;
}

async function readPendingPaymentCleanups(): Promise<PendingPaymentCleanups> {
  const storedValue = await AsyncStorage.getItem(
    PENDING_PAYMENT_CLEANUPS_STORAGE_KEY,
  );
  if (!storedValue) return {};
  try {
    const parsed = JSON.parse(storedValue) as Record<string, unknown>;
    return Object.fromEntries(
      Object.entries(parsed).filter(([, value]) => value === true),
    ) as PendingPaymentCleanups;
  } catch {
    return {};
  }
}

async function rememberPendingPaymentCleanup(taskId: string) {
  const pending = await readPendingPaymentCleanups();
  pending[taskId] = true;
  await AsyncStorage.setItem(
    PENDING_PAYMENT_CLEANUPS_STORAGE_KEY,
    JSON.stringify(pending),
  );
}

async function forgetPendingPaymentCleanup(taskId: string) {
  const pending = await readPendingPaymentCleanups();
  if (!pending[taskId]) return;
  delete pending[taskId];
  await AsyncStorage.setItem(
    PENDING_PAYMENT_CLEANUPS_STORAGE_KEY,
    JSON.stringify(pending),
  );
}

async function dismissPendingPaymentNotifications(taskId: string) {
  const pendingNotificationId = getPaymentNotificationIdentifier(Number(taskId));
  try {
    const findMatches = async () => {
      const [scheduled, presented] = await Promise.all([
        Notifications.getAllScheduledNotificationsAsync(),
        Notifications.getPresentedNotificationsAsync(),
      ]);
      const scheduledMatches = scheduled.filter((notification) => {
        const notificationTaskId = notification.content.data?.taskId;
        return (
          notification.identifier === pendingNotificationId ||
          (notificationTaskId === taskId &&
            notification.content.data?.notificationType === 'payment_pending')
        );
      });
      const presentedMatches = presented.filter((notification) => {
        const notificationTaskId = getTaskIdFromNotification(notification);
        return (
          notificationTaskId === taskId &&
          notification.request.content.data?.notificationType === 'payment_pending'
        );
      });
      return { scheduledMatches, presentedMatches };
    };

    const matches = await findMatches();
    const results = await Promise.allSettled([
      ...matches.scheduledMatches.map((notification) =>
        Notifications.cancelScheduledNotificationAsync(notification.identifier),
      ),
      ...matches.presentedMatches.map((notification) =>
        Notifications.dismissNotificationAsync(notification.request.identifier),
      ),
    ]);
    const operationsSucceeded = results.every(
      (result) => result.status === 'fulfilled',
    );
    if (!operationsSucceeded) {
      await rememberPendingPaymentCleanup(taskId);
      return;
    }

    const remaining = await findMatches();
    if (remaining.scheduledMatches.length > 0 || remaining.presentedMatches.length > 0) {
      await rememberPendingPaymentCleanup(taskId);
      return;
    }

    const storedValue = await AsyncStorage.getItem(SCHEDULED_TASKS_STORAGE_KEY);
    if (storedValue) {
      let scheduledByKey: ScheduledTaskNotifications | null = null;
      try {
        scheduledByKey = JSON.parse(storedValue) as ScheduledTaskNotifications;
      } catch {
        scheduledByKey = null;
      }
      if (scheduledByKey) {
        let changed = false;
        for (const [key, notificationId] of Object.entries(scheduledByKey)) {
          if (
            notificationId === pendingNotificationId ||
            key === `${taskId}:payment_pending`
          ) {
            delete scheduledByKey[key];
            changed = true;
          }
        }
        if (changed) {
          await AsyncStorage.setItem(
            SCHEDULED_TASKS_STORAGE_KEY,
            JSON.stringify(scheduledByKey),
          );
        }
      }
    }
    await forgetPendingPaymentCleanup(taskId);
  } catch {
    await rememberPendingPaymentCleanup(taskId).catch(() => undefined);
  }
}

TaskManager.defineTask<Notifications.NotificationTaskPayload>(
  BACKGROUND_NOTIFICATION_TASK,
  async ({ data, error }) => {
    if (error || !data || 'actionIdentifier' in data) return;

    let payload: Record<string, unknown> = data.data;
    const dataString = data.data?.dataString;
    if (typeof dataString === 'string') {
      try {
        payload = JSON.parse(dataString) as Record<string, unknown>;
      } catch {
        return;
      }
    }

    if (
      payload.notificationType !== 'payment_recorded' ||
      typeof payload.taskId !== 'string' ||
      !/^\d+$/.test(payload.taskId)
    ) {
      return;
    }

    await dismissPendingPaymentNotifications(payload.taskId);
  },
);

export type NativePushRegistration = {
  token: string;
  platform: 'android' | 'ios';
};

export async function requestNativePushRegistration(): Promise<NativePushRegistration | null> {
  if (Platform.OS === 'web') return null;

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('quote-responses', {
      name: 'Respostas de orçamentos',
      description: 'Avisos quando um cliente aprovar ou recusar um orçamento.',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#f97316',
      sound: 'default',
    });
    await Notifications.setNotificationChannelAsync('task-reminders', {
      name: 'Lembretes de O.S.',
      description: 'Avisos de ordens de serviço próximas ou atrasadas.',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#f97316',
      sound: 'default',
    });
  }

  const currentPermission = await Notifications.getPermissionsAsync();
  const permission =
    currentPermission.status === 'granted'
      ? currentPermission
      : await Notifications.requestPermissionsAsync();
  if (permission.status !== 'granted') return null;

  try {
    await Notifications.registerTaskAsync(BACKGROUND_NOTIFICATION_TASK);
  } catch {
    // The task is persisted by the native module. Re-registering an existing
    // task is harmless, and unsupported platforms should still get push alerts.
  }

  const projectId =
    Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
  if (!projectId) return null;

  try {
    const response = await Notifications.getExpoPushTokenAsync({ projectId });
    return {
      token: response.data,
      platform: Platform.OS === 'ios' ? 'ios' : 'android',
    };
  } catch {
    return null;
  }
}

export async function saveNativePushToken(token: string) {
  await AsyncStorage.setItem(PUSH_TOKEN_STORAGE_KEY, token);
}

export async function getSavedNativePushToken() {
  return AsyncStorage.getItem(PUSH_TOKEN_STORAGE_KEY);
}

export async function clearSavedNativePushToken() {
  await AsyncStorage.removeItem(PUSH_TOKEN_STORAGE_KEY);
}

/**
 * Schedules task reminders in the phone's notification center. The operating
 * system can display these alerts while the app is closed, so the mobile app
 * does not need an internal notification list.
 */
async function syncLocalTaskNotificationsNow(tasks: TaskNotificationItem[]) {
  const storedValue = await AsyncStorage.getItem(SCHEDULED_TASKS_STORAGE_KEY);
  let scheduled: ScheduledTaskNotifications = {};
  if (storedValue) {
    try {
      scheduled = JSON.parse(storedValue) as ScheduledTaskNotifications;
    } catch {
      scheduled = {};
    }
  }
  const activeKeys = new Set<string>();
  const now = Date.now();

  for (const task of tasks) {
    const isPaymentPending = task.status === 'completed';
    const isScheduledTask =
      task.status === 'scheduled' || task.status === 'in_progress';
    if (!isPaymentPending && !isScheduledTask) continue;

    const dueAt = new Date(task.dueAt).getTime();
    if (isScheduledTask && !Number.isFinite(dueAt)) continue;

    const key = isPaymentPending
      ? `${task.id}:payment_pending`
      : `${task.id}:${task.dueAt}:${task.status}`;
    activeKeys.add(key);
    const stableIdentifier = isPaymentPending
      ? getPaymentNotificationIdentifier(task.id)
      : `gestao-autonomos:task:${task.id}:${task.dueAt}:${task.status}`;
    if (scheduled[key] === stableIdentifier) continue;

    if (scheduled[key]) {
      await Promise.allSettled([
        Notifications.cancelScheduledNotificationAsync(scheduled[key]),
        Notifications.dismissNotificationAsync(scheduled[key]),
      ]);
    }

    const notificationId = await Notifications.scheduleNotificationAsync({
      identifier: stableIdentifier,
      content: {
        title: isPaymentPending
          ? 'Pagamento pendente'
          : dueAt < now
            ? 'O.S. atrasada'
            : 'O.S. próxima',
        body: isPaymentPending
          ? `${task.title} foi concluída e aguarda pagamento.`
          : dueAt < now
            ? `${task.title} está atrasada.`
            : `${task.title} está agendada para ${new Date(dueAt).toLocaleString('pt-BR')}.`,
        sound: 'default',
        data: {
          taskId: String(task.id),
          notificationType: isPaymentPending
            ? 'payment_pending'
            : 'task_reminder',
        },
        ...(isPaymentPending
          ? { sticky: true, autoDismiss: false }
          : {}),
        ...(Platform.OS === 'android' ? { channelId: 'task-reminders' } : {}),
      },
      trigger: isPaymentPending
        ? null
        : {
            type: Notifications.SchedulableTriggerInputTypes.DATE,
            date: Math.max(now + 1_000, dueAt - 48 * 60 * 60 * 1_000),
          },
    });
    scheduled[key] = notificationId;
  }

  for (const [key, notificationId] of Object.entries(scheduled)) {
    if (activeKeys.has(key)) continue;
    await Promise.allSettled([
      Notifications.cancelScheduledNotificationAsync(notificationId),
      Notifications.dismissNotificationAsync(notificationId),
    ]);
    delete scheduled[key];
  }

  await AsyncStorage.setItem(
    SCHEDULED_TASKS_STORAGE_KEY,
    JSON.stringify(scheduled),
  );

  const pendingCleanups = await readPendingPaymentCleanups();
  const paidTaskIds = new Set(
    tasks
      .filter((task) => task.status === 'paid')
      .map((task) => String(task.id)),
  );
  await Promise.all(
    Object.keys(pendingCleanups)
      .filter((taskId) => paidTaskIds.has(taskId))
      .map((taskId) => dismissPendingPaymentNotifications(taskId)),
  );
}

export async function syncLocalTaskNotifications(tasks: TaskNotificationItem[]) {
  if (Platform.OS === 'web') return;
  if (localTaskSyncInFlight) return localTaskSyncInFlight;

  localTaskSyncInFlight = syncLocalTaskNotificationsNow(tasks).finally(() => {
    localTaskSyncInFlight = null;
  });
  return localTaskSyncInFlight;
}

export async function clearLocalTaskNotifications() {
  if (Platform.OS !== 'web') {
    const storedValue = await AsyncStorage.getItem(SCHEDULED_TASKS_STORAGE_KEY);
    let scheduled: ScheduledTaskNotifications = {};
    if (storedValue) {
      try {
        scheduled = JSON.parse(storedValue) as ScheduledTaskNotifications;
      } catch {
        scheduled = {};
      }
    }
    await Promise.all(
      Object.values(scheduled).map(async (notificationId) => {
        await Promise.allSettled([
          Notifications.cancelScheduledNotificationAsync(notificationId),
          Notifications.dismissNotificationAsync(notificationId),
        ]);
      }),
    );
  }
  await AsyncStorage.removeItem(SCHEDULED_TASKS_STORAGE_KEY);
  await AsyncStorage.removeItem(PENDING_PAYMENT_CLEANUPS_STORAGE_KEY);
}
