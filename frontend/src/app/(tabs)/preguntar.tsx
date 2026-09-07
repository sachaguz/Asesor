import { Ionicons } from '@expo/vector-icons';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import Animated, { FadeIn, FadeInUp, FadeOut } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { api, ApiError } from '@/api/client';
import type { ChatMessage } from '@/api/types';
import { Mascot, MascotAvatar } from '@/components/mascot';
import { SettingsButton } from '@/components/settings-button';
import { Fonts, Radius, Spacing, type ColorPalette } from '@/constants/theme';
import { useBusinessId } from '@/hooks/use-business-id';
import { useTheme } from '@/hooks/use-theme';
import { useTour } from '@/hooks/use-tour';
import { haptics } from '@/lib/haptics';

const SUGERENCIAS = [
  '¿Qué se vende mejor?',
  '¿Qué no debería volver a pedir?',
  '¿Cómo van mis ventas esta semana?',
];

export default function PreguntarScreen() {
  const { businessId } = useBusinessId();
  const { registerTarget } = useTour();
  const queryClient = useQueryClient();
  const tabBarHeight = useBottomTabBarHeight();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [mensaje, setMensaje] = useState('');

  const chatQuery = useQuery({
    queryKey: ['chat', businessId],
    queryFn: () => api.obtenerChat(businessId as number),
    enabled: businessId != null,
  });

  const enviarMutation = useMutation({
    mutationFn: (texto: string) => api.enviarMensajeChat(businessId as number, texto),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['chat', businessId] }),
    onError: () => haptics.error(),
  });

  const enviar = () => {
    const texto = mensaje.trim();
    if (!texto || enviarMutation.isPending) return;
    haptics.tap();
    setMensaje('');
    enviarMutation.mutate(texto);
  };

  const preguntarSugerida = (texto: string) => {
    if (enviarMutation.isPending) return;
    haptics.tap();
    enviarMutation.mutate(texto);
  };

  if (businessId == null) return null;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <MascotAvatar size={40} />
          <View>
            <Text style={styles.headerName}>Dato</Text>
            <Text style={styles.headerSubtitle}>Tu analista de negocio</Text>
          </View>
        </View>
        <SettingsButton />
      </View>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={tabBarHeight}>
        <View style={styles.flex} ref={(node) => registerTarget('preguntar', node)}>
          <FlatList
            data={chatQuery.data ?? []}
            keyExtractor={(item) => String(item.id)}
            contentContainerStyle={styles.listContent}
            renderItem={({ item }) => <Bubble item={item} styles={styles} />}
            ListEmptyComponent={
              chatQuery.isLoading ? (
                <ActivityIndicator color={colors.brand} style={styles.loading} />
              ) : (
                <View style={styles.emptyState}>
                  <Mascot pose="neutral" size={56} />
                  <Text style={styles.empty}>Pregúntame lo que quieras sobre tu negocio.</Text>
                  <View style={styles.chipRow}>
                    {SUGERENCIAS.map((sugerencia) => (
                      <Pressable
                        key={sugerencia}
                        style={styles.chip}
                        disabled={enviarMutation.isPending}
                        onPress={() => preguntarSugerida(sugerencia)}>
                        <Text style={styles.chipTexto}>{sugerencia}</Text>
                      </Pressable>
                    ))}
                  </View>
                </View>
              )
            }
            ListFooterComponent={
              enviarMutation.isPending ? (
                <Animated.View
                  entering={FadeIn.duration(150)}
                  exiting={FadeOut.duration(120)}
                  style={styles.typingBubble}>
                  <Mascot pose="thinking" size={32} />
                </Animated.View>
              ) : null
            }
          />
        </View>
        {enviarMutation.isError && (
          <Text style={styles.errorLimite}>
            {enviarMutation.error instanceof ApiError
              ? enviarMutation.error.message
              : 'No se pudo enviar el mensaje. Intenta de nuevo.'}
          </Text>
        )}
        <View style={styles.askRow}>
          <TextInput
            style={styles.input}
            placeholder="Escribe tu pregunta…"
            placeholderTextColor={colors.inkSoft}
            value={mensaje}
            onChangeText={setMensaje}
            onSubmitEditing={enviar}
          />
          <Pressable style={styles.sendButton} onPress={enviar} disabled={enviarMutation.isPending}>
            {enviarMutation.isPending ? (
              <ActivityIndicator color={colors.white} size="small" />
            ) : (
              <Ionicons name="arrow-up" size={18} color={colors.white} />
            )}
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Bubble({ item, styles }: { item: ChatMessage; styles: ReturnType<typeof createStyles> }) {
  const esMio = item.role === 'USER';
  return (
    <Animated.View
      entering={FadeInUp.duration(220).springify().damping(18)}
      style={[styles.bubble, esMio ? styles.bubbleMe : styles.bubbleAi]}>
      <Text style={esMio ? styles.bubbleTextMe : styles.bubbleTextAi}>{item.contenido}</Text>
    </Animated.View>
  );
}

