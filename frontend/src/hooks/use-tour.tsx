import { useRouter, useSegments } from 'expo-router';
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import type { View } from 'react-native';

import { useAuth } from '@/hooks/use-auth';
import { useBusinessId } from '@/hooks/use-business-id';

export type TourStepKey = 'hoy' | 'preguntar' | 'negocio';

type TourStep = {
  key: TourStepKey;
  route: '/(tabs)' | '/(tabs)/preguntar' | '/(tabs)/negocio';
  title: string;
  text: string;
};

/**
 * Mismo tour de 3 pasos del boceto original (asesor-zapateria-v6.html,
 * sección "TOUR DE FUNCIONES"): recorre las tres pestañas señalando lo
 * principal de cada una.
 */
const TOUR_STEPS: TourStep[] = [
  {
    key: 'hoy',
    route: '/(tabs)',
    title: 'Aquí están tus consejos',
    text: 'Cada mañana reviso tus ventas y te dejo lo importante. Toca cualquier consejo para ver por qué te lo doy.',
  },
  {
    key: 'preguntar',
    route: '/(tabs)/preguntar',
    title: 'Pregúntame lo que sea',
    text: '¿Cómo va tal modelo? ¿Qué me conviene surtir? Escríbeme y te contesto derecho.',
  },
  {
    key: 'negocio',
    route: '/(tabs)/negocio',
    title: 'Cuéntame lo que solo tú sabes',
    text: 'Aquí me platicas de tu negocio y me subes archivos. Entre más sepa, menos consejos tontos te doy.',
  },
];

type TourContextValue = {
  activeIndex: number | null;
  currentStep: TourStep | null;
  totalSteps: number;
  registerTarget: (key: TourStepKey, node: View | null) => void;
  getTarget: (key: TourStepKey) => View | null;
  next: () => void;
  prev: () => void;
  skip: () => void;
};

const TourContext = createContext<TourContextValue | null>(null);

/**
 * Arranca solo cuando el negocio se acaba de crear en esta sesión (recién
 * salido del onboarding) — nunca en un login a una cuenta ya existente,
 * aunque sea la primera vez en ese dispositivo. `recienCreado` vive solo en
 * memoria (no en AsyncStorage): un usuario nuevo lo ve una vez y, al no
 * persistir, ni un refresh ni una futura sesión lo vuelven a disparar.
 */
export function TourProvider({ children }: { children: ReactNode }) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const router = useRouter();
  const segments = useSegments();
  const { token, user, cargando: cargandoAuth } = useAuth();
  const { businessId, recienCreado, cargando: cargandoBusiness } = useBusinessId();
  const targets = useRef<Partial<Record<TourStepKey, View | null>>>({});
  const arrancado = useRef(false);

  const registerTarget = useCallback((key: TourStepKey, node: View | null) => {
    targets.current[key] = node;
  }, []);
  const getTarget = useCallback((key: TourStepKey) => targets.current[key] ?? null, []);

  useEffect(() => {
    if (arrancado.current) return;
    // La URL raíz "/" coincide con la pantalla de Hoy dentro de "(tabs)" aun
    // sin sesión (los grupos de ruta se aplanan en la URL en web), así que
    // segments[0]==='(tabs)' por sí solo no basta: hay que esperar a que
    // auth y negocio terminen de cargar y confirmen que de verdad hay
    // sesión con negocio, si no el tour puede armarse durante ese instante
    // inicial y aparecer después encima del login.
    if (cargandoAuth || cargandoBusiness) return;
    if (!token || !user || businessId == null) return;
    if (!recienCreado) return;
    if (segments[0] !== '(tabs)') return;
    arrancado.current = true;
    setTimeout(() => setActiveIndex(0), 600);
  }, [segments, token, user, businessId, recienCreado, cargandoAuth, cargandoBusiness]);

  useEffect(() => {
    if (activeIndex == null) return;
    router.navigate(TOUR_STEPS[activeIndex].route);
  }, [activeIndex, router]);

  // Si por lo que sea el usuario sale de las pestañas en medio del tour
  // (cierra sesión, etc.), se cancela — nunca debe quedar flotando sobre
  // otra pantalla.
  useEffect(() => {
    if (activeIndex != null && segments[0] !== '(tabs)') setActiveIndex(null);
  }, [segments, activeIndex]);

  const next = useCallback(() => {
    setActiveIndex((i) => {
      if (i == null || i >= TOUR_STEPS.length - 1) return null;
      return i + 1;
    });
  }, []);

  const prev = useCallback(() => {
    setActiveIndex((i) => (i == null || i <= 0 ? i : i - 1));
  }, []);

  const skip = useCallback(() => setActiveIndex(null), []);

  const value: TourContextValue = {
    activeIndex,
    currentStep: activeIndex != null ? TOUR_STEPS[activeIndex] : null,
    totalSteps: TOUR_STEPS.length,
    registerTarget,
    getTarget,
    next,
    prev,
    skip,
  };

  return <TourContext.Provider value={value}>{children}</TourContext.Provider>;
}

export function useTour(): TourContextValue {
  const ctx = useContext(TourContext);
  if (!ctx) {
    throw new Error('useTour debe usarse dentro de <TourProvider>');
  }
  return ctx;
}
