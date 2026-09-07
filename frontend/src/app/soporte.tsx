import { Ionicons } from '@expo/vector-icons';
import * as Linking from 'expo-linking';
import { useMemo } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';

import { DocumentScreen, DocumentSection } from '@/components/document-screen';
import { Fonts, Radius, Spacing, type ColorPalette } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { haptics } from '@/lib/haptics';

const EMAIL_SOPORTE = 'soporte@elasesor.app';

export default function SoporteScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <DocumentScreen titulo="Soporte">
      <DocumentSection titulo="¿Cómo cancelo la suscripción de Redes?">
        Escribinos desde acá abajo pidiendo la cancelación — seguís teniendo acceso hasta el final
        del período ya pagado.
      </DocumentSection>
      <DocumentSection titulo="¿Cómo conecto mi Instagram?">
        Desde la pestaña Redes, botón "Conectar Instagram". Necesitás una cuenta de Instagram
        profesional (business o creador), no una personal.
      </DocumentSection>
      <DocumentSection titulo="¿Qué pasa con mis datos si borro mi cuenta?">
        Se borran para siempre junto con la cuenta: negocio, ventas, consejos, chat y la conexión
        con Instagram. No se puede deshacer.
      </DocumentSection>
      <DocumentSection titulo="La IA no entendió bien mi pregunta, ¿qué hago?">
        Probá reformularla con más detalle en la pestaña Preguntar. Si el problema sigue,
        contanos qué pasó — nos sirve para mejorar.
      </DocumentSection>

      <Pressable
        style={styles.boton}
        onPress={() => {
          haptics.tap();
          Linking.openURL(
            `mailto:${EMAIL_SOPORTE}?subject=${encodeURIComponent('Ayuda con El Asesor')}`
          );
        }}>
        <Ionicons name="mail-outline" size={18} color={colors.white} />
        <Text style={styles.botonTexto}>Escribinos a {EMAIL_SOPORTE}</Text>
      </Pressable>
    </DocumentScreen>
  );
}

function createStyles(colors: ColorPalette) {
  return StyleSheet.create({
    boton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: Spacing.two,
      backgroundColor: colors.brand,
      borderRadius: Radius.lg,
      paddingVertical: Spacing.four,
      marginTop: Spacing.two,
    },
    botonTexto: { fontFamily: Fonts.sansSemiBold, fontSize: 14.5, color: colors.white },
  });
}
