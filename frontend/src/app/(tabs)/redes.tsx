import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { useMemo, useState, type ComponentProps } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { api, ApiError } from '@/api/client';
import type { InstagramMediaType, InstagramPatron } from '@/api/types';
import { CrownBadge } from '@/components/crown-badge';
import { MetricsChart } from '@/components/metrics-chart';
import { SettingsButton } from '@/components/settings-button';
import { SubscriptionCelebration } from '@/components/subscription-celebration';
import { Fonts, Radius, Spacing, type ColorPalette } from '@/constants/theme';
import { useBusinessId } from '@/hooks/use-business-id';
import { useSubscription } from '@/hooks/use-subscription';
import { useTheme } from '@/hooks/use-theme';
import { haptics } from '@/lib/haptics';
import { refrescarWidgetRacha } from '@/widgets/refresh';

const INSTAGRAM_DEEP_LINK = 'elasesor://instagram-connected';

function useInstagram(businessId: number | null | undefined) {
  const queryClient = useQueryClient();

  const cuentaQuery = useQuery({
    queryKey: ['instagram', businessId],
    queryFn: async () => {
      try {
        return await api.obtenerCuentaInstagram(businessId as number);
      } catch (err) {
        if (err instanceof ApiError && err.status === 404) return null;
        throw err;
      }
    },
    enabled: businessId != null,
  });

  const conectarMutation = useMutation({
    mutationFn: async () => {
      const { url } = await api.conectarInstagram(businessId as number);
      const resultado = await WebBrowser.openAuthSessionAsync(url, INSTAGRAM_DEEP_LINK);
      if (resultado.type !== 'success') return;
      const { queryParams } = Linking.parse(resultado.url);
      if (queryParams?.status !== 'ok') {
        const mensaje = typeof queryParams?.mensaje === 'string' ? queryParams.mensaje : null;
        throw new Error(mensaje ?? 'No se pudo conectar Instagram. Intenta de nuevo.');
      }
    },
    onSuccess: () => {
      haptics.success();
      queryClient.invalidateQueries({ queryKey: ['instagram', businessId] });
      refrescarWidgetRacha();
    },
    onError: () => haptics.error(),
  });

  const desconectarMutation = useMutation({
    mutationFn: () => api.desconectarInstagram(businessId as number),
    onSuccess: () => {
      haptics.success();
      queryClient.invalidateQueries({ queryKey: ['instagram', businessId] });
      refrescarWidgetRacha();
    },
    onError: () => haptics.error(),
  });

  const metricasQuery = useQuery({
    queryKey: ['instagram-metrics', businessId],
    queryFn: async () => {
      try {
        return await api.obtenerMetricasInstagram(businessId as number);
      } catch (err) {
        if (err instanceof ApiError && err.status === 404) return [];
        throw err;
      }
    },
    enabled: businessId != null && cuentaQuery.data != null,
  });

  const sincronizarMutation = useMutation({
    mutationFn: () => api.sincronizarInstagram(businessId as number),
    onSuccess: () => {
      haptics.success();
      queryClient.invalidateQueries({ queryKey: ['instagram', businessId] });
      queryClient.invalidateQueries({ queryKey: ['instagram-metrics', businessId] });
      queryClient.invalidateQueries({ queryKey: ['instagram-patterns', businessId] });
      refrescarWidgetRacha();
    },
    onError: () => haptics.error(),
  });

  const patronesQuery = useQuery({
    queryKey: ['instagram-patterns', businessId],
    queryFn: async () => {
      try {
        return await api.obtenerPatronesInstagram(businessId as number);
      } catch (err) {
        if (err instanceof ApiError && err.status === 404) return [];
        throw err;
      }
    },
    enabled: businessId != null && cuentaQuery.data != null,
  });

  const hoy = new Date().toISOString().slice(0, 10);
  const metricas = metricasQuery.data ?? [];

  return {
    cuenta: cuentaQuery.data ?? null,
    cargando: cuentaQuery.isLoading,
    conectar: () => conectarMutation.mutate(),
    conectando: conectarMutation.isPending,
    errorConectar: conectarMutation.error instanceof Error ? conectarMutation.error.message : null,
    desconectar: () => desconectarMutation.mutate(),
    desconectando: desconectarMutation.isPending,
    metricas,
    metricaHoy: metricas.find((m) => m.fecha === hoy) ?? null,
    patrones: patronesQuery.data ?? [],
    sincronizar: () => sincronizarMutation.mutate(),
    sincronizando: sincronizarMutation.isPending,
    errorSincronizar:
      sincronizarMutation.error instanceof ApiError ? sincronizarMutation.error.message : null,
  };
}

