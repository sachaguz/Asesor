import { useEffect, useMemo, useState } from 'react';
import { Dimensions, Pressable, StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import Animated, {
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Fonts, Radius, Spacing, type ColorPalette } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useTour } from '@/hooks/use-tour';
import { haptics } from '@/lib/haptics';

const LIQUID = { damping: 15, stiffness: 130, mass: 0.9 };
// Más lento y con más sobrepaso que LIQUID a propósito — es el que mueve la
// tarjeta de arriba a abajo entre pasos, y se pidió que se sienta "como un
// líquido viscoso" (pesado, con un poco de rebote al asentar) en vez del
// spring más ágil que usa el halo.
const VISCOUS = { damping: 13, stiffness: 55, mass: 1.6 };
const PAD = 6;
// Un elemento recién montado (justo tras cambiar de pestaña) puede medir 0
// por un instante antes de acomodarse — sin este mínimo, ese rectángulo
// degenerado hace que las franjas de oscurecido cubran casi toda la
// pantalla (visto en la pestaña Mi negocio).
const MIN_SIZE = 24;

/**
 * Spotlight de coach marks, tomado del boceto (asesor-zapateria-v6.html,
 * función placeTourHighlight): en vez de un velo con un agujero recortado
 * (ahí lo hacía un box-shadow gigante), se pintan 4 franjas oscuras
 * alrededor del elemento señalado — sin depender de SVG ni de máscaras.
 *
 * El halo se anima con spring (no snap) de una posición a la siguiente —
 * incluso cruzando de pestaña. La tarjeta desliza de verdad entre su
 * posición arriba/abajo (no solo un fundido) usando su alto real medido
 * con onLayout, así el movimiento es un desplazamiento continuo.
 */
export function TourOverlay() {
  const { activeIndex, currentStep, totalSteps, getTarget, next, prev, skip } = useTour();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [hasRect, setHasRect] = useState(false);
  const insets = useSafeAreaInsets();
  const { width: screenW, height: screenH } = Dimensions.get('window');

  const hx = useSharedValue(screenW / 2);
  const hy = useSharedValue(screenH / 2);
  const hw = useSharedValue(0);
  const hh = useSharedValue(0);
  const dim = useSharedValue(0);
  const cardAbajo = useSharedValue(1);
  const cardPop = useSharedValue(0);
  const cardY = useSharedValue(0);
  const cardHeight = useSharedValue(0);

  useEffect(() => {
    if (!currentStep) return;
    let cancelado = false;
    let intentos = 0;
    cardPop.value = 0;
    const medir = () => {
      if (cancelado) return;
      const nodo = getTarget(currentStep.key);
      if (!nodo) {
        intentos++;
        if (intentos < 20) setTimeout(medir, 100);
        return;
      }
      nodo.measureInWindow((x, y, width, height) => {
        if (cancelado) return;
        if (width < MIN_SIZE || height < MIN_SIZE) {
          intentos++;
          if (intentos < 20) setTimeout(medir, 100);
          return;
        }
        hx.value = withSpring(Math.max(x - PAD, 0), LIQUID);
        hy.value = withSpring(Math.max(y - PAD, 0), LIQUID);
        hw.value = withSpring(width + PAD * 2, LIQUID);
        hh.value = withSpring(height + PAD * 2, LIQUID);
        dim.value = withSpring(1, LIQUID);
        cardAbajo.value = y + height / 2 < screenH * 0.5 ? 1 : 0;
        cardPop.value = withSpring(1, LIQUID);
        setHasRect(true);
      });
    };
    const timeoutId = setTimeout(medir, 260);
    return () => {
      cancelado = true;
      clearTimeout(timeoutId);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentStep, getTarget]);

  // Recalcula la posición Y real de la tarjeta (arriba o abajo) cada vez que
  // cambia el lado o se conoce/actualiza su alto — y la anima como un
  // deslizamiento continuo entre ambas, en vez de saltar entre un anchor
  // `top` y uno `bottom`.
  useAnimatedReaction(
    () => ({ abajo: cardAbajo.value, h: cardHeight.value }),
    (curr) => {
      if (!curr.h) return;
      const destino = curr.abajo ? screenH - insets.bottom - 78 - curr.h : insets.top + 20;
      cardY.value = withSpring(destino, VISCOUS);
    },
    [screenH, insets.bottom, insets.top]
  );

  const onCardLayout = (e: LayoutChangeEvent) => {
    cardHeight.value = e.nativeEvent.layout.height;
  };

  const bandTop = useAnimatedStyle(() => ({
    top: 0,
    left: 0,
    width: screenW,
    height: hy.value,
    opacity: dim.value,
  }));
  const bandBottom = useAnimatedStyle(() => ({
    top: hy.value + hh.value,
    left: 0,
    width: screenW,
    height: Math.max(screenH - (hy.value + hh.value), 0),
    opacity: dim.value,
  }));
  const bandLeft = useAnimatedStyle(() => ({
    top: hy.value,
    left: 0,
    width: hx.value,
    height: hh.value,
    opacity: dim.value,
  }));
  const bandRight = useAnimatedStyle(() => ({
    top: hy.value,
    left: hx.value + hw.value,
    width: Math.max(screenW - (hx.value + hw.value), 0),
    height: hh.value,
    opacity: dim.value,
  }));
  const ringStyle = useAnimatedStyle(() => ({
    top: hy.value,
    left: hx.value,
    width: hw.value,
    height: hh.value,
  }));
  const fullDimStyle = useAnimatedStyle(() => ({ opacity: 1 - dim.value }));
  const cardStyle = useAnimatedStyle(() => ({
    top: cardY.value,
    opacity: cardPop.value,
    transform: [{ scale: 0.97 + cardPop.value * 0.03 }],
  }));

  if (activeIndex == null || !currentStep) return null;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      <Animated.View pointerEvents={hasRect ? 'auto' : 'none'} style={[styles.dim, bandTop]} />
      <Animated.View pointerEvents={hasRect ? 'auto' : 'none'} style={[styles.dim, bandBottom]} />
      <Animated.View pointerEvents={hasRect ? 'auto' : 'none'} style={[styles.dim, bandLeft]} />
      <Animated.View pointerEvents={hasRect ? 'auto' : 'none'} style={[styles.dim, bandRight]} />
      {/* Bloquea toques/scroll también dentro del recorte iluminado — las
          franjas de arriba ya cubren el resto de la pantalla, pero el hueco
          en sí queda libre y de otro modo se podría seguir desplazando el
          contenido de fondo (ej. la lista de "Hoy") mientras el tour está
          activo. */}
      <Animated.View pointerEvents={hasRect ? 'auto' : 'none'} style={[styles.blocker, ringStyle]} />
      <Animated.View pointerEvents="none" style={[styles.ring, ringStyle]} />
      {!hasRect && (
        <Animated.View
          pointerEvents="auto"
          style={[styles.dim, StyleSheet.absoluteFillObject, fullDimStyle]}
        />
      )}

      <Animated.View style={[styles.card, cardStyle]} onLayout={onCardLayout}>
        <Text style={styles.num}>
          {activeIndex + 1} de {totalSteps}
        </Text>
        <Text style={styles.title}>{currentStep.title}</Text>
        <Text style={styles.text}>{currentStep.text}</Text>
        <View style={styles.row}>
          <View style={styles.dots}>
            {Array.from({ length: totalSteps }).map((_, i) => (
              <View key={i} style={[styles.dot, i === activeIndex && styles.dotOn]} />
            ))}
          </View>
          <View style={styles.actions}>
            {activeIndex > 0 && (
              <Pressable
                onPress={() => {
                  haptics.tap();
                  prev();
                }}
                hitSlop={8}>
                <Text style={styles.skip}>Atrás</Text>
              </Pressable>
            )}
            <Pressable
              onPress={() => {
                haptics.tap();
                skip();
              }}
              hitSlop={8}>
              <Text style={styles.skip}>Saltar</Text>
            </Pressable>
            <Pressable
              style={styles.nextButton}
              onPress={() => {
                haptics.select();
                next();
              }}>
              <Text style={styles.nextText}>
                {activeIndex === totalSteps - 1 ? 'Entendido' : 'Siguiente'}
              </Text>
            </Pressable>
          </View>
        </View>
      </Animated.View>
    </View>
  );
}

