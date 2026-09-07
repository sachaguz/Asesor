/**
 * Paleta e tokens de diseño de El Asesor — dirección "vibrante y amigable"
 * (morado como color de marca, verde/ámbar/rosa para los tres veredictos,
 * Baloo 2 + Manrope). LightColors/DarkColors comparten las mismas claves —
 * ver src/hooks/use-theme.tsx para cómo se elige una u otra en runtime.
 */

export type ColorPalette = {
  background: string;
  paper: string;
  card: string;
  ink: string;
  inkSoft: string;
  inkBody: string;
  line: string;
  brand: string;
  brandDeep: string;
  brandSoft: string;
  resurte: string;
  resurteInk: string;
  resurteBg: string;
  nopidas: string;
  nopidasInk: string;
  nopidasBg: string;
  vigila: string;
  vigilaInk: string;
  vigilaBg: string;
  white: string;
};

export const LightColors: ColorPalette = {
  background: '#F6F5FC',
  paper: '#F6F5FC',
  card: '#FFFFFF',
  ink: '#1E1B3A',
  inkSoft: '#6E6A8C',
  inkBody: '#4A4566',
  line: '#E6E3F5',
  brand: '#7C5CFC',
  brandDeep: '#5B3DF5',
  brandSoft: '#EFEBFF',
  resurte: '#17C964',
  resurteInk: '#0E8F49',
  resurteBg: '#E3FBEC',
  nopidas: '#FF5470',
  nopidasInk: '#C5253F',
  nopidasBg: '#FFE7EC',
  vigila: '#FFB020',
  vigilaInk: '#9A6A00',
  vigilaBg: '#FFF4DE',
  white: '#FFFFFF',
};

export const DarkColors: ColorPalette = {
  background: '#14121F',
  paper: '#1B1830',
  card: '#211D38',
  ink: '#F1EFFB',
  inkSoft: '#A8A3C4',
  inkBody: '#C9C5E0',
  line: '#332C55',
  brand: '#9B82FF',
  brandDeep: '#B39DFF',
  brandSoft: '#2A2350',
  resurte: '#3DDC84',
  resurteInk: '#8CF0B5',
  resurteBg: '#123322',
  nopidas: '#FF6B84',
  nopidasInk: '#FFB3C0',
  nopidasBg: '#3A1620',
  vigila: '#FFC94D',
  vigilaInk: '#FFE1A3',
  vigilaBg: '#3A2C0A',
  white: '#FFFFFF',
};

// Alias legado — algunos módulos fuera de componentes React (fuera del
// alcance de useTheme) todavía pueden necesitar un valor estático.
export const Colors = LightColors;

export const Fonts = {
  serifMedium: 'Baloo2_500Medium',
  serifSemiBold: 'Baloo2_600SemiBold',
  sansRegular: 'Manrope_400Regular',
  sansMedium: 'Manrope_600SemiBold',
  sansSemiBold: 'Manrope_700Bold',
} as const;

export const Spacing = {
  one: 4,
  two: 8,
  three: 12,
  four: 16,
  five: 20,
  six: 24,
  seven: 32,
  eight: 40,
} as const;

export const Radius = {
  sm: 12,
  md: 14,
  lg: 18,
  xl: 22,
  xxl: 26,
  pill: 999,
} as const;
