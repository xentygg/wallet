import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { categoriesFor } from '@/lib/categories';
import { formatDay, shiftDay, toDateKey } from '@/lib/dates';
import { findPossibleDuplicate, localDateFromIso, suggestCategory } from '@/lib/inbox';
import { parseAmount } from '@/lib/money';
import type { TransactionKind } from '@/lib/types';
import { useInbox } from '@/store/inbox';
import { useTransactions } from '@/store/transactions';
import { colors } from '@/theme';

/**
 * Crea un movimiento nuevo, edita uno existente (`id`) o revisa uno
 * recibido por correo (`pendingId`).
 */
export default function TransactionScreen() {
  const { id, pendingId } = useLocalSearchParams<{ id?: string; pendingId?: string }>();
  const { transactions, add, update, remove } = useTransactions();
  const inbox = useInbox();
  const existing = id ? transactions.find((t) => t.id === id) : undefined;
  const pending = pendingId ? inbox.items.find((i) => i.id === pendingId) : undefined;

  const initialKind = existing?.kind ?? pending?.kind ?? 'expense';
  const initialAmount = existing?.amount ?? pending?.amount ?? null;
  const [kind, setKind] = useState<TransactionKind>(initialKind);
  const [amountText, setAmountText] = useState(initialAmount ? (initialAmount / 100).toFixed(2) : '');
  const [categoryId, setCategoryId] = useState(
    existing?.categoryId ??
      (pending ? suggestCategory(pending.merchant, pending.kind, inbox.rules) : categoriesFor('expense')[0].id),
  );
  const [note, setNote] = useState(existing?.note ?? pending?.merchant ?? '');
  const [date, setDate] = useState(
    existing?.date ?? (pending ? localDateFromIso(pending.receivedAt) : toDateKey(new Date())),
  );
  const [error, setError] = useState<string | null>(null);

  const parsedAmount = parseAmount(amountText);
  const duplicate =
    pending && parsedAmount !== null
      ? findPossibleDuplicate(
          { amount: parsedAmount, kind, merchant: pending.merchant, receivedAt: `${date}T12:00:00` },
          transactions,
        )
      : undefined;

  const changeKind = (next: TransactionKind) => {
    setKind(next);
    setCategoryId(categoriesFor(next)[0].id);
  };

  const save = () => {
    const amount = parseAmount(amountText);
    if (amount === null) {
      setError('Escribe un importe válido mayor que cero.');
      return;
    }
    const data = { kind, amount, categoryId, note: note.trim(), date };
    if (existing) update({ ...existing, ...data });
    else if (pending) inbox.confirm(pending, { ...data, merchant: pending.merchant ?? undefined });
    else add(data);
    router.back();
  };

  const discardPending = () => {
    if (!pending) return;
    inbox.discard(pending);
    router.back();
  };

  const confirmDelete = () => {
    if (!existing) return;
    const doDelete = () => {
      remove(existing.id);
      router.back();
    };
    if (Platform.OS === 'web') {
      if (globalThis.confirm?.('¿Eliminar este movimiento?')) doDelete();
      return;
    }
    Alert.alert('Eliminar movimiento', '¿Seguro que quieres eliminarlo?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Eliminar', style: 'destructive', onPress: doDelete },
    ]);
  };

  const today = toDateKey(new Date());

  return (
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Stack.Screen
        options={{ title: existing ? 'Editar movimiento' : pending ? 'Revisar movimiento' : 'Nuevo movimiento' }}
      />

      {pending ? (
        <View style={styles.source}>
          <Text style={styles.sourceTitle}>Recibido por correo</Text>
          <Text style={styles.sourceText} numberOfLines={2}>
            {pending.subject} · {pending.from}
            {pending.cardLast4 ? ` · tarjeta •••• ${pending.cardLast4}` : ''}
          </Text>
          {duplicate ? (
            <Text style={styles.duplicate}>
              Ya tienes un movimiento igual ese día. Si es el mismo pago, descártalo.
            </Text>
          ) : null}
        </View>
      ) : null}

      <View style={styles.segment}>
        {(['expense', 'income'] as const).map((k) => (
          <Pressable
            key={k}
            onPress={() => changeKind(k)}
            style={[styles.segmentItem, kind === k && styles.segmentActive]}
          >
            <Text style={[styles.segmentText, kind === k && styles.segmentTextActive]}>
              {k === 'expense' ? 'Gasto' : 'Ingreso'}
            </Text>
          </Pressable>
        ))}
      </View>

      <Text style={styles.label}>Importe</Text>
      <TextInput
        style={styles.amountInput}
        value={amountText}
        onChangeText={(text) => {
          setAmountText(text);
          setError(null);
        }}
        placeholder="0.00"
        keyboardType="decimal-pad"
        autoFocus={!existing}
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Text style={styles.label}>Categoría</Text>
      <View style={styles.chips}>
        {categoriesFor(kind).map((c) => {
          const selected = c.id === categoryId;
          return (
            <Pressable
              key={c.id}
              onPress={() => setCategoryId(c.id)}
              style={[styles.chip, selected && { backgroundColor: c.color, borderColor: c.color }]}
            >
              <Text style={[styles.chipText, selected && { color: '#fff' }]}>{c.name}</Text>
            </Pressable>
          );
        })}
      </View>

      <Text style={styles.label}>Fecha</Text>
      <View style={styles.dateRow}>
        <Pressable hitSlop={8} onPress={() => setDate(shiftDay(date, -1))}>
          <Text style={styles.dateArrow}>‹</Text>
        </Pressable>
        <Text style={styles.dateText}>{date === today ? `Hoy, ${formatDay(date)}` : formatDay(date)}</Text>
        <Pressable hitSlop={8} onPress={() => setDate(shiftDay(date, 1))}>
          <Text style={styles.dateArrow}>›</Text>
        </Pressable>
      </View>

      <Text style={styles.label}>Nota (opcional)</Text>
      <TextInput
        style={styles.input}
        value={note}
        onChangeText={setNote}
        placeholder="Ej. supermercado"
        maxLength={80}
      />

      <Pressable style={styles.save} onPress={save}>
        <Text style={styles.saveText}>{pending ? 'Confirmar' : 'Guardar'}</Text>
      </Pressable>

      {pending ? (
        <Pressable style={styles.delete} onPress={discardPending}>
          <Text style={styles.deleteText}>Descartar</Text>
        </Pressable>
      ) : null}

      {existing ? (
        <Pressable style={styles.delete} onPress={confirmDelete}>
          <Text style={styles.deleteText}>Eliminar</Text>
        </Pressable>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 20 },
  source: { backgroundColor: '#EEF2FF', borderRadius: 12, padding: 14, marginBottom: 16, gap: 4 },
  sourceTitle: { fontSize: 13, fontWeight: '700', color: colors.primary },
  sourceText: { fontSize: 13, color: colors.text },
  duplicate: { fontSize: 13, color: '#B45309', marginTop: 4 },
  segment: { flexDirection: 'row', backgroundColor: colors.border, borderRadius: 12, padding: 4 },
  segmentItem: { flex: 1, paddingVertical: 10, borderRadius: 9, alignItems: 'center' },
  segmentActive: { backgroundColor: colors.card },
  segmentText: { fontSize: 15, color: colors.muted, fontWeight: '500' },
  segmentTextActive: { color: colors.text, fontWeight: '600' },
  label: { marginTop: 20, marginBottom: 8, fontSize: 13, fontWeight: '600', color: colors.muted },
  amountInput: {
    fontSize: 32,
    fontWeight: '700',
    color: colors.text,
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 14,
  },
  error: { color: colors.expense, marginTop: 6 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  chipText: { color: colors.text, fontSize: 14 },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.card,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  dateArrow: { fontSize: 26, color: colors.primary, paddingHorizontal: 8 },
  dateText: { fontSize: 15, color: colors.text },
  input: { backgroundColor: colors.card, borderRadius: 12, padding: 14, fontSize: 15, color: colors.text },
  save: { marginTop: 28, backgroundColor: colors.primary, borderRadius: 14, paddingVertical: 16, alignItems: 'center' },
  saveText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  delete: { marginTop: 12, paddingVertical: 14, alignItems: 'center' },
  deleteText: { color: colors.expense, fontSize: 15, fontWeight: '500' },
});
