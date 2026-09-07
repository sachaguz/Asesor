import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { api } from '@/api/client';
import { Mascot } from '@/components/mascot';
import { Fonts, Radius, Spacing, type ColorPalette } from '@/constants/theme';
import { useBusinessId } from '@/hooks/use-business-id';
import { useTheme } from '@/hooks/use-theme';
import { haptics } from '@/lib/haptics';

const GIROS = ['Calzado', 'Ropa', 'Abarrotes', 'Farmacia', 'Otro'];

export default function OnboardingScreen() {
  const { guardarNegocio } = useBusinessId();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [nombre, setNombre] = useState('');
  const [giro, setGiro] = useState(GIROS[0]);
  const [contexto, setContexto] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const puedeContinuar = nombre.trim().length > 0 && !enviando;

  const empezar = async () => {
    if (!puedeContinuar) return;
    haptics.tap();
    setEnviando(true);
    setError(null);
    try {
      const negocio = await api.crearNegocio(nombre.trim(), giro.toLowerCase());
      if (contexto.trim()) {
        await api.agregarContextoTexto(negocio.id, contexto.trim());
      }
      await guardarNegocio(negocio);
      haptics.success();
      // No navegamos manualmente acá: el efecto de _layout.tsx ya redirige
      // solo en cuanto detecta que businessId dejó de ser null. Hacerlo acá
      // TAMBIÉN disparaba un router.replace('/(tabs)') duplicado casi
      // simultáneo — dos REPLACE a la vez es lo que producía el error
      // "REPLACE ... was not handled by any navigator".
    } catch {
      haptics.error();
      setError('No se pudo crear tu negocio. Revisa tu conexión e intenta de nuevo.');
    } finally {
      setEnviando(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={0}>
        <ScrollView style={styles.flex} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <View style={styles.seal}>
        <Mascot pose="happy" size={64} />
      </View>
      <Text style={styles.title}>Soy tu Asesor</Text>
      <Text style={styles.subtitle}>
        Voy a revisar tus ventas y a decirte, en corto, qué te conviene resurtir y qué no. Empecemos por
        conocernos.
      </Text>

      <Text style={styles.label}>Nombre del negocio</Text>
      <TextInput
        style={styles.input}
        placeholder="Ej. Zapatería La Reforma"
        placeholderTextColor={colors.inkSoft}
        value={nombre}
        onChangeText={setNombre}
      />

      <Text style={styles.label}>¿Qué vende tu negocio?</Text>
      <View style={styles.pillRow}>
        {GIROS.map((g) => (
          <Pressable
            key={g}
            onPress={() => {
              haptics.select();
              setGiro(g);
            }}
            style={[styles.pill, giro === g && styles.pillOn]}>
            <Text style={[styles.pillText, giro === g && styles.pillTextOn]}>{g}</Text>
          </Pressable>
        ))}
      </View>

      <Text style={styles.label}>Platícame de tu negocio (opcional)</Text>
      <Text style={styles.hint}>
        Cosas que no salen en las ventas pero cambian mis consejos. Esto también lo puedes hacer después,
        en Mi negocio.
      </Text>
      <TextInput
        style={[styles.input, styles.textarea]}
        placeholder="Ej. Mis clientes son del rumbo, gente trabajadora. Lo que más se me pide es calzado resistente para diario…"
        placeholderTextColor={colors.inkSoft}
        value={contexto}
        onChangeText={setContexto}
        multiline
      />

      {error && <Text style={styles.error}>{error}</Text>}

      <Pressable
        style={[styles.button, !puedeContinuar && styles.buttonDisabled]}
        onPress={empezar}
        disabled={!puedeContinuar}>
        {enviando ? (
          <ActivityIndicator color={colors.white} />
        ) : (
          <Text style={styles.buttonText}>Empezar</Text>
        )}
      </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function createStyles(colors: ColorPalette) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.paper },
    flex: { flex: 1 },
    content: { padding: Spacing.six, paddingTop: Spacing.four, gap: Spacing.one },
    seal: {
      alignItems: 'center',
      justifyContent: 'center',
      alignSelf: 'center',
      marginBottom: Spacing.three,
    },
    title: {
      fontFamily: Fonts.serifSemiBold,
      fontSize: 28,
      color: colors.ink,
      textAlign: 'center',
      marginBottom: Spacing.two,
    },
    subtitle: {
      fontFamily: Fonts.sansRegular,
      fontSize: 14.5,
      color: colors.inkSoft,
      textAlign: 'center',
      lineHeight: 21,
      marginBottom: Spacing.five,
    },
    label: {
      fontFamily: Fonts.sansSemiBold,
      fontSize: 13,
      color: colors.ink,
      marginTop: Spacing.four,
    },
    hint: {
      fontFamily: Fonts.sansRegular,
      fontSize: 12.5,
      color: colors.inkSoft,
      marginTop: 2,
      marginBottom: Spacing.two,
    },
    input: {
      borderWidth: 1,
      borderColor: colors.line,
      borderRadius: Radius.md,
      paddingHorizontal: Spacing.three,
      paddingVertical: Spacing.three,
      fontFamily: Fonts.sansRegular,
      fontSize: 14,
      color: colors.ink,
      backgroundColor: colors.paper,
      marginTop: Spacing.one,
    },
    textarea: { minHeight: 100, textAlignVertical: 'top' },
    pillRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two, marginTop: Spacing.two },
    pill: {
      paddingHorizontal: Spacing.four,
      paddingVertical: Spacing.two,
      borderRadius: Radius.pill,
      borderWidth: 1,
      borderColor: colors.line,
      backgroundColor: colors.paper,
    },
    pillOn: { backgroundColor: colors.brand, borderColor: colors.brand },
    pillText: { fontFamily: Fonts.sansRegular, fontSize: 13.5, color: colors.ink },
    pillTextOn: { color: colors.white },
    error: {
      color: colors.nopidas,
      fontFamily: Fonts.sansRegular,
      fontSize: 13,
      marginTop: Spacing.three,
    },
    button: {
      backgroundColor: colors.brand,
      borderRadius: Radius.lg,
      paddingVertical: Spacing.four,
      alignItems: 'center',
      marginTop: Spacing.six,
      marginBottom: Spacing.six,
    },
    buttonDisabled: { opacity: 0.5 },
    buttonText: { fontFamily: Fonts.sansSemiBold, fontSize: 15.5, color: colors.white },
  });
}
