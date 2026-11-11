import { Stack } from 'expo-router/stack';
import { StatusBar } from 'expo-status-bar';

import { TransactionsProvider } from '@/store/transactions';
import { colors } from '@/theme';

export default function RootLayout() {
  return (
    <TransactionsProvider>
      <StatusBar style="dark" />
      <Stack screenOptions={{ contentStyle: { backgroundColor: colors.background } }}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="transaction" options={{ presentation: 'modal', title: 'Movimiento' }} />
      </Stack>
    </TransactionsProvider>
  );
}