const ETIQUETA_TIPO: Record<InstagramMediaType, string> = {
  IMAGE: 'Fotos',
  VIDEO: 'Videos',
  CAROUSEL_ALBUM: 'Carruseles',
};

const ICONO_TIPO: Record<InstagramMediaType, ComponentProps<typeof Ionicons>['name']> = {
  IMAGE: 'image-outline',
  VIDEO: 'videocam-outline',
  CAROUSEL_ALBUM: 'albums-outline',
};

function useContentTip(businessId: number | null | undefined) {
  const queryClient = useQueryClient();

  const tipQuery = useQuery({
    queryKey: ['content-tip', businessId],
    queryFn: () => api.tipDeContenidoActual(businessId as number),
    enabled: businessId != null,
  });

  const generarMutation = useMutation({
    mutationFn: () => api.generarTipDeContenido(businessId as number),
    onSuccess: (tip) => {
      haptics.success();
      queryClient.setQueryData(['content-tip', businessId], tip);
    },
    onError: () => haptics.error(),
  });

  return {
    tip: tipQuery.data ?? null,
    cargando: tipQuery.isLoading,
    generar: () => generarMutation.mutate(),
    generando: generarMutation.isPending,
  };
}

export default function RedesScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { businessId } = useBusinessId();
  const { suscrito, cargando: cargandoSuscripcion, suscribirse } = useSubscription();
  const instagram = useInstagram(businessId);
  const tip = useContentTip(businessId);
  const [celebrando, setCelebrando] = useState(false);

  const suscribirseMutation = useMutation({
    mutationFn: suscribirse,
    onSuccess: (completado) => {
      if (completado) {
        haptics.success();
        setCelebrando(true);
      }
    },
    onError: () => haptics.error(),
  });

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <SubscriptionCelebration visible={celebrando} onDismiss={() => setCelebrando(false)} />

      <View style={styles.header}>
        <View style={styles.tituloRow}>
          <Text style={styles.titulo}>Redes sociales</Text>
          {suscrito && <CrownBadge size={17} />}
        </View>
        <SettingsButton />
      </View>

      {cargandoSuscripcion ? (
        <ActivityIndicator color={colors.brand} style={styles.loading} />
      ) : !suscrito ? (
        <View style={styles.paywall}>
          <View style={styles.paywallIcono}>
            <Ionicons name="lock-closed" size={28} color={colors.brand} />
          </View>
          <Text style={styles.paywallTitulo}>Desbloqueá Redes sociales</Text>
          <Text style={styles.paywallTexto}>
            Conectá tu Instagram, seguí una racha diaria de publicaciones, mirá tus métricas
            reales y recibí una idea de contenido nueva cada día.
          </Text>
          <Pressable
            style={[styles.botonPrimario, suscribirseMutation.isPending && styles.botonDisabled]}
            disabled={suscribirseMutation.isPending}
            onPress={() => {
              haptics.tap();
              suscribirseMutation.mutate();
            }}>
            {suscribirseMutation.isPending ? (
              <ActivityIndicator color={colors.white} />
            ) : (
              <Text style={styles.botonPrimarioTexto}>Suscribirme</Text>
            )}
          </Pressable>
          {suscribirseMutation.error && (
            <Text style={styles.errorTexto}>
              {suscribirseMutation.error instanceof Error
                ? suscribirseMutation.error.message
                : 'No se pudo procesar el pago. Intenta de nuevo.'}
            </Text>
          )}
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.block}>
            <View style={styles.tipHeader}>
              <Ionicons name="bulb" size={18} color={colors.vigila} />
              <Text style={styles.blockLabel}>Idea de contenido de hoy</Text>
            </View>
            {tip.cargando ? (
              <ActivityIndicator color={colors.brand} />
            ) : tip.tip ? (
              <Text style={styles.tipTexto}>{tip.tip.texto}</Text>
            ) : (
              <>
                <Text style={styles.blockHint}>
                  Todavía no generamos la idea de hoy para tu negocio.
                </Text>
                <Pressable
                  style={[styles.botonSecundario, tip.generando && styles.botonDisabled]}
                  disabled={tip.generando}
                  onPress={() => {
                    haptics.tap();
                    tip.generar();
                  }}>
                  {tip.generando ? (
                    <ActivityIndicator color={colors.white} size="small" />
                  ) : (
                    <>
                      <Ionicons name="sparkles-outline" size={16} color={colors.white} />
                      <Text style={styles.botonSecundarioTexto}>Generar idea de hoy</Text>
                    </>
                  )}
                </Pressable>
              </>
            )}
          </View>

          <View style={styles.block}>
            {instagram.cargando ? (
              <ActivityIndicator color={colors.brand} />
            ) : instagram.cuenta ? (
              <>
                <View style={styles.identityRow}>
                  <View style={styles.identityIcon}>
                    <Ionicons name="logo-instagram" size={20} color={colors.brand} />
                  </View>
                  <View style={styles.flexShrink}>
                    <Text style={styles.negocioNombre}>@{instagram.cuenta.username}</Text>
                    <Text style={styles.negocioGiro}>Instagram conectado</Text>
                  </View>
                </View>

                <View style={styles.divider} />

                <View style={styles.rachaRow}>
                  <View style={styles.rachaFlama}>
                    <Ionicons
                      name="flame"
                      size={22}
                      color={instagram.cuenta.racha_actual > 0 ? colors.vigila : colors.inkSoft}
                    />
                    <Text style={styles.rachaNumero}>{instagram.cuenta.racha_actual}</Text>
                  </View>
                  <View style={styles.flexShrink}>
                    <Text style={styles.blockLabel}>
                      {instagram.cuenta.racha_actual === 1
                        ? 'día seguido publicando'
                        : 'días seguidos publicando'}
                    </Text>
                    <Text style={styles.blockHint}>
                      Mejor racha: {instagram.cuenta.racha_maxima} días
                    </Text>
                  </View>
                </View>

                {instagram.metricas.length > 0 && (
                  <>
                    <View style={styles.divider} />
                    <MetricsChart metricas={instagram.metricas} />
                  </>
                )}

                {instagram.metricaHoy && (
                  <>
                    <View style={styles.divider} />
                    <View style={styles.metricasRow}>
                      <View style={styles.metricaItem}>
                        <Text style={styles.metricaValor}>{instagram.metricaHoy.reach}</Text>
                        <Text style={styles.metricaLabel}>Alcance</Text>
                      </View>
                      <View style={styles.metricaItem}>
                        <Text style={styles.metricaValor}>{instagram.metricaHoy.views}</Text>
                        <Text style={styles.metricaLabel}>Vistas</Text>
                      </View>
                      <View style={styles.metricaItem}>
                        <Text style={styles.metricaValor}>{instagram.metricaHoy.followers_count}</Text>
                        <Text style={styles.metricaLabel}>Seguidores</Text>
                      </View>
                    </View>
                  </>
                )}

                <Pressable
                  style={[styles.botonSecundario, instagram.sincronizando && styles.botonDisabled]}
                  disabled={instagram.sincronizando}
                  onPress={() => {
                    haptics.tap();
                    instagram.sincronizar();
                  }}>
                  {instagram.sincronizando ? (
                    <ActivityIndicator color={colors.white} size="small" />
                  ) : (
                    <>
                      <Ionicons name="refresh-outline" size={16} color={colors.white} />
                      <Text style={styles.botonSecundarioTexto}>
                        {instagram.metricaHoy ? 'Actualizar métricas' : 'Traer métricas de hoy'}
                      </Text>
                    </>
                  )}
                </Pressable>
                {instagram.errorSincronizar && (
                  <Text style={styles.errorTexto}>{instagram.errorSincronizar}</Text>
                )}

                <Pressable
                  style={[styles.botonPeligroChico, instagram.desconectando && styles.botonDisabled]}
                  disabled={instagram.desconectando}
                  onPress={() => {
                    haptics.tap();
                    instagram.desconectar();
                  }}>
                  <Ionicons name="unlink-outline" size={16} color={colors.nopidas} />
                  <Text style={styles.botonPeligroTexto}>Desconectar</Text>
                </Pressable>
              </>
            ) : (
              <>
                <Text style={styles.blockHint}>
                  Conectá tu cuenta de Instagram para traer métricas reales y empezar tu racha.
                </Text>
                <Pressable
                  style={[styles.botonSecundario, instagram.conectando && styles.botonDisabled]}
                  disabled={instagram.conectando}
                  onPress={() => {
                    haptics.tap();
                    instagram.conectar();
                  }}>
                  {instagram.conectando ? (
                    <ActivityIndicator color={colors.white} size="small" />
                  ) : (
                    <>
                      <Ionicons name="logo-instagram" size={16} color={colors.white} />
                      <Text style={styles.botonSecundarioTexto}>Conectar Instagram</Text>
                    </>
                  )}
                </Pressable>
                {instagram.errorConectar && (
                  <Text style={styles.errorTexto}>{instagram.errorConectar}</Text>
                )}
              </>
            )}
          </View>

          {instagram.patrones.length > 0 && <PatronesCard patrones={instagram.patrones} styles={styles} colors={colors} />}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

function PatronesCard({
  patrones,
  styles,
  colors,
}: {
  patrones: InstagramPatron[];
  styles: ReturnType<typeof createStyles>;
  colors: ColorPalette;
}) {
  const mejorAlcance = Math.max(...patrones.map((p) => p.reach_promedio));

  return (
    <View style={styles.block}>
      <View style={styles.tipHeader}>
        <Ionicons name="bar-chart" size={18} color={colors.brand} />
        <Text style={styles.blockLabel}>Patrones: foto vs. video vs. carrusel</Text>
      </View>
      <Text style={styles.blockHint}>Promedio por publicación, según tus últimos posts.</Text>
      {patrones.map((patron) => (
        <View key={patron.media_type} style={styles.patronRow}>
          <View style={styles.patronIcono}>
            <Ionicons name={ICONO_TIPO[patron.media_type]} size={18} color={colors.brand} />
          </View>
          <View style={styles.flexShrink}>
            <View style={styles.patronTituloRow}>
              <Text style={styles.blockLabel}>{ETIQUETA_TIPO[patron.media_type]}</Text>
              {patron.reach_promedio === mejorAlcance && (
                <View style={styles.patronBadge}>
                  <Text style={styles.patronBadgeTexto}>Mejor alcance</Text>
                </View>
              )}
            </View>
            <Text style={styles.blockHint}>
              {patron.cantidad} {patron.cantidad === 1 ? 'publicación' : 'publicaciones'} · alcance
              prom. {patron.reach_promedio} · {patron.likes_promedio} likes · {patron.comments_promedio}{' '}
              comentarios · {patron.saved_promedio} guardados
            </Text>
          </View>
        </View>
      ))}
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
    tituloRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
    titulo: { fontFamily: Fonts.serifSemiBold, fontSize: 20, color: colors.ink },
    loading: { marginTop: Spacing.seven },
    content: { padding: Spacing.four, paddingBottom: Spacing.eight, gap: Spacing.four },
    paywall: { alignItems: 'center', padding: Spacing.six, marginTop: Spacing.five },
    paywallIcono: {
      width: 56,
      height: 56,
      borderRadius: Radius.pill,
      backgroundColor: colors.brandSoft,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: Spacing.four,
    },
    paywallTitulo: {
      fontFamily: Fonts.serifSemiBold,
      fontSize: 19,
      color: colors.ink,
      textAlign: 'center',
      marginBottom: Spacing.two,
    },
    paywallTexto: {
      fontFamily: Fonts.sansRegular,
      fontSize: 14,
      color: colors.inkSoft,
      textAlign: 'center',
      lineHeight: 20,
      marginBottom: Spacing.five,
    },
    botonPrimario: {
      backgroundColor: colors.brand,
      borderRadius: Radius.lg,
      paddingVertical: Spacing.four,
      paddingHorizontal: Spacing.seven,
      alignItems: 'center',
    },
    botonPrimarioTexto: { fontFamily: Fonts.sansSemiBold, fontSize: 15, color: colors.white },
    block: {
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.line,
      borderRadius: Radius.lg,
      padding: Spacing.four,
      gap: Spacing.three,
    },
    tipHeader: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    tipTexto: { fontFamily: Fonts.serifMedium, fontSize: 15.5, color: colors.ink, lineHeight: 22 },
    identityRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
    identityIcon: {
      width: 40,
      height: 40,
      borderRadius: Radius.md,
      backgroundColor: colors.paper,
      alignItems: 'center',
      justifyContent: 'center',
    },
    flexShrink: { flexShrink: 1 },
    divider: { height: 1, backgroundColor: colors.line, marginVertical: 2 },
    negocioNombre: { fontFamily: Fonts.serifMedium, fontSize: 17, color: colors.ink },
    negocioGiro: { fontFamily: Fonts.sansRegular, fontSize: 13, color: colors.inkSoft },
    blockLabel: { fontFamily: Fonts.sansSemiBold, fontSize: 14, color: colors.ink },
    blockHint: { fontFamily: Fonts.sansRegular, fontSize: 12.5, color: colors.inkSoft, lineHeight: 18 },
    botonSecundario: {
      flexDirection: 'row',
      backgroundColor: colors.brand,
      borderRadius: Radius.md,
      paddingVertical: Spacing.two,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
    },
    botonSecundarioTexto: { fontFamily: Fonts.sansSemiBold, fontSize: 13.5, color: colors.white },
    botonDisabled: { opacity: 0.5 },
    errorTexto: { fontFamily: Fonts.sansRegular, fontSize: 12.5, color: colors.nopidas },
    botonPeligroChico: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      paddingVertical: Spacing.two,
    },
    botonPeligroTexto: { fontFamily: Fonts.sansRegular, fontSize: 12.5, color: colors.nopidas },
    rachaRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
    rachaFlama: { alignItems: 'center', justifyContent: 'center', width: 44 },
    rachaNumero: { fontFamily: Fonts.serifSemiBold, fontSize: 16, color: colors.ink, marginTop: -2 },
    metricasRow: { flexDirection: 'row', justifyContent: 'space-between' },
    metricaItem: { alignItems: 'center', flex: 1 },
    metricaValor: { fontFamily: Fonts.serifSemiBold, fontSize: 18, color: colors.ink },
    metricaLabel: { fontFamily: Fonts.sansRegular, fontSize: 11.5, color: colors.inkSoft, marginTop: 2 },
    patronRow: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.three },
    patronIcono: {
      width: 36,
      height: 36,
      borderRadius: Radius.md,
      backgroundColor: colors.brandSoft,
      alignItems: 'center',
      justifyContent: 'center',
    },
    patronTituloRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    patronBadge: {
      backgroundColor: colors.resurteBg,
      borderRadius: Radius.pill,
      paddingHorizontal: Spacing.two,
      paddingVertical: 2,
    },
    patronBadgeTexto: { fontFamily: Fonts.sansSemiBold, fontSize: 10, color: colors.resurteInk },
  });
}
