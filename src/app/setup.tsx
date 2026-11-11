import * as Clipboard from 'expo-clipboard';
import { useState } from 'react';
import { ActivityIndicator, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { useInbox } from '@/store/inbox';
import { colors } from '@/theme';

export default function SetupScreen() {
  const { connection, connect, error, forwardingConfirmation, dismissConfirmation } = useInbox();
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  const copy = async (text: string) => {
    await Clipboard.setStringAsync(text);
    setCopied(text);
    setTimeout(() => setCopied(null), 2000);
  };

  if (!connection) {
    return (
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.lead}>
          Te daremos una dirección de correo propia. Reenviarás ahí solo los avisos de compra de tu banco; la app
          nunca entra a tu correo.
        </Text>
        <View style={styles.box}>
          <Text style={styles.boxTitle}>Qué guardamos</Text>
          <Text style={styles.text}>
            Del correo solo leemos importe, comercio, fecha y últimos 4 dígitos de la tarjeta. El texto del correo se
            descarta, y el movimiento se borra del servidor en cuanto lo confirmas.
          </Text>
        </View>
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <Pressable
          style={styles.button}
          disabled={busy}
          onPress={async () => {
            setBusy(true);
            await connect().catch(() => undefined);
            setBusy(false);
          }}
        >
          {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Crear mi dirección</Text>}
        </Pressable>
      </ScrollView>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Text style={styles.label}>Tu dirección de reenvío</Text>
      <Pressable style={styles.address} onPress={() => copy(connection.address)}>
        <Text style={styles.addressText} selectable>
          {connection.address}
        </Text>
        <Text style={styles.copy}>{copied === connection.address ? '¡Copiada!' : 'Copiar'}</Text>
      </Pressable>

      {forwardingConfirmation ? (
        <View style={[styles.box, styles.highlight]}>
          <Text style={styles.boxTitle}>Código de confirmación de Gmail</Text>
          {forwardingConfirmation.code ? (
            <Pressable onPress={() => copy(forwardingConfirmation.code!)}>
              <Text style={styles.code}>{forwardingConfirmation.code}</Text>
              <Text style={styles.copy}>{copied === forwardingConfirmation.code ? '¡Copiado!' : 'Toca para copiar'}</Text>
            </Pressable>
          ) : null}
          <Text style={styles.text}>
            Escríbelo en Gmail, en la ventana de verificación de la dirección de reenvío.
          </Text>
          {forwardingConfirmation.link ? (
            <Text style={styles.link} onPress={() => Linking.openURL(forwardingConfirmation.link!)}>
              O abre el enlace de confirmación
            </Text>
          ) : null}
          <Text style={styles.link} onPress={dismissConfirmation}>
            Ya lo confirmé, ocultar
          </Text>
        </View>
      ) : null}

      <Text style={styles.section}>Gmail (desde la computadora)</Text>
      <Step n={1} text="Abre Gmail en el navegador → engrane ⚙️ → «Ver todos los ajustes» → pestaña «Reenvío y correo POP/IMAP»." />
      <Step n={2} text="Pulsa «Añadir una dirección de reenvío» y pega tu dirección de arriba." />
      <Step n={3} text="Gmail mandará un código a esa dirección. Aparecerá en esta pantalla; escríbelo en Gmail para verificar." />
      <Step n={4} text="Busca un correo de aviso de tu banco, abre el menú ⋮ → «Filtrar mensajes como este» → «Crear filtro»." />
      <Step n={5} text="Marca «Reenviar a» y elige tu dirección. Así solo se reenvían los avisos del banco." />

      <Text style={styles.section}>Outlook / Hotmail</Text>
      <Step n={1} text="En Outlook.com → ⚙️ Configuración → Correo → Reglas → «Agregar nueva regla»." />
      <Step n={2} text="Condición: «De» la dirección de tu banco. Acción: «Reenviar a» tu dirección de arriba." />

      <Text style={styles.note}>
        Los menús pueden cambiar de nombre según el idioma o la versión de tu correo. Si algo no coincide, avísanos.
      </Text>
    </ScrollView>
  );
}

function Step({ n, text }: { n: number; text: string }) {
  return (
    <View style={styles.step}>
      <Text style={styles.stepNumber}>{n}</Text>
      <Text style={styles.stepText}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { padding: 20, gap: 12 },
  lead: { fontSize: 16, color: colors.text, lineHeight: 23 },
  box: { backgroundColor: colors.card, borderRadius: 14, padding: 16, gap: 6 },
  highlight: { borderWidth: 2, borderColor: colors.primary },
  boxTitle: { fontSize: 15, fontWeight: '700', color: colors.text },
  text: { fontSize: 14, color: colors.muted, lineHeight: 20 },
  error: { color: colors.expense },
  button: { backgroundColor: colors.primary, borderRadius: 14, paddingVertical: 16, alignItems: 'center', marginTop: 8 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  label: { fontSize: 13, fontWeight: '600', color: colors.muted },
  address: { backgroundColor: colors.card, borderRadius: 14, padding: 16, gap: 4 },
  addressText: { fontSize: 18, fontWeight: '700', color: colors.text },
  copy: { color: colors.primary, fontWeight: '600' },
  code: { fontSize: 28, fontWeight: '800', letterSpacing: 2, color: colors.text },
  link: { color: colors.primary, fontWeight: '600', marginTop: 4 },
  section: { fontSize: 17, fontWeight: '700', color: colors.text, marginTop: 12 },
  step: { flexDirection: 'row', gap: 10 },
  stepNumber: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.primary,
    color: '#fff',
    textAlign: 'center',
    lineHeight: 24,
    fontWeight: '700',
    overflow: 'hidden',
  },
  stepText: { flex: 1, fontSize: 15, color: colors.text, lineHeight: 22 },
  note: { fontSize: 13, color: colors.muted, marginTop: 12, lineHeight: 19 },
});
