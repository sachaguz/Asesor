import { Colors } from '@/constants/theme';

export type MascotMood = 'feliz' | 'neutral' | 'preocupado';

const BOCAS: Record<MascotMood, string> = {
  feliz: 'M30 68 Q50 84 70 68',
  neutral: 'M40 68 Q50 75 60 68',
  preocupado: 'M38 75 Q50 66 62 75',
};

/** Versión SVG cruda de <MascotAvatar> (components/mascot.tsx) — los widgets
 * de Android no pueden usar react-native-svg (son JSX de verdad, montado por
 * React), así que se transcribe a mano a un string de SVG que `SvgWidget`
 * pueda rasterizar. Mismo viewBox y trazos que el avatar original, con la
 * boca como único elemento que cambia según el estado. */
export function mascotAvatarSvg(mood: MascotMood, fondo: string): string {
  return `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
  <circle cx="50" cy="50" r="50" fill="${fondo}" />
  <ellipse cx="50" cy="54" rx="35" ry="27" fill="${Colors.brandSoft}" />
  <ellipse cx="27" cy="62" rx="6.5" ry="4.5" fill="${Colors.nopidas}" opacity="0.28" />
  <ellipse cx="73" cy="62" rx="6.5" ry="4.5" fill="${Colors.nopidas}" opacity="0.28" />
  <circle cx="34" cy="48" r="6" fill="${Colors.ink}" />
  <circle cx="36" cy="45" r="1.8" fill="${Colors.white}" />
  <path d="${BOCAS[mood]}" stroke="${Colors.ink}" stroke-width="3.5" fill="none" stroke-linecap="round" />
  <circle cx="68" cy="48" r="6" fill="${Colors.ink}" />
  <circle cx="68" cy="48" r="12" fill="none" stroke="${Colors.brandDeep}" stroke-width="3.5" />
  <path d="M78 54 Q86 62 82 72" stroke="${Colors.brandDeep}" stroke-width="2.2" fill="none" stroke-linecap="round" />
</svg>`;
}
