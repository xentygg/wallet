import Ionicons from '@expo/vector-icons/Ionicons';
import { Link } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, SectionList, StyleSheet, Text, View } from 'react-native';

import { MonthSwitcher } from '@/components/MonthSwitcher';
import { TransactionRow } from '@/components/TransactionRow';
import { currentMonth, formatDay } from '@/lib/dates';
import { formatMoney } from '@/lib/money';
import { groupByDay, inMonth, totals } from '@/lib/summary';
import { useTransactions } from '@/store/transactions';
import { colors } from '@/theme';

export default function HomeScreen() {
  const { transactions, loaded } = useTransactions();
  const [month, setMonth] = useState(currentMonth);

  const monthTx = useMemo(() => inMonth(transactions, month), [transactions, month]);
  const sum = useMemo(() => totals(monthTx), [monthTx]);
  const sections = useMemo(
    () => groupByDay(monthTx).map((g) => ({ title: g.date, data: g.items })),
    [monthTx],
  );

  if (!loaded) {
    return <ActivityIndicator style={{ flex: 1 }} color={colors.primary} />;
  }

  return (
    <View style={styles.screen}>
      <SectionList
        sections={sections}
        keyExtractor={(t) => t.id}
        contentContainerStyle={styles.content}
        ListHeaderComponent={
          <>
            <MonthSwitcher month={month} onChange={setMonth} />
            <View style={styles.balanceCard}>
              <Text style={styles.balanceLabel}>Balance del mes</Text>
              <Text style={styles.balance}>{formatMoney(sum.balance)}</Text>
              <View style={styles.split}>
                <View>
                  <Text style={styles.splitLabel}>Ingresos</Text>
                  <Text style={styles.splitValue}>{formatMoney(sum.income)}</Text>
                </View>
                <View>
                  <Text style={styles.splitLabel}>Gastos</Text>
                  <Text style={styles.splitValue}>{formatMoney(sum.expense)}</Text>
                </View>
              </View>
            </View>
          </>
        }
        renderSectionHeader={({ section }) => <Text style={styles.day}>{formatDay(section.title)}</Text>}
        renderItem={({ item }) => <TransactionRow tx={item} />}
        ListEmptyComponent={
          <Text style={styles.empty}>No hay movimientos este mes.{'\n'}Toca + para agregar uno.</Text>
        }
        stickySectionHeadersEnabled={false}
      />
      <Link href="/transaction" asChild>
        <Pressable style={styles.fab} accessibilityLabel="Agregar movimiento">
          <Ionicons name="add" size={30} color="#fff" />
        </Pressable>
      </Link>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { padding: 16, paddingBottom: 100 },
  balanceCard: { backgroundColor: colors.primary, borderRadius: 20, padding: 20, marginVertical: 8 },
  balanceLabel: { color: '#C7D2FE', fontSize: 14 },
  balance: { color: '#fff', fontSize: 34, fontWeight: '700', marginTop: 4 },
  split: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 16 },
  splitLabel: { color: '#C7D2FE', fontSize: 13 },
  splitValue: { color: '#fff', fontSize: 17, fontWeight: '600', marginTop: 2 },
  day: { marginTop: 16, marginBottom: 4, fontSize: 13, fontWeight: '600', color: colors.muted },
  empty: { textAlign: 'center', color: colors.muted, marginTop: 48, lineHeight: 22 },
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 24,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
  },
});
