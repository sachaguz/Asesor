import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { api, ApiError } from '@/api/client';
import { Fonts, Radius, Spacing, type ColorPalette } from '@/constants/theme';
import { useAuth } from '@/hooks/use-auth';
import { useTheme } from '@/hooks/use-theme';
import { haptics } from '@/lib/haptics';

export default function EliminarCuentaScreen() {
  const router = useRouter();
  const { user, logout } = useAuth();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [texto, setTexto] = useState('');
  const [eliminando, setEliminando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const frase = `Borro la cuenta ${user?.email ?? ''}`;
  const puedeBorrar = texto === frase && !eliminando;

  const confirmar = async () => {
    if (!puedeBorrar) return;
    haptics.tap();
    setEliminando(true);
    setError(null);
    try {
      await api.eliminarCuenta(texto);
      haptics.success();
      await logout();
      router.replace('/login');
    } catch (err) {
      haptics.error();
      setError(
        err instanceof ApiError && err.status === 400
          ? 'El texto no coincide exactamente. Revisá mayúsculas y espacios.'
          : 'No se pudo borrar la cuenta. Intenta de nuevo.'
      );
      setEliminando(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Pressable hitSlop={8} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={24} color={colors.inkSoft} />
        </Pressable>
        <Text style={styles.titulo}>Borrar cuenta</Text>
        <View style={styles.headerSpacer} />
      </View>

      <View style={styles.content}>
        <View style={styles.icono}>
          <Ionicons name="warning" size={28} color={colors.nopidas} />
        </View>
        <Text style={styles.aviso}>Esto es permanente.</Text>
        <Text style={styles.texto}>
          Se borra tu cuenta y todo lo que le pertenece: tu negocio, tus ventas, tus consejos, el
          chat, y la conexión con Instagram si la tenés. No se puede deshacer.
        </Text>

        <Text style={styles.label}>Para confirmar, escribí exactamente:</Text>
        <Text style={styles.frase}>{frase}</Text>
        <TextInput
          style={styles.input}
          value={texto}
          onChangeText={setTexto}
          autoCapitalize="none"
          autoCorrect={false}
          placeholder={frase}
          placeholderTextColor={colors.inkSoft}
        />

        {error && <Text style={styles.error}>{error}</Text>}

        <Pressable
          style={[styles.boton, !puedeBorrar && styles.botonDisabled]}
          onPress={confirmar}
          disabled={!puedeBorrar}>
          {eliminando ? (
            <ActivityIndicator color={colors.white} />
          ) : (
            <Text style={styles.botonTexto}>Borrar mi cuenta para siempre</Text>
          )}
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

function createStyles(colors: ColorPalette) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: Spacing.four,
      paddingTop: Spacing.two,
      paddingBottom: Spacing.three,
    },
    titulo: { fontFamily: Fonts.serifSemiBold, fontSize: 17, color: colors.ink },
    headerSpacer: { width: 24 },
    content: { padding: Spacing.six, alignItems: 'center' },
    icono: {
      width: 56,
      height: 56,
      borderRadius: Radius.pill,
      backgroundColor: colors.nopidasBg,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: Spacing.four,
    },
    aviso: {
      fontFamily: Fonts.serifSemiBold,
      fontSize: 19,
      color: colors.ink,
      textAlign: 'center',
      marginBottom: Spacing.two,
    },
    texto: {
      fontFamily: Fonts.sansRegular,
      fontSize: 14,
      color: colors.inkSoft,
      textAlign: 'center',
      lineHeight: 20,
      marginBottom: Spacing.six,
    },
    label: {
      fontFamily: Fonts.sansSemiBold,
      fontSize: 13,
      color: colors.ink,
      alignSelf: 'flex-start',
    },
    frase: {
      fontFamily: Fonts.sansSemiBold,
      fontSize: 13.5,
      color: colors.nopidasInk,
      backgroundColor: colors.nopidasBg,
      borderRadius: Radius.sm,
      paddingHorizontal: Spacing.three,
      paddingVertical: Spacing.two,
      alignSelf: 'stretch',
      marginTop: Spacing.one,
      marginBottom: Spacing.three,
    },
    input: {
      alignSelf: 'stretch',
      borderWidth: 1,
      borderColor: colors.line,
      borderRadius: Radius.md,
      paddingHorizontal: Spacing.three,
      paddingVertical: Spacing.three,
      fontFamily: Fonts.sansRegular,
      fontSize: 14,
      color: colors.ink,
      backgroundColor: colors.paper,
    },
    error: {
      color: colors.nopidas,
      fontFamily: Fonts.sansRegular,
      fontSize: 13,
      marginTop: Spacing.three,
      textAlign: 'center',
    },
    boton: {
      alignSelf: 'stretch',
      backgroundColor: colors.nopidas,
      borderRadius: Radius.lg,
      paddingVertical: Spacing.four,
      alignItems: 'center',
      marginTop: Spacing.six,
    },
    botonDisabled: { opacity: 0.4 },
    botonTexto: { fontFamily: Fonts.sansSemiBold, fontSize: 15, color: colors.white },
  });
}
