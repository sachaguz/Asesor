import { Link } from 'expo-router';
import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ApiError } from '@/api/client';
import { GoogleSignInButton } from '@/components/google-sign-in-button';
import { Mascot } from '@/components/mascot';
import { Fonts, Radius, Spacing, type ColorPalette } from '@/constants/theme';
import { useAuth } from '@/hooks/use-auth';
import { useTheme } from '@/hooks/use-theme';
import { haptics } from '@/lib/haptics';
import { passwordValida, REGLAS_PASSWORD } from '@/lib/password';

export default function RegisterScreen() {
  const { registrar } = useAuth();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [nombre, setNombre] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const puedeContinuar =
    nombre.trim().length > 0 && email.trim().length > 0 && passwordValida(password) && !enviando;

  const crearCuenta = async () => {
    if (!puedeContinuar) return;
    haptics.tap();
    setEnviando(true);
    setError(null);
    try {
      await registrar(email.trim(), password, nombre.trim());
    } catch (e) {
      haptics.error();
      if (e instanceof ApiError && e.status === 409) {
        setError('Ya existe una cuenta con ese correo.');
      } else if (e instanceof ApiError && e.status === 422) {
        setError(REGLAS_PASSWORD);
      } else {
        setError('No se pudo crear tu cuenta. Intenta de nuevo.');
      }
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
        <View style={styles.content}>
          <View style={styles.seal}>
            <Mascot pose="neutral" size={64} />
          </View>
          <Text style={styles.title}>Creá tu cuenta</Text>
          <Text style={styles.subtitle}>Un minuto y arrancamos.</Text>

          <Text style={styles.label}>Tu nombre</Text>
          <TextInput
            style={styles.input}
            placeholder="Ej. Ana Torres"
            placeholderTextColor={colors.inkSoft}
            value={nombre}
            onChangeText={setNombre}
          />

          <Text style={styles.label}>Correo</Text>
          <TextInput
            style={styles.input}
            placeholder="tu@correo.com"
            placeholderTextColor={colors.inkSoft}
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
          />

          <Text style={styles.label}>Contraseña</Text>
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
            onPress={crearCuenta}
            disabled={!puedeContinuar}>
            {enviando ? (
              <ActivityIndicator color={colors.white} />
            ) : (
              <Text style={styles.buttonText}>Crear cuenta</Text>
            )}
          </Pressable>

          <View style={styles.dividerRow}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>o</Text>
            <View style={styles.dividerLine} />
          </View>
          <GoogleSignInButton onError={setError} />

          <Link href="/login" style={styles.link}>
            <Text style={styles.linkText}>¿Ya tenés cuenta? Iniciá sesión</Text>
          </Link>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function createStyles(colors: ColorPalette) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.paper },
    flex: { flex: 1 },
    content: { flex: 1, justifyContent: 'center', padding: Spacing.six, gap: Spacing.one },
    seal: {
      alignItems: 'center',
      justifyContent: 'center',
      alignSelf: 'center',
      marginBottom: Spacing.three,
    },
    title: {
      fontFamily: Fonts.serifSemiBold,
      fontSize: 26,
      color: colors.ink,
      textAlign: 'center',
      marginBottom: Spacing.two,
    },
    subtitle: {
      fontFamily: Fonts.sansRegular,
      fontSize: 14,
      color: colors.inkSoft,
      textAlign: 'center',
      marginBottom: Spacing.five,
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
    dividerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.two,
      marginTop: Spacing.five,
    },
    dividerLine: { flex: 1, height: 1, backgroundColor: colors.line },
    dividerText: { fontFamily: Fonts.sansRegular, fontSize: 12.5, color: colors.inkSoft },
    link: { alignSelf: 'center', marginTop: Spacing.five },
    linkText: { fontFamily: Fonts.sansMedium, fontSize: 13.5, color: colors.brandDeep },
  });
}
