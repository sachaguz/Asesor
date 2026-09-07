import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Rect } from 'react-native-svg';

import type { InstagramDailyMetric } from '@/api/types';
import { Fonts, Spacing, type ColorPalette } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

const ALTO = 90;
const ANCHO_BARRA = 28;
const GAP = 10;

/** Barras del alcance diario, últimos 7 días — a propósito sin librería de
 * charts (react-native-svg ya es dependencia del proyecto, y una barra
 * simple no justifica sumar un paquete nuevo con su propio riesgo de
 * versión, como pasó hoy con @expo/ui). */
export function MetricsChart({ metricas }: { metricas: InstagramDailyMetric[] }) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const dias = useMemo(() => [...metricas].reverse(), [metricas]);
  const maximo = Math.max(...dias.map((d) => d.reach), 1);
  const ancho = dias.length * ANCHO_BARRA + Math.max(dias.length - 1, 0) * GAP;

  if (dias.length === 0) return null;

  return (
    <View style={styles.wrap}>
      <Text style={styles.titulo}>Alcance — últimos {dias.length} días</Text>
      <Svg width={ancho} height={ALTO + 20}>
        {dias.map((dia, i) => {
          const alto = Math.max((dia.reach / maximo) * ALTO, 3);
          const x = i * (ANCHO_BARRA + GAP);
          return (
            <Rect
              key={dia.fecha}
              x={x}
              y={ALTO - alto}
              width={ANCHO_BARRA}
              height={alto}
              rx={4}
              fill={colors.brand}
            />
          );
        })}
      </Svg>
      <View style={[styles.etiquetas, { width: ancho }]}>
        {dias.map((dia) => (
          <Text key={dia.fecha} style={styles.etiqueta}>
            {formatearDia(dia.fecha)}
          </Text>
        ))}
      </View>
    </View>
  );
}

function formatearDia(fechaIso: string): string {
  const [, mes, dia] = fechaIso.split('-');
  return `${dia}/${mes}`;
}

function createStyles(colors: ColorPalette) {
  return StyleSheet.create({
    wrap: { alignItems: 'center' },
    titulo: {
      fontFamily: Fonts.sansSemiBold,
      fontSize: 12,
      color: colors.inkSoft,
      alignSelf: 'flex-start',
      marginBottom: Spacing.two,
    },
    etiquetas: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 },
    etiqueta: {
      fontFamily: Fonts.sansRegular,
      fontSize: 10,
      color: colors.inkSoft,
      width: ANCHO_BARRA,
      textAlign: 'center',
    },
  });
}
