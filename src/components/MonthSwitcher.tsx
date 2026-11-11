import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { formatMonth, shiftMonth } from '@/lib/dates';
import { colors } from '@/theme';

type Props = { month: string; onChange: (month: string) => void };

export function MonthSwitcher({ month, onChange }: Props) {
  return (
    <View style={styles.row}>
      <Pressable accessibilityLabel="Mes anterior" hitSlop={12} onPress={() => onChange(shiftMonth(month, -1))}>
        <Ionicons name="chevron-back" size={22} color={colors.text} />
      </Pressable>
      <Text style={styles.label}>{formatMonth(month)}</Text>
      <Pressable accessibilityLabel="Mes siguiente" hitSlop={12} onPress={() => onChange(shiftMonth(month, 1))}>
        <Ionicons name="chevron-forward" size={22} color={colors.text} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 8 },
  label: { fontSize: 17, fontWeight: '600', color: colors.text },
});
