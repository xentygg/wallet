import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { MonthSwitcher } from '@/components/MonthSwitcher';
import { getCategory } from '@/lib/categories';
import { currentMonth } from '@/lib/dates';
import { formatMoney } from '@/lib/money';
import { expensesByCategory, inMonth, totals } from '@/lib/summary';
import { useTransactions } from '@/store/transactions';
import { colors } from '@/theme';

export default function StatsScreen() {
  const { transactions } = useTransactions();
  const [month, setMonth] = useState(currentMonth);

  const monthTx = useMemo(() => inMonth(transactions, month), [transactions, month]);
  const byCategory = useMemo(() => expensesByCategory(monthTx), [monthTx]);
  const { expense } = totals(monthTx);

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <MonthSwitcher month={month} onChange={setMonth} />
      <View style={styles.card}>
        <Text style={styles.label}>Gastos del mes</Text>
        <Text style={styles.total}>{formatMoney(expense)}</Text>

        {byCategory.length === 0 ? (
          <Text style={styles.empty}>Sin gastos registrados.</Text>
        ) : (
          byCategory.map((row) => {
            const category = getCategory(row.categoryId);
            return (
              <View key={row.categoryId} style={styles.row}>
                <View style={styles.rowHeader}>
                  <Text style={styles.name}>{category.name}</Text>
                  <Text style={styles.amount}>
                    {formatMoney(row.amount)} · {Math.round(row.share * 100)}%
                  </Text>
                </View>
                <View style={styles.track}>
                  <View
                    style={[styles.bar, { width: `${row.share * 100}%`, backgroundColor: category.color }]}
                  />
                </View>
              </View>
            );
          })
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16 },
  card: { backgroundColor: colors.card, borderRadius: 20, padding: 20, marginTop: 8 },
  label: { color: colors.muted, fontSize: 14 },
  total: { color: colors.text, fontSize: 28, fontWeight: '700', marginTop: 4, marginBottom: 12 },
  empty: { color: colors.muted, marginTop: 8 },
  row: { marginTop: 14 },
  rowHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  name: { fontSize: 15, color: colors.text, fontWeight: '500' },
  amount: { fontSize: 14, color: colors.muted },
  track: { height: 8, backgroundColor: colors.border, borderRadius: 4, overflow: 'hidden' },
  bar: { height: 8, borderRadius: 4 },
});
