import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withRepeat, withSequence, withTiming } from 'react-native-reanimated';
import Svg, { Circle, Ellipse, G, Path } from 'react-native-svg';

import { Colors } from '@/constants/theme';

export type MascotPose = 'neutral' | 'thinking' | 'happy';

/**
 * El sello de El Asesor, personificado — mismo círculo/sello que ya se usa
 * en login y onboarding, con cara y brazos. Aparece chico en varias
 * pantallas (empty states, login) y grande en los momentos de espera
 * (generar consejos, mandar una pregunta), con una animación de "vivo" en
 * vez de un spinner solo, para que la espera no se sienta trabada.
 */
export function Mascot({ pose = 'neutral', size = 88 }: { pose?: MascotPose; size?: number }) {
  const bob = useSharedValue(0);

  useEffect(() => {
    bob.value = withRepeat(
      withSequence(
        withTiming(1, { duration: pose === 'thinking' ? 900 : 1400 }),
        withTiming(0, { duration: pose === 'thinking' ? 900 : 1400 })
      ),
      -1,
      true
    );
  }, [pose, bob]);

  const style = useAnimatedStyle(() => ({
    transform: [
      { translateY: bob.value * -4 },
      { rotate: `${(bob.value - 0.5) * (pose === 'thinking' ? 4 : 6)}deg` },
    ],
  }));

  return (
    <Animated.View style={[{ width: size, height: size * (170 / 150) }, style]}>
      <Svg width={size} height={size * (170 / 150)} viewBox="0 0 150 170">
        {pose === 'happy' && <Sparkles />}
        {pose === 'thinking' && <ThinkDots />}
        <BodyAndFace pose={pose} />
        <Limbs pose={pose} />
        {pose === 'thinking' && <MagGlass />}
      </Svg>
    </Animated.View>
  );
}

/**
 * Recorte tipo "foto de perfil" de la cara de la mascota, con monóculo — para
 * usar como avatar de encabezado (ej. el header del chat en Preguntar), donde
 * el monóculo comunica "analista" sin depender de texto.
 */
export function MascotAvatar({ size = 40 }: { size?: number }) {
  return (
    <View
      style={[
        styles.avatarWrap,
        { width: size, height: size, borderRadius: size / 2 },
      ]}>
      <Svg width={size * 0.86} height={size * 0.86} viewBox="0 0 100 100">
        <Ellipse cx={50} cy={54} rx={35} ry={27} fill={Colors.brandSoft} />
        <Ellipse cx={27} cy={62} rx={6.5} ry={4.5} fill={Colors.nopidas} opacity={0.28} />
        <Ellipse cx={73} cy={62} rx={6.5} ry={4.5} fill={Colors.nopidas} opacity={0.28} />
        <Circle cx={34} cy={48} r={6} fill={Colors.ink} />
        <Circle cx={36} cy={45} r={1.8} fill={Colors.white} />
        <Path d="M40 68 Q50 75 60 68" stroke={Colors.ink} strokeWidth={3.5} fill="none" strokeLinecap="round" />
        {/* monóculo sobre el ojo derecho, con cadenita */}
        <Circle cx={68} cy={48} r={6} fill={Colors.ink} />
        <Circle cx={68} cy={48} r={12} fill="none" stroke={Colors.brandDeep} strokeWidth={3.5} />
        <Path d="M78 54 Q86 62 82 72" stroke={Colors.brandDeep} strokeWidth={2.2} fill="none" strokeLinecap="round" />
      </Svg>
    </View>
  );
}

function BodyAndFace({ pose }: { pose: MascotPose }) {
  return (
    <G transform="rotate(-6 75 92)">
      {/* cuerpo — mismo sello circular de siempre */}
      <Circle cx={75} cy={92} r={60} fill={Colors.brand} stroke={Colors.brandDeep} strokeWidth={5} />
      {/* remolino, para que no sea solo un círculo liso */}
      <Path
        d="M60 38 Q64 20 78 30"
        stroke={Colors.brandDeep}
        strokeWidth={5}
        fill="none"
        strokeLinecap="round"
      />
      {/* placa de la cara */}
      <Ellipse cx={75} cy={86} rx={38} ry={27} fill={Colors.brandSoft} />
      {/* cachetes */}
      <Ellipse cx={50} cy={98} rx={8} ry={5} fill={Colors.nopidas} opacity={0.28} />
      <Ellipse cx={100} cy={98} rx={8} ry={5} fill={Colors.nopidas} opacity={0.28} />
      {/* anillo de sello, sutil */}
      <Path
        d="M28 108 Q75 128 122 108"
        stroke={Colors.brandDeep}
        strokeWidth={2}
        fill="none"
        opacity={0.35}
      />
      <Face pose={pose} />
    </G>
  );
}