function createStyles(colors: ColorPalette) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    flex: { flex: 1 },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: Spacing.four,
      paddingBottom: Spacing.three,
      borderBottomWidth: 1,
      borderBottomColor: colors.line,
    },
    headerLeft: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
    headerName: { fontFamily: Fonts.serifSemiBold, fontSize: 16, color: colors.ink },
    headerSubtitle: { fontFamily: Fonts.sansRegular, fontSize: 12.5, color: colors.inkSoft, marginTop: 1 },
    listContent: { padding: Spacing.four, gap: Spacing.two },
    loading: { marginTop: Spacing.six },
    emptyState: {
      alignItems: 'center',
      marginTop: Spacing.six,
      paddingHorizontal: Spacing.four,
    },
    empty: {
      fontFamily: Fonts.sansRegular,
      fontSize: 14,
      color: colors.inkSoft,
      textAlign: 'center',
      marginTop: Spacing.three,
      marginBottom: Spacing.four,
    },
    typingBubble: {
      alignSelf: 'flex-start',
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.line,
      borderRadius: Radius.lg,
      borderBottomLeftRadius: 4,
      paddingHorizontal: Spacing.three,
      paddingVertical: 6,
      marginTop: 2,
    },
    chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two, justifyContent: 'center' },
    chip: {
      borderWidth: 1,
      borderColor: colors.line,
      backgroundColor: colors.card,
      borderRadius: Radius.pill,
      paddingHorizontal: Spacing.four,
      paddingVertical: Spacing.two,
    },
    chipTexto: { fontFamily: Fonts.sansMedium, fontSize: 13, color: colors.brandDeep },
    errorLimite: {
      fontFamily: Fonts.sansRegular,
      fontSize: 12.5,
      color: colors.nopidas,
      textAlign: 'center',
      marginHorizontal: Spacing.four,
      marginBottom: Spacing.two,
    },
    bubble: {
      maxWidth: '82%',
      paddingHorizontal: Spacing.three,
      paddingVertical: Spacing.two,
      borderRadius: Radius.lg,
      marginBottom: Spacing.two,
    },
    bubbleMe: {
      backgroundColor: colors.brand,
      alignSelf: 'flex-end',
      borderBottomRightRadius: 4,
    },
    bubbleAi: {
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.line,
      alignSelf: 'flex-start',
      borderBottomLeftRadius: 4,
    },
    bubbleTextMe: { fontFamily: Fonts.sansRegular, fontSize: 14, color: colors.white, lineHeight: 20 },
    bubbleTextAi: { fontFamily: Fonts.sansRegular, fontSize: 14, color: colors.ink, lineHeight: 20 },
    askRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.two,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.line,
      borderRadius: Radius.pill,
      marginHorizontal: Spacing.four,
      marginBottom: Spacing.four,
      paddingHorizontal: Spacing.four,
      paddingVertical: Spacing.two,
    },
    input: { flex: 1, fontFamily: Fonts.sansRegular, fontSize: 14, color: colors.ink },
    sendButton: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: colors.brand,
      alignItems: 'center',
      justifyContent: 'center',
    },
  });
}
