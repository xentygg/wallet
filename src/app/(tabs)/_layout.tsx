import Ionicons from '@expo/vector-icons/Ionicons';
import { Tabs } from 'expo-router/tabs';

import { colors } from '@/theme';

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.primary,
        sceneStyle: { backgroundColor: colors.background },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Inicio',
          tabBarIcon: ({ focused, size }) => <Ionicons name="wallet" color={focused ? colors.primary : colors.muted} size={size} />,
        }}
      />
      <Tabs.Screen
        name="stats"
        options={{
          title: 'Resumen',
          tabBarIcon: ({ focused, size }) => <Ionicons name="pie-chart" color={focused ? colors.primary : colors.muted} size={size} />,
        }}
      />
    </Tabs>
  );
}
