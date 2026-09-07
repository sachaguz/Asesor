import Svg, { Circle, Path } from 'react-native-svg';

import { useTheme } from '@/hooks/use-theme';

/**
 * Ionicons no tiene ningún ícono de corona — se dibuja a mano, en el mismo
 * estilo de trazo grueso que el resto de los SVG del proyecto (ver mascot.tsx).
 * Indica en un vistazo que la suscripción de Redes está activa.
 */
export function CrownBadge({ size = 18 }: { size?: number }) {
  const { colors } = useTheme();
  return (
    <Svg width={size} height={size * (18 / 22)} viewBox="0 0 22 18">
      <Path
        d="M2 16 L1 5 L7 10 L11 2 L15 10 L21 5 L20 16 Z"
        fill={colors.vigila}
        stroke={colors.vigilaInk}
        strokeWidth={1.4}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      <Circle cx={11} cy={2} r={1.8} fill={colors.vigilaInk} />
    </Svg>
  );
}
