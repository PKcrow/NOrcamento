import React, { useEffect, useRef } from 'react';
import { ClerkProvider, useAuth } from '@clerk/expo';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  PlusJakartaSans_400Regular,
  PlusJakartaSans_500Medium,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
  useFonts,
} from '@expo-google-fonts/plus-jakarta-sans';
import { Stack, usePathname, useRouter } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import * as Notifications from 'expo-notifications';
import { Ionicons } from '@expo/vector-icons';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import {
  setBaseUrl,
  setAuthTokenGetter,
  getGetMeQueryKey,
  getListTasksQueryKey,
  useListTasks,
  useGetMe,
  useRegisterPushToken,
} from '@workspace/api-client-react';
import {
  clearLocalTaskNotifications,
  requestNativePushRegistration,
  saveNativePushToken,
  syncLocalTaskNotifications,
} from '@/lib/pushNotifications';
import Colors from '@/constants/colors';
import { useColorScheme } from '@/hooks/useColorScheme';

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

const clerkProxyUrl = process.env.EXPO_PUBLIC_CLERK_PROXY_URL || undefined;
const clerkPublishableKey = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY?.trim();

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

type BottomNavItem = {
  label: string;
  path: string;
  icon: React.ComponentProps<typeof Ionicons>['name'];
};

const BOTTOM_NAV_ITEMS: BottomNavItem[] = [
  { label: 'Dashboard', path: '/', icon: 'home-outline' },
  { label: 'Orçamentos', path: '/orcamentos', icon: 'document-text-outline' },
  { label: 'Ordens', path: '/tarefas', icon: 'clipboard-outline' },
  { label: 'Clientes', path: '/clientes', icon: 'people-outline' },
  { label: 'Relatórios', path: '/relatorios', icon: 'bar-chart-outline' },
  { label: 'Perfil', path: '/mais', icon: 'person-circle-outline' },
];

