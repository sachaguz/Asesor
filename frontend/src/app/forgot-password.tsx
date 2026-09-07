import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { api } from '@/api/client';
import { Mascot } from '@/components/mascot';
import { Fonts, Radius, Spacing, type ColorPalette } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { haptics } from '@/lib/haptics';

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [email, setEmail] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState(false);

  const enviar = async () => {
    if (!email.trim() || enviando) return;
    haptics.tap();
    setEnviando(true);
    try {
      await api.olvidePassword(email.trim());
      haptics.success();
      setEnviado(true);
    } catch {
      // El backend siempre responde 204 exista o no la cuenta — un error acá
      // es de red, no de "correo no encontrado". Mostramos éxito igual para
      // no revelar si el correo existe.
      setEnviado(true);
    } finally {
      setEnviando(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.content}>
        <View style={styles.seal}>
          <Mascot pose={enviado ? 'happy' : 'neutral'} size={64} />
        </View>
        {enviado ? (
          <>
            <Text style={styles.title}>Revisá tu correo</Text>
            <Text style={styles.subtitle}>
              Si existe una cuenta con ese correo, te mandamos un enlace para elegir una contraseña
              nueva.
            </Text>
          </>
        ) : (
          <>
            <Text style={styles.title}>Recuperar contraseña</Text>
            <Text style={styles.subtitle}>
              Escribí el correo de tu cuenta y te mandamos un enlace para restablecerla.
            </Text>

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

            <Pressable
              style={[styles.button, (!email.trim() || enviando) && styles.buttonDisabled]}
              onPress={enviar}
              disabled={!email.trim() || enviando}>
              {enviando ? (
                <ActivityIndicator color={colors.white} />
              ) : (
                <Text style={styles.buttonText}>Enviar enlace</Text>
              )}
            </Pressable>
          </>
        )}

        <Pressable style={styles.link} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={14} color={colors.brandDeep} />
          <Text style={styles.linkText}>Volver a iniciar sesión</Text>
        </Pressable>
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
      fontSize: 24,
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
    button: {
      backgroundColor: colors.brand,
      borderRadius: Radius.lg,
      paddingVertical: Spacing.four,
      alignItems: 'center',
      marginTop: Spacing.six,
    },
    buttonDisabled: { opacity: 0.5 },
    buttonText: { fontFamily: Fonts.sansSemiBold, fontSize: 15.5, color: colors.white },
    link: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      alignSelf: 'center',
      marginTop: Spacing.six,
    },
    linkText: { fontFamily: Fonts.sansMedium, fontSize: 13.5, color: colors.brandDeep },
  });
}
