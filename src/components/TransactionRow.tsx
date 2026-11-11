import Ionicons from '@expo/vector-icons/Ionicons';
import { Link } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { getCategory } from '@/lib/categories';
import { formatMoney } from '@/lib/money';
import type { Transaction } from '@/lib/types';
import { colors } from '@/theme';

export function TransactionRow({ tx }: { tx: Transaction }) {
  const category = getCategory(tx.categoryId);
  const isIncome = tx.kind === 'income';

  return (
    <Link href={{ pathname: '/transaction', params: { id: tx.id } }} asChild>
      <Pressable style={styles.row}>
        <View style={[styles.icon, { backgroundColor: `${category.color}22` }]}>
          <Ionicons name={category.icon as keyof typeof Ionicons.glyphMap} size={18} color={category.color} />
        </View>
        <View style={styles.body}>
          <Text style={styles.title}>{category.name}</Text>
          {tx.note ? (
            <Text style={styles.note} numberOfLines={1}>
              {tx.note}
            </Text>
          ) : null}
        </View>
        <Text style={[styles.amount, { color: isIncome ? colors.income : colors.expense }]}>
          {isIncome ? '+' : '-'}
          {formatMoney(tx.amount)}
        </Text>
      </Pressable>
    </Link>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, gap: 12 },
  icon: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  body: { flex: 1 },
  title: { fontSize: 15, fontWeight: '500', color: colors.text },
  note: { fontSize: 13, color: colors.muted, marginTop: 2 },
  amount: { fontSize: 15, fontWeight: '600' },
});
