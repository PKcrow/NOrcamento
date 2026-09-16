import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

const PUSH_TOKEN_STORAGE_KEY = 'gestao-autonomos:expo-push-token';
const SCHEDULED_TASKS_STORAGE_KEY = 'gestao-autonomos:scheduled-task-notifications';

type TaskNotificationItem = {
  id: number;
  title: string;
  dueAt: string;
  status: string;
};

type ScheduledTaskNotifications = Record<string, string>;

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
export async function syncLocalTaskNotifications(tasks: TaskNotificationItem[]) {
  if (Platform.OS === 'web') return;

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
    if (task.status !== 'scheduled' && task.status !== 'in_progress') continue;

    const dueAt = new Date(task.dueAt).getTime();
    if (!Number.isFinite(dueAt)) continue;

    const key = `${task.id}:${task.dueAt}:${task.status}`;
    activeKeys.add(key);
    if (scheduled[key]) continue;

    const notificationId = await Notifications.scheduleNotificationAsync({
      content: {
        title: dueAt < now ? 'O.S. atrasada' : 'O.S. próxima',
        body:
          dueAt < now
            ? `${task.title} está atrasada.`
            : `${task.title} está agendada para ${new Date(dueAt).toLocaleString('pt-BR')}.`,
        sound: 'default',
        data: { taskId: String(task.id) },
        ...(Platform.OS === 'android' ? { channelId: 'task-reminders' } : {}),
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: Math.max(now + 1_000, dueAt - 48 * 60 * 60 * 1_000),
      },
    });
    scheduled[key] = notificationId;
  }

  for (const [key, notificationId] of Object.entries(scheduled)) {
    if (activeKeys.has(key)) continue;
    await Notifications.cancelScheduledNotificationAsync(notificationId);
    delete scheduled[key];
  }

  await AsyncStorage.setItem(
    SCHEDULED_TASKS_STORAGE_KEY,
    JSON.stringify(scheduled),
  );
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
      Object.values(scheduled).map((notificationId) =>
        Notifications.cancelScheduledNotificationAsync(notificationId),
      ),
    );
  }
  await AsyncStorage.removeItem(SCHEDULED_TASKS_STORAGE_KEY);
}
