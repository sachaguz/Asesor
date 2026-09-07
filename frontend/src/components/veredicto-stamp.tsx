import { StyleSheet, Text, View } from 'react-native';

import type { Veredicto } from '@/api/types';
import { Fonts, Radius, Spacing, type ColorPalette } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

function crearConfig(colors: ColorPalette): Record<Veredicto, { label: string; dot: string; ink: string; bg: string }> {
  return {
    RESURTE: { label: 'Resurte', dot: colors.resurte, ink: colors.resurteInk, bg: colors.resurteBg },
    NO_PIDAS: { label: 'No pidas', dot: colors.nopidas, ink: colors.nopidasInk, bg: colors.nopidasBg },
    VIGILA: { label: 'Vigila', dot: colors.vigila, ink: colors.vigilaInk, bg: colors.vigilaBg },
  };
}

export function VeredictoStamp({ veredicto }: { veredicto: Veredicto }) {
  const { colors } = useTheme();
  const cfg = crearConfig(colors)[veredicto];
  return (
    <View style={[styles.stamp, { backgroundColor: cfg.bg }]}>
      <View style={[styles.dot, { backgroundColor: cfg.dot }]} />
      <Text style={[styles.label, { color: cfg.ink }]}>{cfg.label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  stamp: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    alignSelf: 'flex-start',
    paddingHorizontal: Spacing.three,
    paddingVertical: 6,
    borderRadius: Radius.pill,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  label: {
    fontFamily: Fonts.sansSemiBold,
    fontSize: 12,
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
});
