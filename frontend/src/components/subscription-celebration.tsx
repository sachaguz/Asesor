import { useMemo } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { BounceIn, FadeIn, FadeOut } from 'react-native-reanimated';

import { CrownBadge } from '@/components/crown-badge';
import { Mascot } from '@/components/mascot';
import { Fonts, Radius, Spacing, type ColorPalette } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { haptics } from '@/lib/haptics';

export function SubscriptionCelebration({
  visible,
  onDismiss,
}: {
  visible: boolean;
  onDismiss: () => void;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <Modal transparent visible={visible} animationType="none" onRequestClose={onDismiss}>
      <Animated.View entering={FadeIn.duration(220)} exiting={FadeOut.duration(180)} style={styles.scrim}>
        <Animated.View entering={BounceIn.duration(550)} style={styles.card}>
          <Mascot pose="happy" size={92} />
          <View style={styles.tituloRow}>
            <CrownBadge size={22} />
            <Text style={styles.titulo}>¡Ya sos parte de Redes!</Text>
          </View>
          <Text style={styles.texto}>
            Desbloqueaste tus métricas de Instagram, la racha diaria de publicaciones y una idea de
            contenido nueva cada día.
          </Text>
          <Pressable
            style={styles.boton}
            onPress={() => {
              haptics.tap();
              onDismiss();
            }}>
            <Text style={styles.botonTexto}>Genial</Text>
          </Pressable>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

function createStyles(colors: ColorPalette) {
  return StyleSheet.create({
    scrim: {
      flex: 1,
      backgroundColor: 'rgba(20, 18, 31, 0.55)',
      alignItems: 'center',
      justifyContent: 'center',
      padding: Spacing.six,
    },
    card: {
      backgroundColor: colors.card,
      borderRadius: Radius.xxl,
      padding: Spacing.seven,
      alignItems: 'center',
      maxWidth: 340,
      width: '100%',
    },
    tituloRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.two,
      marginTop: Spacing.four,
    },
    titulo: { fontFamily: Fonts.serifSemiBold, fontSize: 19, color: colors.ink, textAlign: 'center' },
    texto: {
      fontFamily: Fonts.sansRegular,
      fontSize: 14,
      color: colors.inkSoft,
      textAlign: 'center',
      lineHeight: 20,
      marginTop: Spacing.three,
      marginBottom: Spacing.five,
    },
    boton: {
      backgroundColor: colors.brand,
      borderRadius: Radius.lg,
      paddingVertical: Spacing.three,
      paddingHorizontal: Spacing.seven,
      alignItems: 'center',
    },
    botonTexto: { fontFamily: Fonts.sansSemiBold, fontSize: 15, color: colors.white },
  });
}
