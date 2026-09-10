import { Ionicons } from '@expo/vector-icons';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
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
import Animated, { Easing, FadeIn, FadeInDown, FadeOut, LinearTransition } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { api, ApiError } from '@/api/client';
import type { Advice } from '@/api/types';
import { LoadingCard } from '@/components/loading-card';
import { Mascot } from '@/components/mascot';
import { SettingsButton } from '@/components/settings-button';
import { VeredictoStamp } from '@/components/veredicto-stamp';
import { Fonts, Radius, Spacing, type ColorPalette } from '@/constants/theme';
import { useBusinessId } from '@/hooks/use-business-id';
import { useSubscription } from '@/hooks/use-subscription';
import { useTheme } from '@/hooks/use-theme';
import { useTour } from '@/hooks/use-tour';
import { haptics } from '@/lib/haptics';
import { refrescarWidgetPregunta } from '@/widgets/refresh';

/** "Martes 25 de agosto" — para el saludo de arriba de todo, ligado al
 * nombre de la sección ("Hoy"). */
function formatearFechaHoy(): string {
  const texto = new Intl.DateTimeFormat('es-AR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(new Date());
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

/** YYYY-MM-DD en la zona horaria local (a diferencia de `toISOString`, que
 * usa UTC y puede correr el día) — para comparar contra la fecha, también
 * date-only, que manda el backend. */
function fechaIsoLocal(fecha: Date): string {
  return new Intl.DateTimeFormat('en-CA').format(fecha);
}

/** El resumen de ventas ya no asume que el usuario carga todos los días —
 * muestra el último día con ventas, sea "Ayer", "Hoy" o una fecha de hace
 * rato. */
function etiquetaResumenVentas(fechaIso: string): string {
  const hoy = new Date();
  const ayer = new Date(hoy);
  ayer.setDate(hoy.getDate() - 1);
  if (fechaIso === fechaIsoLocal(hoy)) return 'Hoy';
  if (fechaIso === fechaIsoLocal(ayer)) return 'Ayer';
  return new Intl.DateTimeFormat('es-AR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(new Date(`${fechaIso}T00:00:00`));
}

export default function HoyScreen() {
  const { businessId } = useBusinessId();
  const { registerTarget } = useTour();
  const router = useRouter();
  const queryClient = useQueryClient();
  const tabBarHeight = useBottomTabBarHeight();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [respuestaPregunta, setRespuestaPregunta] = useState('');
  const { suscrito } = useSubscription();

  const resumenAyerQuery = useQuery({
    queryKey: ['resumen-ayer', businessId],
    queryFn: () => api.resumenVentasDeAyer(businessId as number),
    enabled: businessId != null,
  });

  // Mismo queryKey que usa `useInstagram` en la pantalla Redes — comparten
  // caché, así que conectar/sincronizar desde ahí también actualiza esto.
  const instagramQuery = useQuery({
    queryKey: ['instagram', businessId],
    queryFn: async () => {
      try {
        return await api.obtenerCuentaInstagram(businessId as number);
      } catch (err) {
        if (err instanceof ApiError && err.status === 404) return null;
        throw err;
      }
    },
    enabled: businessId != null && suscrito,
  });

  const adviceQuery = useQuery({
    queryKey: ['advice', businessId],
    queryFn: () => api.obtenerConsejos(businessId as number),
    enabled: businessId != null,
  });

  const preguntaQuery = useQuery({
    queryKey: ['daily-question', businessId],
    // Si no hay pregunta pendiente, se genera una — el backend ya es
    // idempotente (una pregunta a la vez), así que es seguro pedirla acá.
    queryFn: async () => {
      const actual = await api.preguntaDelDiaActual(businessId as number);
      return actual ?? api.generarPreguntaDelDia(businessId as number);
    },
    enabled: businessId != null,
  });

  const generarMutation = useMutation({
    mutationFn: () => api.generarConsejos(businessId as number),
    onSuccess: (data) => {
      haptics.success();
      queryClient.setQueryData(['advice', businessId], data);
    },
    onError: () => haptics.error(),
  });

  const responderMutation = useMutation({
    mutationFn: (respuesta: string) =>
      api.responderPreguntaDelDia(businessId as number, preguntaQuery.data!.id, respuesta),
    onSuccess: () => {
      haptics.success();
      setRespuestaPregunta('');
      queryClient.setQueryData(['daily-question', businessId], null);
      refrescarWidgetPregunta();
    },
    onError: () => haptics.error(),
  });

  if (businessId == null) return null;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={tabBarHeight}>
      <FlatList
        data={adviceQuery.data ?? []}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={
          <>
            <Text style={styles.saludoFecha}>{formatearFechaHoy()}</Text>
            <View style={styles.headerRow}>
              <View style={styles.flexShrink} ref={(node) => registerTarget('hoy', node)}>
                <Text style={styles.lead}>Tus consejos de hoy</Text>
                <Text style={styles.subtle}>Toca cualquiera para ver por qué.</Text>
              </View>
              <SettingsButton />
            </View>

            <View style={styles.resumenCard}>
              <Text style={styles.resumenEyebrow}>
                {resumenAyerQuery.data?.fecha
                  ? etiquetaResumenVentas(resumenAyerQuery.data.fecha)
                  : 'Ventas'}
              </Text>
              {resumenAyerQuery.isLoading ? (
                <ActivityIndicator color={colors.brand} style={styles.resumenLoading} />
              ) : resumenAyerQuery.data?.fecha ? (
                <>
                  <Text style={styles.resumenMonto}>
                    ${Number(resumenAyerQuery.data.monto).toLocaleString('es-MX', {
                      maximumFractionDigits: 0,
                    })}
                  </Text>
                  <Text style={styles.resumenHint}>
                    {resumenAyerQuery.data.unidades}{' '}
                    {resumenAyerQuery.data.unidades === 1 ? 'unidad vendida' : 'unidades vendidas'}
                  </Text>
                </>
              ) : (
                <Text style={styles.resumenHint}>Todavía no registraste ventas.</Text>
              )}
            </View>

            {suscrito && (
              <Pressable
                style={styles.redesCard}
                onPress={() => {
                  haptics.tap();
                  router.navigate('/(tabs)/redes');
                }}>
                {instagramQuery.data ? (
                  <>
                    <Ionicons name="flame" size={20} color={colors.vigila} />
                    <View style={styles.flexShrink}>
                      <Text style={styles.redesCardTitulo}>
                        {instagramQuery.data.racha_actual}{' '}
                        {instagramQuery.data.racha_actual === 1 ? 'día seguido' : 'días seguidos'}{' '}
                        publicando
                      </Text>
                      <Text style={styles.redesCardHint}>
                        Mejor racha: {instagramQuery.data.racha_maxima} días
                      </Text>
                    </View>
                  </>
                ) : (
                  <>
                    <Ionicons name="logo-instagram" size={20} color={colors.brand} />
                    <View style={styles.flexShrink}>
                      <Text style={styles.redesCardTitulo}>Conectá tu Instagram</Text>
                      <Text style={styles.redesCardHint}>Arrancá tu racha diaria de publicaciones.</Text>
                    </View>
                  </>
                )}
                <Ionicons name="chevron-forward" size={18} color={colors.inkSoft} />
              </Pressable>
            )}

            {preguntaQuery.data && (
              <View style={styles.pregunta}>
                <Text style={styles.preguntaEyebrow}>Pregunta del día</Text>
                <Text style={styles.preguntaTexto}>{preguntaQuery.data.pregunta}</Text>
                <TextInput
                  style={styles.preguntaInput}
                  placeholder="Tu respuesta…"
                  placeholderTextColor="#a89a86"
                  value={respuestaPregunta}
                  onChangeText={setRespuestaPregunta}
                />
                <Pressable
                  style={[
                    styles.preguntaBoton,
                    (!respuestaPregunta.trim() || responderMutation.isPending) &&
                      styles.botonDisabled,
                  ]}
                  disabled={!respuestaPregunta.trim() || responderMutation.isPending}
                  onPress={() => {
                    haptics.tap();
                    responderMutation.mutate(respuestaPregunta.trim());
                  }}>
                  <Text style={styles.preguntaBotonTexto}>
                    {responderMutation.isPending ? 'Enviando…' : 'Responder'}
                  </Text>
                </Pressable>
              </View>
            )}

            {generarMutation.isPending ? (
              <LoadingCard mensaje="Estoy pensando tus consejos…" />
            ) : (adviceQuery.data ?? []).length === 0 ? (
              <Pressable
                style={styles.generarBoton}
                onPress={() => {
                  haptics.tap();
                  generarMutation.mutate();
                }}>
                <Text style={styles.generarBotonTexto}>Generar consejos de hoy</Text>
              </Pressable>
            ) : null}
            {generarMutation.isError && (
              <Text style={styles.error}>No se pudieron generar los consejos. Intenta de nuevo.</Text>
            )}
          </>
        }
        renderItem={({ item, index }) => (
          <AdviceCard
            item={item}
            index={index}
            expanded={expandedId === item.id}
            styles={styles}
            onToggle={() => {
              haptics.select();
              setExpandedId(expandedId === item.id ? null : item.id);
            }}
          />
        )}
        ListEmptyComponent={
          adviceQuery.isLoading ? (
            <ActivityIndicator color={colors.brand} style={styles.loading} />
          ) : (
            <View style={styles.emptyState}>
              <Mascot pose="neutral" size={72} />
              <Text style={styles.emptyTitle}>Todavía no tengo nada que decirte</Text>
              <Text style={styles.emptyText}>
                Cuanto más sepa de tu negocio — tus ventas, y lo que me cuentes en “Mi negocio” —
                mejores consejos te puedo dar. No solo de qué surtir: precios, temporadas,
                clientes, lo que haga falta. Arranquemos con tus ventas.
              </Text>
              <Pressable
                style={styles.emptyBoton}
                onPress={() => {
                  haptics.tap();
                  router.navigate('/(tabs)/negocio');
                }}>
                <Ionicons name="cloud-upload-outline" size={16} color={colors.white} />
                <Text style={styles.emptyBotonTexto}>Importar mis ventas</Text>
              </Pressable>
            </View>
          )
        }
      />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const _VEREDICTO_LABEL: Record<string, string> = {
  RESURTE: 'Resurte',
  NO_PIDAS: 'No pidas',
  VIGILA: 'Vigila',
};

/** `datos_que_lo_respaldan` trae las claves crudas que usan las reglas
 * (`unidades_vendidas`, `pct_variantes_vendidas`, etc.) — acá se traducen a
 * texto legible en vez de mostrarlas tal cual. Las claves que no se
 * reconocen igual se muestran (con el guión bajo cambiado por espacio) en
 * vez de desaparecer, por si se agrega una señal nueva más adelante. */
function formatearDato(clave: string, valor: unknown): { etiqueta: string; texto: string } {
  switch (clave) {
    case 'unidades_vendidas':
      return { etiqueta: 'Unidades vendidas', texto: String(valor) };
    case 'dias_desde_ultima_venta':
      return {
        etiqueta: 'Última venta',
        texto: valor == null ? 'sin ventas registradas' : `hace ${valor} ${valor === 1 ? 'día' : 'días'}`,
      };
    case 'pct_variantes_vendidas':
      return { etiqueta: 'Variantes que se vendieron', texto: `${Math.round(Number(valor) * 100)}%` };
    case 'velocidad_venta':
      return { etiqueta: 'Ritmo de venta', texto: `${Number(valor).toFixed(1)} por día` };
    case 'sugerencia_reglas':
      return {
        etiqueta: 'Sugerencia de las reglas',
        texto: _VEREDICTO_LABEL[String(valor)] ?? String(valor),
      };
    default:
      return { etiqueta: clave.replace(/_/g, ' '), texto: String(valor) };
  }
}

function AdviceCard({
  item,
  index,
  expanded,
  styles,
  onToggle,
}: {
  item: Advice;
  index: number;
  expanded: boolean;
  styles: ReturnType<typeof createStyles>;
  onToggle: () => void;
}) {
  // El cleanup de las animaciones de layout de Reanimated en web (no nativo)
  // puede leer la posición de un nodo ya desmontado y tirar
  // "Cannot read properties of undefined (reading 'top')" — se desactivan
  // entering/layout en web para esta tarjeta y se deja la versión nativa
  // (ya validada en celular) intacta.
  const animProps =
    Platform.OS === 'web'
      ? {}
      : {
          entering: FadeInDown.delay(index * 60)
            .duration(320)
            .easing(Easing.out(Easing.cubic))
            .withInitialValues({ transform: [{ translateY: 10 }] }),
          layout: LinearTransition.duration(220).easing(Easing.out(Easing.cubic)),
        };

  return (
    <Animated.View {...animProps} style={styles.card}>
      <Pressable onPress={onToggle}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardProducto}>{item.producto}</Text>
          <VeredictoStamp veredicto={item.veredicto} />
        </View>
        <Text style={styles.cardTexto}>{item.texto}</Text>
        {expanded && (
          <Animated.View
            entering={FadeIn.duration(180)}
            exiting={FadeOut.duration(120)}
            style={styles.cardDetalle}>
            <Text style={styles.cardDetalleTitulo}>Datos que lo respaldan</Text>
            {Object.entries(item.datos_que_lo_respaldan)
              .filter(([clave]) => clave !== 'contexto_usado')
              .map(([clave, valor]) => {
                const dato = formatearDato(clave, valor);
                return (
                  <Text key={clave} style={styles.cardDetalleLinea}>
                    <Text style={styles.cardDetalleEtiqueta}>{dato.etiqueta}: </Text>
                    {dato.texto}
                  </Text>
                );
              })}
          </Animated.View>
        )}
      </Pressable>
    </Animated.View>
  );
}

function createStyles(colors: ColorPalette) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    flex: { flex: 1 },
    listContent: { padding: Spacing.four, paddingBottom: Spacing.eight },
    headerRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
    loading: { marginTop: Spacing.six },
    lead: {
      fontFamily: Fonts.serifSemiBold,
      fontSize: 22,
      color: colors.ink,
      marginTop: Spacing.two,
    },
    subtle: {
      fontFamily: Fonts.sansRegular,
      fontSize: 13.5,
      color: colors.inkSoft,
      marginTop: 4,
      marginBottom: Spacing.four,
    },
    saludoFecha: {
      fontFamily: Fonts.sansSemiBold,
      fontSize: 12.5,
      letterSpacing: 0.3,
      color: colors.inkSoft,
      textTransform: 'capitalize',
    },
    resumenCard: {
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.line,
      borderRadius: Radius.xl,
      padding: Spacing.four,
      marginBottom: Spacing.three,
    },
    resumenEyebrow: {
      fontFamily: Fonts.sansSemiBold,
      fontSize: 11,
      letterSpacing: 0.6,
      textTransform: 'uppercase',
      color: colors.inkSoft,
      marginBottom: Spacing.one,
    },
    resumenMonto: {
      fontFamily: Fonts.serifSemiBold,
      fontSize: 26,
      color: colors.ink,
    },
    resumenHint: {
      fontFamily: Fonts.sansRegular,
      fontSize: 13,
      color: colors.inkSoft,
      marginTop: 2,
    },
    resumenLoading: { alignSelf: 'flex-start', marginTop: Spacing.one },
    redesCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.three,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.line,
      borderRadius: Radius.xl,
      padding: Spacing.four,
      marginBottom: Spacing.four,
    },
    redesCardTitulo: { fontFamily: Fonts.sansSemiBold, fontSize: 14, color: colors.ink },
    redesCardHint: {
      fontFamily: Fonts.sansRegular,
      fontSize: 12.5,
      color: colors.inkSoft,
      marginTop: 2,
    },
    flexShrink: { flexShrink: 1 },
    pregunta: {
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.brand,
      borderRadius: Radius.xl,
      padding: Spacing.four,
      marginBottom: Spacing.four,
    },
    preguntaEyebrow: {
      fontFamily: Fonts.sansSemiBold,
      fontSize: 11,
      letterSpacing: 0.6,
      textTransform: 'uppercase',
      color: colors.brandDeep,
      marginBottom: Spacing.two,
    },
    preguntaTexto: {
      fontFamily: Fonts.serifMedium,
      fontSize: 17,
      color: colors.ink,
      marginBottom: Spacing.three,
    },
    preguntaInput: {
      borderWidth: 1,
      borderColor: colors.line,
      borderRadius: Radius.md,
      paddingHorizontal: Spacing.three,
      paddingVertical: Spacing.two,
      fontFamily: Fonts.sansRegular,
      fontSize: 14,
      color: colors.ink,
      backgroundColor: colors.paper,
      marginBottom: Spacing.two,
    },
    preguntaBoton: {
      backgroundColor: colors.brand,
      borderRadius: Radius.md,
      paddingVertical: Spacing.two,
      alignItems: 'center',
      alignSelf: 'flex-start',
      paddingHorizontal: Spacing.four,
    },
    preguntaBotonTexto: { fontFamily: Fonts.sansSemiBold, fontSize: 13.5, color: colors.white },
    generarBoton: {
      backgroundColor: colors.brand,
      borderRadius: Radius.lg,
      paddingVertical: Spacing.three,
      alignItems: 'center',
      marginBottom: Spacing.four,
    },
    generarBotonTexto: { fontFamily: Fonts.sansSemiBold, fontSize: 14.5, color: colors.white },
    botonDisabled: { opacity: 0.5 },
    error: {
      color: colors.nopidas,
      fontFamily: Fonts.sansRegular,
      fontSize: 12.5,
      marginBottom: Spacing.three,
    },
    card: {
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.line,
      borderRadius: Radius.xl,
      padding: Spacing.four,
      marginBottom: Spacing.three,
    },
    cardHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: Spacing.two,
    },
    cardProducto: {
      fontFamily: Fonts.serifMedium,
      fontSize: 15.5,
      color: colors.ink,
      flexShrink: 1,
    },
    cardTexto: {
      fontFamily: Fonts.sansRegular,
      fontSize: 14,
      lineHeight: 20,
      color: colors.inkBody,
      marginTop: Spacing.three,
    },
    cardDetalle: {
      marginTop: Spacing.three,
      paddingTop: Spacing.three,
      borderTopWidth: 1,
      borderTopColor: colors.line,
      borderStyle: 'dashed',
    },
    cardDetalleTitulo: {
      fontFamily: Fonts.sansSemiBold,
      fontSize: 11,
      letterSpacing: 0.5,
      textTransform: 'uppercase',
      color: colors.inkSoft,
      marginBottom: Spacing.two,
    },
    cardDetalleLinea: {
      fontFamily: Fonts.sansRegular,
      fontSize: 12.5,
      color: colors.inkSoft,
      marginBottom: 2,
    },
    cardDetalleEtiqueta: {
      fontFamily: Fonts.sansSemiBold,
    },
    emptyState: {
      alignItems: 'center',
      marginTop: Spacing.seven,
      paddingHorizontal: Spacing.four,
    },
    emptyTitle: {
      marginTop: Spacing.four,
      fontFamily: Fonts.serifSemiBold,
      fontSize: 17,
      color: colors.ink,
      textAlign: 'center',
      marginBottom: Spacing.two,
    },
    emptyText: {
      fontFamily: Fonts.sansRegular,
      fontSize: 14,
      color: colors.inkSoft,
      textAlign: 'center',
      lineHeight: 20,
      marginBottom: Spacing.five,
    },
    emptyBoton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      backgroundColor: colors.brand,
      borderRadius: Radius.md,
      paddingHorizontal: Spacing.five,
      paddingVertical: Spacing.three,
    },
    emptyBotonTexto: { fontFamily: Fonts.sansSemiBold, fontSize: 13.5, color: colors.white },
  });
}
