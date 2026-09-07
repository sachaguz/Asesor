import * as AuthSession from 'expo-auth-session';
import * as Crypto from 'expo-crypto';
import * as WebBrowser from 'expo-web-browser';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text } from 'react-native';

import { Fonts, Radius, Spacing, type ColorPalette } from '@/constants/theme';
import { useAuth } from '@/hooks/use-auth';
import { useTheme } from '@/hooks/use-theme';
import { haptics } from '@/lib/haptics';

WebBrowser.maybeCompleteAuthSession();

const GOOGLE_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;

// Flujo OIDC implícito genérico (sin client secret, funciona en el
// navegador tal cual venimos probando): pedimos directo un id_token, no un
// código para intercambiar. Google exige "nonce" para este response_type.
const discovery = {
  authorizationEndpoint: 'https://accounts.google.com/o/oauth2/v2/auth',
};

export function GoogleSignInButton({ onError }: { onError: (mensaje: string) => void }) {
  const { loginConGoogle } = useAuth();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [entrando, setEntrando] = useState(false);
  const [nonce] = useState(() => Crypto.randomUUID());

  const [request, response, promptAsync] = AuthSession.useAuthRequest(
    {
      clientId: GOOGLE_CLIENT_ID ?? '',
      scopes: ['openid', 'profile', 'email'],
      redirectUri: AuthSession.makeRedirectUri(),
      responseType: AuthSession.ResponseType.IdToken,
      usePKCE: false,
      extraParams: { nonce },
    },
    discovery
  );

  useEffect(() => {
    if (response?.type !== 'success') return;
    const idToken = response.params.id_token;
    if (!idToken) return;
    setEntrando(true);
    loginConGoogle(idToken)
      .then(() => haptics.success())
      .catch(() => {
        haptics.error();
        onError('No se pudo iniciar sesión con Google. Intenta de nuevo.');
      })
      .finally(() => setEntrando(false));
  }, [response, loginConGoogle, onError]);

  if (!GOOGLE_CLIENT_ID) return null;

  return (
    <Pressable
      style={[styles.button, (!request || entrando) && styles.buttonDisabled]}
      disabled={!request || entrando}
      onPress={() => {
        haptics.tap();
        promptAsync();
      }}>
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