function BottomNavigation() {
  const router = useRouter();
  const pathname = usePathname();
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme];
  const insets = useSafeAreaInsets();
  const scrollRef = useRef<ScrollView>(null);

  const activeIndex = Math.max(
    0,
    BOTTOM_NAV_ITEMS.findIndex((item) =>
      item.path === '/' ? pathname === '/' : pathname.startsWith(item.path),
    ),
  );

  useEffect(() => {
    scrollRef.current?.scrollTo({
      x: Math.max(0, activeIndex * 92 - 110),
      animated: true,
    });
  }, [activeIndex]);

  return (
    <View
      style={[
        styles.bottomNavigation,
        {
          backgroundColor: theme.card,
          borderTopColor: theme.border,
          paddingBottom: Math.max(insets.bottom, 8),
        },
      ]}
    >
      <ScrollView
        ref={scrollRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.bottomNavigationContent}
        keyboardShouldPersistTaps="handled"
      >
        {BOTTOM_NAV_ITEMS.map((item, index) => {
          const isActive = index === activeIndex;
          return (
            <Pressable
              key={item.path}
              accessibilityRole="tab"
              accessibilityState={{ selected: isActive }}
              onPress={() => router.push(item.path as never)}
              style={({ pressed }) => [
                styles.bottomNavigationItem,
                isActive && { backgroundColor: `${theme.primary}18` },
                pressed && styles.bottomNavigationItemPressed,
              ]}
            >
              <Ionicons
                name={isActive ? item.icon.replace('-outline', '') as React.ComponentProps<typeof Ionicons>['name'] : item.icon}
                size={21}
                color={isActive ? theme.primary : theme.tabIconDefault}
              />
              <Text
                numberOfLines={1}
                style={[
                  styles.bottomNavigationLabel,
                  { color: isActive ? theme.primary : theme.tabIconDefault },
                ]}
              >
                {item.label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

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

    const openNotification = (response: Notifications.NotificationResponse | null) => {
      const data = response?.notification.request.content.data;
      const quoteId = data?.quoteId;
      const taskId = data?.taskId;
      if (typeof quoteId === 'string' && /^\d+$/.test(quoteId)) {
        router.push({ pathname: '/orcamento/[id]', params: { id: quoteId } });
      } else if (typeof taskId === 'string' && /^\d+$/.test(taskId)) {
        router.push({ pathname: '/tarefa/[id]', params: { id: taskId } });
      }
    };

    void Notifications.getLastNotificationResponseAsync().then(openNotification);
    const subscription = Notifications.addNotificationResponseReceivedListener(openNotification);
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

  const { data: tasks } = useListTasks(
    {},
    {
      query: {
        queryKey: getListTasksQueryKey({}),
        enabled: isLoaded && Boolean(isSignedIn && me?.teamId),
        refetchInterval: 15 * 60 * 1000,
      },
    },
  );

  useEffect(() => {
    if (Platform.OS === 'web') return;
    if (!isLoaded || !isSignedIn || !me?.teamId) {
      void clearLocalTaskNotifications();
      return;
    }
    void syncLocalTaskNotifications(
      (tasks ?? []).map((task) => ({
        id: task.id,
        title: task.title,
        dueAt: task.dueAt,
        status: task.status,
      })),
    );
  }, [isLoaded, isSignedIn, me?.teamId, tasks]);

  if (!isLoaded) {
    return (
      <View style={styles.startupError}>
        <ActivityIndicator size="large" color="#f97316" />
        <Text style={styles.startupErrorTitle}>Carregando autenticação</Text>
        <Text style={styles.startupErrorText}>
          Aguarde enquanto conectamos sua conta com segurança.
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.rootContainer}>
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
        <Stack.Screen name="politica-de-privacidade" options={{ title: 'Política de Privacidade' }} />
      </Stack>
      {isSignedIn && me?.teamId ? <BottomNavigation /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  rootContainer: { flex: 1 },
  startupError: {
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    flex: 1,
    justifyContent: 'center',
    padding: 28,
  },
  startupErrorTitle: {
    color: '#0f172a',
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 20,
    textAlign: 'center',
  },
  startupErrorText: {
    color: '#475569',
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize: 15,
    lineHeight: 23,
    marginTop: 12,
    textAlign: 'center',
  },
  startupErrorDetails: {
    color: '#b91c1c',
    fontFamily: 'monospace',
    fontSize: 12,
    lineHeight: 18,
    marginTop: 18,
    textAlign: 'center',
  },
  bottomNavigation: {
    borderTopWidth: 1,
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
  },
  bottomNavigationContent: {
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingTop: 8,
  },
  bottomNavigationItem: {
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 82,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
    gap: 2,
  },
  bottomNavigationItemPressed: { opacity: 0.7 },
  bottomNavigationLabel: {
    fontSize: 10,
    fontFamily: 'PlusJakartaSans_500Medium',
  },
});

function StartupErrorFallback({ error }: { error: Error }) {
  useEffect(() => {
    void SplashScreen.hideAsync();
  }, []);

  return (
    <View style={styles.startupError}>
      <Text style={styles.startupErrorTitle}>Não foi possível iniciar o aplicativo</Text>
      <Text style={styles.startupErrorText}>
        Ocorreu um erro ao carregar a autenticação. Feche e abra o aplicativo novamente.
      </Text>
      <Text selectable style={styles.startupErrorDetails}>
        {error.message || 'Erro de inicialização sem detalhes.'}
      </Text>
    </View>
  );
}

function RootLayoutContent() {
  const [fontsLoaded, fontError] = useFonts({
    PlusJakartaSans_400Regular,
    PlusJakartaSans_500Medium,
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold,
  });

  useEffect(() => {
    const fallbackTimer = setTimeout(() => {
      void SplashScreen.hideAsync();
    }, 2500);

    if (fontsLoaded || fontError) {
      void SplashScreen.hideAsync();
    }

    return () => clearTimeout(fallbackTimer);
  }, [fontsLoaded, fontError]);

  if (!clerkPublishableKey) {
    return (
      <View style={styles.startupError}>
        <Text style={styles.startupErrorTitle}>Não foi possível iniciar o aplicativo</Text>
        <Text style={styles.startupErrorText}>
          A configuração de autenticação não foi incluída nesta versão. Instale uma versão atualizada.
        </Text>
      </View>
    );
  }

  return (
    <ClerkProvider
      publishableKey={clerkPublishableKey}
      tokenCache={tokenCache}
      proxyUrl={clerkProxyUrl}
    >
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <GestureHandlerRootView style={{ flex: 1 }}>
            <RootLayoutNav />
          </GestureHandlerRootView>
        </QueryClientProvider>
      </SafeAreaProvider>
    </ClerkProvider>
  );
}

export default function RootLayout() {
  return (
    <ErrorBoundary
      FallbackComponent={StartupErrorFallback}
      onError={(error, stackTrace) => {
        console.error('Mobile startup error:', error, stackTrace);
      }}
    >
      <RootLayoutContent />
    </ErrorBoundary>
  );
}
