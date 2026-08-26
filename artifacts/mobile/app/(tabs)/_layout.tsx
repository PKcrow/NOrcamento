import React from 'react';
import { Tabs, Redirect } from 'expo-router';
import { useAuth } from '@clerk/clerk-expo';
import { ActivityIndicator, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Colors from '@/constants/colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useGetMe } from '@workspace/api-client-react';

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
  const theme = Colors[colorScheme];

  const { data: me, isLoading: meLoading } = useGetMe();

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
          backgroundColor: theme.card,
          borderTopColor: theme.border,
          borderTopWidth: 1,
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
    </Tabs>
  );
}
