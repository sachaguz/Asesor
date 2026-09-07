import { GoogleSignin, isErrorWithCode, statusCodes } from '@react-native-google-signin/google-signin';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text } from 'react-native';

import { Fonts, Radius, Spacing, type ColorPalette } from '@/constants/theme';
import { useAuth } from '@/hooks/use-auth';
import { useTheme } from '@/hooks/use-theme';
import { haptics } from '@/lib/haptics';

const GOOGLE_WEB_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;

// El login nativo valida la identidad de la app (package + SHA-1) contra un
// client de Android registrado en Google Cloud, pero el id_token que emite
// sigue teniendo como audience el client "Web" — por eso se le pasa acá y no
// hace falta ningún cambio en la verificación del backend.
GoogleSignin.configure({ webClientId: GOOGLE_WEB_CLIENT_ID });

export function GoogleSignInButton({ onError }: { onError: (mensaje: string) => void }) {
  const { loginConGoogle } = useAuth();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [entrando, setEntrando] = useState(false);

  if (!GOOGLE_WEB_CLIENT_ID) return null;

  const entrar = async () => {
    haptics.tap();
    setEntrando(true);
    try {
      await GoogleSignin.hasPlayServices();
      const respuesta = await GoogleSignin.signIn();
      if (respuesta.type !== 'success' || !respuesta.data.idToken) return;
      await loginConGoogle(respuesta.data.idToken);
      haptics.success();
    } catch (error) {
      if (isErrorWithCode(error) && error.code === statusCodes.SIGN_IN_CANCELLED) return;
      haptics.error();
      onError('No se pudo iniciar sesión con Google. Intenta de nuevo.');
    } finally {
      setEntrando(false);
    }
  };

  return (
    <Pressable
      style={[styles.button, entrando && styles.buttonDisabled]}
      disabled={entrando}
      onPress={entrar}>
      {entrando ? (
        <ActivityIndicator color={colors.brandDeep} />
      ) : (
        <Text style={styles.text}>Continuar con Google</Text>
      )}
    </Pressable>
  );
}

function createStyles(colors: ColorPalette) {
  return StyleSheet.create({
    button: {
      borderWidth: 1,
      borderColor: colors.line,
      backgroundColor: colors.card,
      borderRadius: Radius.lg,
      paddingVertical: Spacing.four,
      alignItems: 'center',
      marginTop: Spacing.three,
    },
    buttonDisabled: { opacity: 0.5 },
    text: { fontFamily: Fonts.sansSemiBold, fontSize: 14.5, color: colors.ink },
  });
}
