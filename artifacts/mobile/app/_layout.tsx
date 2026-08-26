import React, { useEffect } from 'react';
import { ClerkProvider, useAuth } from '@clerk/clerk-expo';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import {
  PlusJakartaSans_400Regular,
  PlusJakartaSans_500Medium,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
  useFonts,
} from '@expo-google-fonts/plus-jakarta-sans';
import { Stack, useRouter } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import {
  setBaseUrl,
  setAuthTokenGetter,
  getGetMeQueryKey,
  useGetMe,
  useRegisterPushToken,
} from '@workspace/api-client-react';
import {
  requestNativePushRegistration,
  saveNativePushToken,
} from '@/lib/pushNotifications';

// Token cache for Clerk — persists sessions across app restarts
const tokenCache = {
  async getToken(key: string) {
    try {
      return await AsyncStorage.getItem(key);
    } catch {
      return null;
    }
  },
  async saveToken(key: string, value: string) {
    try {
      await AsyncStorage.setItem(key, value);
    } catch {}
  },
  async clearToken(key: string) {
    try {
      await AsyncStorage.removeItem(key);
    } catch {}
  },
};

// Point API client at the shared dev/prod domain
if (process.env.EXPO_PUBLIC_DOMAIN) {
  setBaseUrl(`https://${process.env.EXPO_PUBLIC_DOMAIN}`);
}

SplashScreen.preventAutoHideAsync();

if (Platform.OS !== 'web') {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, staleTime: 30_000 },
  },
});

function RootLayoutNav() {
  const { isLoaded, isSignedIn, getToken } = useAuth();
  const router = useRouter();
  const { data: me } = useGetMe({
    query: {
      queryKey: getGetMeQueryKey(),
      enabled: isLoaded && Boolean(isSignedIn),
    },
  });
  const { mutateAsync: registerPushToken } = useRegisterPushToken();

  useEffect(() => {
    setAuthTokenGetter(async () => {
      return await getToken();
    });
  }, [getToken]);

  useEffect(() => {
    if (Platform.OS === 'web') return;

    const openQuote = (response: Notifications.NotificationResponse | null) => {
      const quoteId = response?.notification.request.content.data?.quoteId;
      if (typeof quoteId !== 'string' || !/^\d+$/.test(quoteId)) return;
      router.push({ pathname: '/orcamento/[id]', params: { id: quoteId } });
    };

    void Notifications.getLastNotificationResponseAsync().then(openQuote);
    const subscription = Notifications.addNotificationResponseReceivedListener(openQuote);
    return () => subscription.remove();
  }, [router]);

  useEffect(() => {
    if (!isLoaded || !isSignedIn || !me?.teamId) return;

    let active = true;
    const syncPushRegistration = async () => {
      const registration = await requestNativePushRegistration();
      if (!registration || !active) return;

      try {
        await registerPushToken({ data: registration });
        if (active) await saveNativePushToken(registration.token);
      } catch {
        // Network failures should not block sign-in or the rest of the app.
      }
    };

    void syncPushRegistration();
    // The native token can rotate while the app is installed. Re-register the
    // Expo token instead of waiting for the person to sign out and back in.
    const tokenSubscription = Notifications.addPushTokenListener(() => {
      void syncPushRegistration();
    });

    return () => {
      active = false;
      tokenSubscription.remove();
    };
  }, [isLoaded, isSignedIn, me?.teamId, registerPushToken]);

  if (!isLoaded) return null;

  return (
    <Stack screenOptions={{ headerTintColor: '#f97316', headerBackTitle: 'Voltar' }}>
      <Stack.Screen name="sign-in" options={{ headerShown: false }} />
      <Stack.Screen name="onboarding" options={{ headerShown: false }} />
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />

      {/* Orçamento screens */}
      <Stack.Screen name="orcamento/[id]" options={{ title: 'Orçamento' }} />
      <Stack.Screen name="orcamento/novo" options={{ title: 'Novo Orçamento', presentation: 'modal' }} />
      <Stack.Screen name="orcamento/editar/[id]" options={{ title: 'Editar Orçamento' }} />

      {/* Tarefa screens */}
      <Stack.Screen name="tarefa/[id]" options={{ title: 'Ordem de Serviço' }} />
      <Stack.Screen name="tarefa/nova" options={{ title: 'Nova Ordem de Serviço', presentation: 'modal' }} />
      <Stack.Screen name="tarefa/editar/[id]" options={{ title: 'Editar O.S.' }} />

      {/* Cliente screens */}
      <Stack.Screen name="cliente/[id]" options={{ title: 'Cliente' }} />
      <Stack.Screen name="cliente/novo" options={{ title: 'Novo Cliente', presentation: 'modal' }} />
      <Stack.Screen name="cliente/editar/[id]" options={{ title: 'Editar Cliente' }} />

      {/* Settings screens */}
      <Stack.Screen name="equipes/index" options={{ title: 'Equipes' }} />
      <Stack.Screen name="empresa" options={{ title: 'Dados da Empresa' }} />
      <Stack.Screen name="produtos/index" options={{ title: 'Produtos e Serviços' }} />
      <Stack.Screen name="relatorios" options={{ title: 'Relatório Mensal' }} />
    </Stack>
  );
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    PlusJakartaSans_400Regular,
    PlusJakartaSans_500Medium,
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold,
  });

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) return null;

  return (
    <ClerkProvider
      publishableKey={process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY ?? ''}
      tokenCache={tokenCache}
    >
      <SafeAreaProvider>
        <ErrorBoundary>
          <QueryClientProvider client={queryClient}>
            <GestureHandlerRootView style={{ flex: 1 }}>
              <RootLayoutNav />
            </GestureHandlerRootView>
          </QueryClientProvider>
        </ErrorBoundary>
      </SafeAreaProvider>
    </ClerkProvider>
  );
}
