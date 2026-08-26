import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

const PUSH_TOKEN_STORAGE_KEY = 'gestao-autonomos:expo-push-token';

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