function createStyles(colors: ColorPalette) {
  return StyleSheet.create({
    dim: { position: 'absolute', backgroundColor: 'rgba(43,33,25,0.62)' },
    blocker: { position: 'absolute' },
    ring: {
      position: 'absolute',
      borderRadius: Radius.lg,
      borderWidth: 3,
      borderColor: colors.brand,
    },
    card: {
      position: 'absolute',
      left: 22,
      right: 22,
      backgroundColor: colors.card,
      borderRadius: Radius.xl,
      padding: Spacing.four,
      boxShadow: '0px 10px 20px rgba(43,33,25,0.35)',
      elevation: 10,
    },
    num: {
      fontFamily: Fonts.sansSemiBold,
      fontSize: 11,
      letterSpacing: 0.6,
      textTransform: 'uppercase',
      color: colors.brandDeep,
      marginBottom: Spacing.two,
    },
    title: { fontFamily: Fonts.serifSemiBold, fontSize: 19, color: colors.ink, marginBottom: 6 },
    text: {
      fontFamily: Fonts.sansRegular,
      fontSize: 14,
      lineHeight: 20,
      color: colors.inkBody,
      marginBottom: Spacing.four,
    },
    row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    dots: { flexDirection: 'row', gap: 6 },
    dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.line },
    dotOn: { backgroundColor: colors.brand, transform: [{ scale: 1.25 }] },
    actions: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
    skip: { fontFamily: Fonts.sansRegular, fontSize: 13, color: colors.inkSoft },
    nextButton: {
      backgroundColor: colors.brand,
      borderRadius: Radius.md,
      paddingHorizontal: Spacing.four,
      paddingVertical: Spacing.three,
    },
    nextText: { fontFamily: Fonts.sansSemiBold, fontSize: 14, color: colors.white },
  });
}
