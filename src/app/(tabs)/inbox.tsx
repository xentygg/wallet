import Ionicons from '@expo/vector-icons/Ionicons';
import { Link } from 'expo-router';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';

import { getCategory } from '@/lib/categories';
import { formatDay } from '@/lib/dates';
import { findPossibleDuplicate, localDateFromIso, suggestCategory } from '@/lib/inbox';
import { formatMoney } from '@/lib/money';
import type { PendingItem } from '@/lib/types';
import { useInbox } from '@/store/inbox';
import { useTransactions } from '@/store/transactions';
import { colors } from '@/theme';

export default function InboxScreen() {
  const { connection, loaded, items, refreshing, refresh, error, forwardingConfirmation } = useInbox();

  if (!loaded) return null;

  if (!connection) {
    return (
      <View style={styles.center}>
        <Ionicons name="mail-open-outline" size={56} color={colors.primary} />
        <Text style={styles.title}>Registra tus compras automáticamente</Text>
        <Text style={styles.body}>
          Reenvía a la app los correos que te manda tu banco en cada compra y aparecerán aquí para que solo
          confirmes la categoría.
        </Text>
        <Link href="/setup" asChild>
          <Pressable style={styles.button}>
            <Text style={styles.buttonText}>Conectar mi correo</Text>
          </Pressable>
        </Link>
      </View>
    );
  }

  return (
    <FlatList
      data={items}
      keyExtractor={(i) => i.id}
      contentContainerStyle={styles.list}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}
      ListHeaderComponent={
        <>
          {error ? <Text style={styles.error}>{error}</Text> : null}
          {forwardingConfirmation ? (
            <Link href="/setup" asChild>
              <Pressable style={styles.notice}>
                <Text style={styles.noticeText}>
                  Llegó el código de confirmación de Gmail. Toca aquí para verlo.
                </Text>
              </Pressable>
            </Link>
          ) : null}
        </>
      }
      renderItem={({ item }) => <PendingRow item={item} />}
      ListEmptyComponent={
        <Text style={styles.empty}>
          No hay movimientos por revisar.{'\n'}Desliza hacia abajo para buscar nuevos.
        </Text>
      }
      ListFooterComponent={
        <Link href="/setup" style={styles.footerLink}>
          Ver mi dirección y la configuración del correo
        </Link>
      }
    />
  );
}

function PendingRow({ item }: { item: PendingItem }) {
  const { rules, confirm, discard } = useInbox();
  const { transactions } = useTransactions();
  const category = getCategory(suggestCategory(item.merchant, item.kind, rules));
  const duplicate = findPossibleDuplicate(item, transactions);
  const date = localDateFromIso(item.receivedAt);
  const canQuickConfirm = item.amount !== null;

  const quickConfirm = () => {
    if (item.amount === null) return;
    confirm(item, {
      kind: item.kind,
      amount: item.amount,
      categoryId: category.id,
      note: item.merchant ?? '',
      merchant: item.merchant ?? undefined,
      date,
    });
  };

  return (
    <View style={styles.card}>
      <Link href={{ pathname: '/transaction', params: { pendingId: item.id } }} asChild>
        <Pressable style={styles.cardMain}>
          <View style={styles.cardText}>
            <Text style={styles.merchant} numberOfLines={1}>
              {item.merchant ?? item.subject ?? 'Movimiento sin comercio'}
            </Text>
            <Text style={styles.meta} numberOfLines={1}>
              {formatDay(date)}
              {item.cardLast4 ? ` · •••• ${item.cardLast4}` : ''} · {category.name}
            </Text>
            {item.amount === null ? (
              <Text style={styles.warning}>No pude leer el importe. Toca para completarlo.</Text>
            ) : null}
            {duplicate ? <Text style={styles.warning}>Posible duplicado de un movimiento ya registrado.</Text> : null}
          </View>
          <Text style={[styles.amount, { color: item.kind === 'income' ? colors.income : colors.expense }]}>
            {item.amount === null ? '—' : `${item.kind === 'income' ? '+' : '-'}${formatMoney(item.amount)}`}
          </Text>
        </Pressable>
      </Link>
      <View style={styles.actions}>
        <Pressable style={styles.secondary} onPress={() => discard(item)}>
          <Text style={styles.secondaryText}>Descartar</Text>
        </Pressable>
        {canQuickConfirm ? (
          <Pressable style={styles.primary} onPress={quickConfirm}>
            <Text style={styles.primaryText}>Confirmar como {category.name}</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 12 },
  title: { fontSize: 20, fontWeight: '700', color: colors.text, textAlign: 'center' },
  body: { fontSize: 15, color: colors.muted, textAlign: 'center', lineHeight: 22 },
  button: { marginTop: 8, backgroundColor: colors.primary, borderRadius: 14, paddingVertical: 14, paddingHorizontal: 24 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  list: { padding: 16, gap: 12 },
  error: { color: colors.expense, marginBottom: 8 },
  notice: { backgroundColor: '#EEF2FF', borderRadius: 12, padding: 14, marginBottom: 4 },
  noticeText: { color: colors.primary, fontWeight: '600' },
  empty: { textAlign: 'center', color: colors.muted, marginTop: 48, lineHeight: 22 },
  footerLink: { textAlign: 'center', color: colors.primary, marginTop: 24 },
  card: { backgroundColor: colors.card, borderRadius: 16, padding: 14 },
  cardMain: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  cardText: { flex: 1, gap: 3 },
  merchant: { fontSize: 16, fontWeight: '600', color: colors.text },
  meta: { fontSize: 13, color: colors.muted },
  warning: { fontSize: 13, color: '#B45309' },
  amount: { fontSize: 16, fontWeight: '700' },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8, marginTop: 12 },
  secondary: { paddingVertical: 8, paddingHorizontal: 14, borderRadius: 10 },
  secondaryText: { color: colors.muted, fontWeight: '500' },
  primary: { backgroundColor: colors.primary, paddingVertical: 8, paddingHorizontal: 14, borderRadius: 10 },
  primaryText: { color: '#fff', fontWeight: '600' },
});
