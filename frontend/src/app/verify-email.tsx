import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { api } from '@/api/client';
import { Fonts, Radius, Spacing, type ColorPalette } from '@/constants/theme';
import { useAuth } from '@/hooks/use-auth';
import { useTheme } from '@/hooks/use-theme';
import { haptics } from '@/lib/haptics';

type Estado = 'verificando' | 'ok' | 'error';

export default function VerifyEmailScreen() {
  const { token } = useLocalSearchParams<{ token?: string }>();
  const router = useRouter();
  const { colors } = useTheme();
  const { refrescarPerfil } = useAuth();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [estado, setEstado] = useState<Estado>('verificando');

  useEffect(() => {
    if (!token) {
      setEstado('error');
      return;
    }
    api
      .verificarEmail(token)
      .then(async () => {
        // Si ya había sesión iniciada en este mismo dispositivo (lo más
        // común: se registró y confirma desde el mismo celular), el perfil
        // en memoria queda viejo hasta que se vuelve a pedir.
        await refrescarPerfil();
        haptics.success();
        setEstado('ok');
      })
      .catch(() => {
        haptics.error();
        setEstado('error');
      });
  }, [token, refrescarPerfil]);

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.content}>
        {estado === 'verificando' && <ActivityIndicator color={colors.brand} size="large" />}

        {estado === 'ok' && (
          <>
            <View style={styles.icono}>
              <Ionicons name="checkmark-circle" size={48} color={colors.resurte} />
            </View>
            <Text style={styles.titulo}>Correo verificado</Text>
            <Text style={styles.texto}>Ya podés seguir usando El Asesor con normalidad.</Text>
          </>
        )}

        {estado === 'error' && (
          <>
            <View style={styles.icono}>
              <Ionicons name="close-circle" size={48} color={colors.nopidas} />
            </View>
            <Text style={styles.titulo}>El enlace no es válido</Text>
            <Text style={styles.texto}>
              Puede que ya haya vencido. Podés pedir uno nuevo desde "Mi negocio" en la app.
            </Text>
          </>
        )}

        {estado !== 'verificando' && (
          <Pressable style={styles.boton} onPress={() => router.replace('/(tabs)')}>
            <Text style={styles.botonTexto}>Ir a la app</Text>
          </Pressable>
        )}
      </View>
    </SafeAreaView>
  );
}

function createStyles(colors: ColorPalette) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.paper },
    content: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: Spacing.six },
    icono: { marginBottom: Spacing.four },
    titulo: {
      fontFamily: Fonts.serifSemiBold,
      fontSize: 22,
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
    boton: {
      backgroundColor: colors.brand,
      borderRadius: Radius.lg,
      paddingVertical: Spacing.four,
      paddingHorizontal: Spacing.seven,
      alignItems: 'center',
    },
    botonTexto: { fontFamily: Fonts.sansSemiBold, fontSize: 15, color: colors.white },
  });
}
