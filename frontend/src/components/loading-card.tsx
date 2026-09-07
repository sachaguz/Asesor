import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Mascot } from '@/components/mascot';
import { Fonts, Radius, Spacing, type ColorPalette } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/** Reemplaza un spinner solo en las esperas largas (generar consejos, mandar
 * una pregunta) — el personaje "pensando" comunica que sigue vivo, no
 * trabado. */
export function LoadingCard({ mensaje }: { mensaje: string }) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return (
    <View style={styles.card}>
      <Mascot pose="thinking" size={72} />
      <Text style={styles.texto}>{mensaje}</Text>
    </View>
  );
}

function createStyles(colors: ColorPalette) {
  return StyleSheet.create({
    card: {
      alignItems: 'center',
      gap: Spacing.three,
      backgroundColor: colors.card,
      borderRadius: Radius.xl,
      padding: Spacing.six,
      marginBottom: Spacing.four,
    },
    texto: { fontFamily: Fonts.serifSemiBold, fontSize: 15, color: colors.ink, textAlign: 'center' },
  });
}
