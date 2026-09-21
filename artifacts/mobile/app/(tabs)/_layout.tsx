import React from 'react';
import { Tabs, Redirect } from 'expo-router';
import { useAuth } from '@clerk/expo';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Colors from '@/constants/colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { getGetMeQueryKey, useGetMe } from '@workspace/api-client-react';

function TabBarIcon({
  name,
  color,
}: {
  name: React.ComponentProps<typeof Ionicons>['name'];
  color: string;
}) {
  return <Ionicons name={name} size={24} color={color} />;
}

export default function TabsLayout() {
  const { isLoaded, isSignedIn } = useAuth();
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme ?? 'light'];

  const {
    data: me,
    isError: meError,
    isLoading: meLoading,
    refetch: refetchMe,
  } = useGetMe({
    query: {
      queryKey: getGetMeQueryKey(),
      enabled: isLoaded && Boolean(isSignedIn),
    },
  });

  if (!isLoaded || (isSignedIn && meLoading)) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.background }}>
        <ActivityIndicator color={theme.primary} />
      </View>
    );
  }

  if (!isSignedIn) {
    return <Redirect href="/sign-in" />;
  }

  if (meError) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.background, padding: 28 }}>
        <Ionicons name="cloud-offline-outline" size={42} color={theme.primary} />
        <Text style={{ color: theme.foreground, fontSize: 18, fontWeight: '700', marginTop: 16, textAlign: 'center' }}>
          Não foi possível carregar sua conta
        </Text>
        <Text style={{ color: theme.muted, fontSize: 14, lineHeight: 21, marginTop: 8, textAlign: 'center' }}>
          Verifique sua conexão e tente novamente.
        </Text>
        <Pressable
          onPress={() => void refetchMe()}
          style={{ backgroundColor: theme.primary, borderRadius: 10, marginTop: 20, paddingHorizontal: 20, paddingVertical: 12 }}
        >
          <Text style={{ color: '#fff', fontSize: 14, fontWeight: '700' }}>Tentar novamente</Text>
        </Pressable>
      </View>
    );
  }

  // Redirect to onboarding if user has no team yet
  if (me && !me.teamId) {
    return <Redirect href="/onboarding" />;
  }

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: theme.primary,
        tabBarInactiveTintColor: theme.tabIconDefault,
        tabBarStyle: {
            display: 'none',
        },
        tabBarLabelStyle: {
          fontFamily: 'PlusJakartaSans_500Medium',
          fontSize: 11,
        },
        headerStyle: { backgroundColor: theme.card },
        headerTitleStyle: {
          fontFamily: 'PlusJakartaSans_600SemiBold',
          color: theme.foreground,
        },
        headerTintColor: theme.primary,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Dashboard',
          tabBarIcon: ({ color }) => <TabBarIcon name="home" color={color} />,
          headerTitle: 'Dashboard',
        }}
      />
      <Tabs.Screen
        name="orcamentos"
        options={{
          title: 'Orçamentos',
          tabBarIcon: ({ color }) => <TabBarIcon name="document-text" color={color} />,
        }}
      />
      <Tabs.Screen
        name="tarefas"
        options={{
          title: 'Ordens',
          tabBarIcon: ({ color }) => <TabBarIcon name="clipboard" color={color} />,
        }}
      />
      <Tabs.Screen
        name="clientes"
        options={{
          title: 'Clientes',
          tabBarIcon: ({ color }) => <TabBarIcon name="people" color={color} />,
        }}
      />
      <Tabs.Screen
        name="mais"
        options={{
          title: 'Perfil',
          tabBarIcon: ({ color }) => <TabBarIcon name="person-circle" color={color} />,
        }}
      />
      <Tabs.Screen
        name="notificacoes"
        options={{
          title: 'Notificações',
          href: null,
        }}
      />
    </Tabs>
  );
}
