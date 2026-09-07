import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { api } from '@/api/client';
import { Mascot } from '@/components/mascot';
import { Fonts, Radius, Spacing, type ColorPalette } from '@/constants/theme';
import { useAuth } from '@/hooks/use-auth';
import { useTheme } from '@/hooks/use-theme';
import { haptics } from '@/lib/haptics';

export default function VerificarCorreoScreen() {
  const router = useRouter();
  const { user, refrescarPerfil, logout } = useAuth();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [reenviando, setReenviando] = useState(false);
  const [reenviado, setReenviado] = useState(false);
  const [revisando, setRevisando] = useState(false);
  const [todaviaNo, setTodaviaNo] = useState(false);

  const reenviar = async () => {
    haptics.tap();
    setReenviando(true);
    try {
      await api.reenviarVerificacion();
      haptics.success();
      setReenviado(true);
    } catch {
      haptics.error();
    } finally {
      setReenviando(false);
    }
  };

  const yaConfirme = async () => {
    haptics.tap();
    setRevisando(true);
    setTodaviaNo(false);
    const perfil = await refrescarPerfil();
    setRevisando(false);
    // Si ya quedó verificado, el redirect de _layout.tsx saca sola esta
    // pantalla del medio en cuanto `user.email_verificado` cambia — acá
    // solo hace falta avisar cuando SIGUE sin estarlo.
    if (!perfil?.email_verificado) setTodaviaNo(true);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.content}>
        <View style={styles.seal}>
          <Mascot pose="thinking" size={72} />
        </View>
        <Text style={styles.title}>Confirmá tu correo</Text>
        <Text style={styles.subtitle}>
          Te mandamos un enlace a{' '}
          <Text style={styles.email}>{user?.email}</Text>
          {'. '}Confirmalo para poder seguir usando El Asesor.
        </Text>

        <Pressable
          style={[styles.button, revisando && styles.buttonDisabled]}
          onPress={yaConfirme}
          disabled={revisando}>
          {revisando ? (
            <ActivityIndicator color={colors.white} />
          ) : (
            <Text style={styles.buttonText}>Ya lo confirmé</Text>
          )}
        </Pressable>
        {todaviaNo && <Text style={styles.hint}>Todavía no lo veo confirmado — intenta de nuevo.</Text>}

        <Pressable
          style={styles.linkButton}
          disabled={reenviando || reenviado}
          onPress={reenviar}>
          {reenviando ? (
            <ActivityIndicator color={colors.brandDeep} size="small" />
          ) : (
            <Text style={styles.linkText}>{reenviado ? 'Correo reenviado' : 'Reenviar correo'}</Text>
          )}
        </Pressable>

        <Pressable
          style={styles.linkButton}
          onPress={async () => {
            haptics.tap();
            await logout();
            router.replace('/login');
          }}>
          <Text style={styles.linkTextMuted}>Cerrar sesión</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

function createStyles(colors: ColorPalette) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.paper },
    content: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: Spacing.six },
    seal: { marginBottom: Spacing.three },
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
      marginBottom: Spacing.six,
    },
    email: { fontFamily: Fonts.sansSemiBold, color: colors.ink },
    button: {
      alignSelf: 'stretch',
      backgroundColor: colors.brand,
      borderRadius: Radius.lg,
      paddingVertical: Spacing.four,
      alignItems: 'center',
    },
    buttonDisabled: { opacity: 0.6 },
    buttonText: { fontFamily: Fonts.sansSemiBold, fontSize: 15, color: colors.white },
    hint: {
      fontFamily: Fonts.sansRegular,
      fontSize: 12,
      color: colors.inkSoft,
      textAlign: 'center',
      marginTop: Spacing.two,
    },
    linkButton: { marginTop: Spacing.five, alignItems: 'center' },
    linkText: { fontFamily: Fonts.sansMedium, fontSize: 13.5, color: colors.brandDeep },
    linkTextMuted: { fontFamily: Fonts.sansRegular, fontSize: 13, color: colors.inkSoft },
  });
}
