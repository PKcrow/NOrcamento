import { beforeEach, describe, expect, it, vi } from 'vitest';

const notificationMocks = vi.hoisted(() => {
  const storage = new Map<string, string>();
  const scheduled = new Map<
    string,
    {
      identifier: string;
      content: { data?: Record<string, unknown> };
    }
  >();

  return {
    storage,
    scheduled,
    cancelScheduledNotificationAsync: vi.fn(async (identifier: string) => {
      scheduled.delete(identifier);
    }),
    dismissNotificationAsync: vi.fn(async (identifier: string) => {
      scheduled.delete(identifier);
    }),
    scheduleNotificationAsync: vi.fn(
      async (request: {
        identifier?: string;
        content: { data?: Record<string, unknown> };
      }) => {
        const identifier =
          request.identifier ?? `generated:${scheduled.size + 1}`;
        scheduled.set(identifier, {
          identifier,
          content: request.content,
        });
        return identifier;
      },
    ),
  };
});

vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: vi.fn(async (key: string) => notificationMocks.storage.get(key) ?? null),
    setItem: vi.fn(async (key: string, value: string) => {
      notificationMocks.storage.set(key, value);
    }),
    removeItem: vi.fn(async (key: string) => {
      notificationMocks.storage.delete(key);
    }),
  },
}));

vi.mock('expo-constants', () => ({
  default: {
    expoConfig: null,
    easConfig: null,
  },
}));

vi.mock('expo-notifications', () => ({
  AndroidImportance: { HIGH: 4 },
  SchedulableTriggerInputTypes: { DATE: 'date' },
  getAllScheduledNotificationsAsync: vi.fn(async () =>
    [...notificationMocks.scheduled.values()].map((notification) => ({
      identifier: notification.identifier,
      content: notification.content,
    })),
  ),
  getPresentedNotificationsAsync: vi.fn(async () => []),
  cancelScheduledNotificationAsync:
    notificationMocks.cancelScheduledNotificationAsync,
  dismissNotificationAsync: notificationMocks.dismissNotificationAsync,
  scheduleNotificationAsync: notificationMocks.scheduleNotificationAsync,
  setNotificationChannelAsync: vi.fn(),
  getPermissionsAsync: vi.fn(),
  requestPermissionsAsync: vi.fn(),
  registerTaskAsync: vi.fn(),
  getExpoPushTokenAsync: vi.fn(),
  addNotificationResponseReceivedListener: vi.fn(),
}));

vi.mock('expo-task-manager', () => ({
  defineTask: vi.fn(),
}));

vi.mock('react-native', () => ({
  Platform: { OS: 'android' },
}));

import { syncLocalTaskNotifications } from './pushNotifications';

const OPEN_TASK_ID = 101;
const PAYMENT_TASK_ID = 202;
const OPEN_TASK_DUE_AT = '2030-09-21T12:00:00.000Z';

describe('local task notifications', () => {
  beforeEach(() => {
    notificationMocks.storage.clear();
    notificationMocks.scheduled.clear();
    notificationMocks.cancelScheduledNotificationAsync.mockClear();
    notificationMocks.dismissNotificationAsync.mockClear();
    notificationMocks.scheduleNotificationAsync.mockClear();
  });

  it('keeps an open task reminder when its payment-only task is paid', async () => {
    await syncLocalTaskNotifications([
      {
        id: OPEN_TASK_ID,
        title: 'O.S. ainda agendada',
        dueAt: OPEN_TASK_DUE_AT,
        status: 'scheduled',
      },
      {
        id: PAYMENT_TASK_ID,
        title: 'O.S. aguardando pagamento',
        dueAt: '1990-09-21T12:00:00.000Z',
        status: 'completed',
      },
    ]);

    const openReminderId =
      `gestao-autonomos:task:${OPEN_TASK_ID}:${OPEN_TASK_DUE_AT}:scheduled`;
    const paymentReminderId = `gestao-autonomos:payment:${PAYMENT_TASK_ID}`;
    expect(notificationMocks.scheduled.has(openReminderId)).toBe(true);
    expect(notificationMocks.scheduled.has(paymentReminderId)).toBe(true);

    await syncLocalTaskNotifications([
      {
        id: OPEN_TASK_ID,
        title: 'O.S. ainda agendada',
        dueAt: OPEN_TASK_DUE_AT,
        status: 'scheduled',
      },
      {
        id: PAYMENT_TASK_ID,
        title: 'O.S. aguardando pagamento',
        dueAt: '1990-09-21T12:00:00.000Z',
        status: 'paid',
      },
    ]);

    expect(notificationMocks.cancelScheduledNotificationAsync).toHaveBeenCalledWith(
      paymentReminderId,
    );
    expect(notificationMocks.cancelScheduledNotificationAsync).not.toHaveBeenCalledWith(
      openReminderId,
    );
    expect(notificationMocks.scheduled.has(openReminderId)).toBe(true);
    expect(notificationMocks.scheduled.has(paymentReminderId)).toBe(false);
  });
});