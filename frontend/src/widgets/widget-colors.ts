import type { HexColor } from 'react-native-android-widget';

import { Colors } from '@/constants/theme';

/** Los widgets tipan los colores como `#${string}` en vez de `string` — la
 * paleta de la app ya son hex reales, solo hace falta re-tipar, no convertir
 * nada en runtime. */
export const WidgetColors = Colors as unknown as Record<keyof typeof Colors, HexColor>;
