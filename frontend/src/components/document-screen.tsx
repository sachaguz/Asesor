import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useMemo, type ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Fonts, Spacing, type ColorPalette } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/** Shell compartido por las pantallas de "documento" (Términos, Privacidad,
 * Soporte) — mismo header con volver que `eliminar-cuenta.tsx`, más un
 * scroll para el contenido de cada una. */
export function DocumentScreen({ titulo, children }: { titulo: string; children: ReactNode }) {
  const router = useRouter();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Pressable hitSlop={8} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={24} color={colors.inkSoft} />
        </Pressable>
        <Text style={styles.titulo}>{titulo}</Text>
        <View style={styles.headerSpacer} />
      </View>
      <ScrollView contentContainerStyle={styles.content}>{children}</ScrollView>
    </SafeAreaView>
  );
}

export function DocumentSection({ titulo, children }: { titulo: string; children: ReactNode }) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return (
    <View style={styles.seccion}>
      <Text style={styles.seccionTitulo}>{titulo}</Text>
      <Text style={styles.seccionTexto}>{children}</Text>
    </View>
  );
}

function createStyles(colors: ColorPalette) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: Spacing.four,
      paddingTop: Spacing.two,
      paddingBottom: Spacing.three,
    },
    titulo: { fontFamily: Fonts.serifSemiBold, fontSize: 17, color: colors.ink },
    headerSpacer: { width: 24 },
    content: { padding: Spacing.six, paddingTop: Spacing.two, gap: Spacing.five },
    seccion: { gap: Spacing.one },
    seccionTitulo: { fontFamily: Fonts.sansSemiBold, fontSize: 14.5, color: colors.ink },
    seccionTexto: {
      fontFamily: Fonts.sansRegular,
      fontSize: 13.5,
      color: colors.inkSoft,
      lineHeight: 20,
    },
  });
}
