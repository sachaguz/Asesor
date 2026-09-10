import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { api, ApiError } from '@/api/client';
import { Mascot } from '@/components/mascot';
import { Fonts, Radius, Spacing, type ColorPalette } from '@/constants/theme';
import { useAuth } from '@/hooks/use-auth';
import { useTheme } from '@/hooks/use-theme';
import { haptics } from '@/lib/haptics';
import { passwordValida, REGLAS_PASSWORD } from '@/lib/password';

export default function ResetPasswordScreen() {
  const { token } = useLocalSearchParams<{ token?: string }>();
  const router = useRouter();
  const { entrarConToken } = useAuth();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [password, setPassword] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const puedeContinuar = !!token && passwordValida(password) && !enviando;

  const guardar = async () => {
    if (!puedeContinuar || !token) return;
    haptics.tap();
    setEnviando(true);
    setError(null);
    try {
      const { access_token } = await api.resetearPassword(token, password);
      await entrarConToken(access_token);
      haptics.success();
      router.replace('/(tabs)');
    } catch (err) {
      haptics.error();
      if (err instanceof ApiError && err.status === 400) {
        setError('Este enlace venció o ya se usó. Pedí uno nuevo.');
      } else if (err instanceof ApiError && err.status === 422) {
        setError(REGLAS_PASSWORD);
      } else {
        setError('No se pudo cambiar tu contraseña. Intenta de nuevo.');
      }
    } finally {
      setEnviando(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.content}>
        <View style={styles.seal}>
          <Mascot pose="neutral" size={64} />
        </View>
        <Text style={styles.title}>Elegí una contraseña nueva</Text>

        {!token ? (
          <Text style={styles.subtitle}>
            Este enlace no es válido. Volvé a pedir uno desde “Olvidaste tu contraseña” en la app.
          </Text>
        ) : (
          <>
            <Text style={styles.label}>Contraseña nueva</Text>
            <TextInput
              style={styles.input}
              placeholder="••••••••"
              placeholderTextColor={colors.inkSoft}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
            />
            <Text style={styles.hint}>{REGLAS_PASSWORD}</Text>

            {error && <Text style={styles.error}>{error}</Text>}

            <Pressable
              style={[styles.button, !puedeContinuar && styles.buttonDisabled]}
              onPress={guardar}
              disabled={!puedeContinuar}>
              {enviando ? (
                <ActivityIndicator color={colors.white} />
              ) : (
                <Text style={styles.buttonText}>Guardar y entrar</Text>
              )}
            </Pressable>
          </>
        )}
      </View>
    </SafeAreaView>
  );
}

function createStyles(colors: ColorPalette) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.paper },
    content: { flex: 1, justifyContent: 'center', padding: Spacing.six, gap: Spacing.one },
    seal: {
      alignItems: 'center',
      justifyContent: 'center',
      alignSelf: 'center',
      marginBottom: Spacing.three,
    },
    title: {
      fontFamily: Fonts.serifSemiBold,
      fontSize: 22,
      color: colors.ink,
      textAlign: 'center',
      marginBottom: Spacing.two,
    },
    subtitle: {
      fontFamily: Fonts.sansRegular,
      fontSize: 14,
      color: colors.inkSoft,
      textAlign: 'center',
      lineHeight: 20,
    },
    label: { fontFamily: Fonts.sansSemiBold, fontSize: 13, color: colors.ink, marginTop: Spacing.three },
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
    hint: { fontFamily: Fonts.sansRegular, fontSize: 11.5, color: colors.inkSoft, marginTop: 3 },
    error: { color: colors.nopidas, fontFamily: Fonts.sansRegular, fontSize: 13, marginTop: Spacing.three },
    button: {
      backgroundColor: colors.brand,
      borderRadius: Radius.lg,
      paddingVertical: Spacing.four,
      alignItems: 'center',
      marginTop: Spacing.six,
    },
    buttonDisabled: { opacity: 0.5 },
    buttonText: { fontFamily: Fonts.sansSemiBold, fontSize: 15.5, color: colors.white },
  });
}
