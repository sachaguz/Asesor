import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useMemo, type ComponentProps } from 'react';
import { Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CrownBadge } from '@/components/crown-badge';
import { Fonts, Radius, Spacing, type ColorPalette } from '@/constants/theme';
import { useSubscription } from '@/hooks/use-subscription';
import { useTheme } from '@/hooks/use-theme';
import { haptics } from '@/lib/haptics';

export default function ConfiguracionScreen() {
  const router = useRouter();
  const { colors, scheme, alternar } = useTheme();
  const { suscrito } = useSubscription();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Text style={styles.titulo}>Configuración</Text>
        <Pressable hitSlop={8} onPress={() => router.back()}>
          <Ionicons name="close" size={24} color={colors.inkSoft} />
        </Pressable>
      </View>

      {suscrito && (
        <View style={[styles.fila, styles.filaSuscripcion]}>
          <View style={[styles.filaIcono, styles.filaIconoDorado]}>
            <CrownBadge size={17} />
          </View>
          <View style={styles.flexShrink}>
            <Text style={styles.filaTitulo}>Redes activo</Text>
            <Text style={styles.filaHint}>
              Tenés acceso a métricas, racha diaria e ideas de contenido.
            </Text>
          </View>
        </View>
      )}

      <View style={styles.fila}>
        <View style={styles.filaIcono}>
          <Ionicons name="moon-outline" size={18} color={colors.brand} />
        </View>
        <View style={styles.flexShrink}>
          <Text style={styles.filaTitulo}>Modo oscuro</Text>
          <Text style={styles.filaHint}>Cambia la apariencia de toda la app.</Text>
        </View>
        <Switch
          value={scheme === 'dark'}
          onValueChange={() => {
            haptics.select();
            alternar();
          }}
          trackColor={{ false: colors.line, true: colors.brand }}
          thumbColor={colors.white}
        />
      </View>

      <Pressable
        style={styles.fila}
        onPress={() => {
          haptics.tap();
          router.push('/(tabs)/redes');
        }}>
        <View style={styles.filaIcono}>
          <Ionicons name="logo-instagram" size={18} color={colors.brand} />
        </View>
        <View style={styles.flexShrink}>
          <Text style={styles.filaTitulo}>Redes sociales</Text>
          <Text style={styles.filaHint}>Métricas, racha y conexión con Instagram.</Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color={colors.inkSoft} />
      </Pressable>

      <Text style={styles.seccionTitulo}>Legal y ayuda</Text>

      <MenuFila
        icono="document-text-outline"
        titulo="Términos y condiciones"
        onPress={() => router.push('/terminos')}
        colors={colors}
        styles={styles}
      />
      <MenuFila
        icono="shield-checkmark-outline"
        titulo="Privacidad"
        onPress={() => router.push('/privacidad')}
        colors={colors}
        styles={styles}
      />
      <MenuFila
        icono="help-circle-outline"
        titulo="Soporte"
        onPress={() => router.push('/soporte')}
        colors={colors}
        styles={styles}
      />
    </SafeAreaView>
  );
}

function MenuFila({
  icono,
  titulo,
  onPress,
  colors,
  styles,
}: {
  icono: ComponentProps<typeof Ionicons>['name'];
  titulo: string;
  onPress: () => void;
  colors: ColorPalette;
  styles: ReturnType<typeof createStyles>;
}) {
  return (
    <Pressable
      style={styles.fila}
      onPress={() => {
        haptics.tap();
        onPress();
      }}>
      <View style={styles.filaIcono}>
        <Ionicons name={icono} size={18} color={colors.brand} />
      </View>
      <Text style={[styles.filaTitulo, styles.flexShrink]}>{titulo}</Text>
      <Ionicons name="chevron-forward" size={18} color={colors.inkSoft} />
    </Pressable>
  );
}

function createStyles(colors: ColorPalette) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background, padding: Spacing.four },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: Spacing.five,
    },
    titulo: { fontFamily: Fonts.serifSemiBold, fontSize: 20, color: colors.ink },
    fila: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.three,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.line,
      borderRadius: Radius.lg,
      padding: Spacing.four,
      marginBottom: Spacing.three,
    },
    filaIcono: {
      width: 36,
      height: 36,
      borderRadius: Radius.md,
      backgroundColor: colors.brandSoft,
      alignItems: 'center',
      justifyContent: 'center',
    },
    filaSuscripcion: { borderColor: colors.vigila },
    filaIconoDorado: { backgroundColor: colors.vigilaBg },
    flexShrink: { flex: 1 },
    filaTitulo: { fontFamily: Fonts.sansSemiBold, fontSize: 14.5, color: colors.ink },
    filaHint: { fontFamily: Fonts.sansRegular, fontSize: 12, color: colors.inkSoft, marginTop: 2 },
    seccionTitulo: {
      fontFamily: Fonts.sansSemiBold,
      fontSize: 12.5,
      color: colors.inkSoft,
      textTransform: 'uppercase',
      letterSpacing: 0.4,
      marginTop: Spacing.two,
      marginBottom: Spacing.two,
    },
  });
}