function Face({ pose }: { pose: MascotPose }) {
  if (pose === 'thinking') {
    return (
      <>
        <Path d="M52 70 Q60 63 68 70" stroke={Colors.ink} strokeWidth={4} fill="none" strokeLinecap="round" />
        <Circle cx={96} cy={76} r={7.5} fill={Colors.ink} />
        <Circle cx={98} cy={73} r={2.2} fill={Colors.white} />
        <Ellipse cx={75} cy={98} rx={5} ry={3.5} fill={Colors.ink} />
      </>
    );
  }
  if (pose === 'happy') {
    return (
      <>
        <Path d="M48 76 Q58 64 68 76" stroke={Colors.ink} strokeWidth={4.5} fill="none" strokeLinecap="round" />
        <Path d="M82 76 Q92 64 102 76" stroke={Colors.ink} strokeWidth={4.5} fill="none" strokeLinecap="round" />
        <Path d="M50 96 Q75 118 100 96" stroke={Colors.ink} strokeWidth={4.5} fill="none" strokeLinecap="round" />
      </>
    );
  }
  return (
    <>
      <Circle cx={58} cy={78} r={7.5} fill={Colors.ink} />
      <Circle cx={60} cy={75} r={2.2} fill={Colors.white} />
      <Circle cx={92} cy={78} r={7.5} fill={Colors.ink} />
      <Circle cx={94} cy={75} r={2.2} fill={Colors.white} />
      <Path d="M60 100 Q75 110 90 100" stroke={Colors.ink} strokeWidth={4} fill="none" strokeLinecap="round" />
    </>
  );
}

function Limbs({ pose }: { pose: MascotPose }) {
  if (pose === 'thinking') {
    return (
      <>
        <Path d="M104 118 Q92 92 76 82" stroke={Colors.brand} strokeWidth={14} fill="none" strokeLinecap="round" />
        <Circle cx={74} cy={78} r={9} fill={Colors.brand} stroke={Colors.brandDeep} strokeWidth={3} />
        <Path d="M42 118 Q46 128 52 132" stroke={Colors.brand} strokeWidth={14} fill="none" strokeLinecap="round" />
        <Circle cx={53} cy={135} r={9} fill={Colors.brand} stroke={Colors.brandDeep} strokeWidth={3} />
        <Ellipse cx={58} cy={150} rx={11} ry={8} fill={Colors.brandDeep} />
        <Ellipse cx={92} cy={150} rx={11} ry={8} fill={Colors.brandDeep} />
      </>
    );
  }
  if (pose === 'happy') {
    return (
      <>
        <Path d="M40 130 Q28 100 34 72" stroke={Colors.brand} strokeWidth={14} fill="none" strokeLinecap="round" />
        <Circle cx={35} cy={68} r={9} fill={Colors.brand} stroke={Colors.brandDeep} strokeWidth={3} />
        <Path d="M110 130 Q122 100 116 72" stroke={Colors.brand} strokeWidth={14} fill="none" strokeLinecap="round" />
        <Circle cx={115} cy={68} r={9} fill={Colors.brand} stroke={Colors.brandDeep} strokeWidth={3} />
        <Ellipse cx={58} cy={152} rx={11} ry={8} fill={Colors.brandDeep} />
        <Ellipse cx={92} cy={152} rx={11} ry={8} fill={Colors.brandDeep} />
      </>
    );
  }
  return (
    <>
      <Path d="M28 120 Q22 132 30 142" stroke={Colors.brand} strokeWidth={14} fill="none" strokeLinecap="round" />
      <Circle cx={31} cy={144} r={9} fill={Colors.brand} stroke={Colors.brandDeep} strokeWidth={3} />
      <Path d="M122 120 Q128 132 120 142" stroke={Colors.brand} strokeWidth={14} fill="none" strokeLinecap="round" />
      <Circle cx={119} cy={144} r={9} fill={Colors.brand} stroke={Colors.brandDeep} strokeWidth={3} />
      <Ellipse cx={58} cy={152} rx={11} ry={8} fill={Colors.brandDeep} />
      <Ellipse cx={92} cy={152} rx={11} ry={8} fill={Colors.brandDeep} />
    </>
  );
}

function MagGlass() {
  return (
    <G transform="rotate(-18 30 128)">
      <Circle cx={22} cy={118} r={13} fill={Colors.brandSoft} stroke={Colors.white} strokeWidth={4} />
      <Path d="M31 127 L40 138" stroke={Colors.white} strokeWidth={5} strokeLinecap="round" />
    </G>
  );
}

function ThinkDots() {
  return (
    <>
      <Circle cx={112} cy={30} r={4} fill={Colors.brand} opacity={0.35} />
      <Circle cx={124} cy={22} r={5} fill={Colors.brand} opacity={0.6} />
      <Circle cx={138} cy={16} r={6} fill={Colors.brand} />
    </>
  );
}

function Sparkles() {
  return (
    <>
      <Path d="M26 30 L30 42 M42 16 L43 29" stroke={Colors.vigila} strokeWidth={4} strokeLinecap="round" />
      <Path d="M108 16 L107 29 M124 30 L120 42" stroke={Colors.vigila} strokeWidth={4} strokeLinecap="round" />
    </>
  );
}

const styles = StyleSheet.create({
  avatarWrap: {
    backgroundColor: Colors.brand,
    borderWidth: 2,
    borderColor: Colors.brandDeep,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
});
