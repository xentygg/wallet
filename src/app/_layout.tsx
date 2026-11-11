import { Stack } from 'expo-router/stack';
import { StatusBar } from 'expo-status-bar';

import { InboxProvider } from '@/store/inbox';
import { TransactionsProvider } from '@/store/transactions';
import { colors } from '@/theme';

export default function RootLayout() {
  return (
    <TransactionsProvider>
      <InboxProvider>
        <StatusBar style="dark" />
        <Stack screenOptions={{ contentStyle: { backgroundColor: colors.background } }}>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="transaction" options={{ presentation: 'modal', title: 'Movimiento' }} />
          <Stack.Screen name="setup" options={{ title: 'Conectar correo' }} />
        </Stack>
      </InboxProvider>
    </TransactionsProvider>
  );
}
