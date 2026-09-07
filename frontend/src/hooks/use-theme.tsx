import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useColorScheme } from 'react-native';

import { DarkColors, LightColors, type ColorPalette } from '@/constants/theme';

const STORAGE_KEY = 'elasesor.theme';

type Scheme = 'light' | 'dark';

type ThemeContextValue = {
  scheme: Scheme;
  colors: ColorPalette;
  alternar: () => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const sistemaOscuro = useColorScheme() === 'dark';
  // null mientras se lee la preferencia guardada — evita un flash del tema
  // por defecto del sistema antes de aplicar lo que el usuario eligió.
  const [guardado, setGuardado] = useState<Scheme | null>(null);
  const [cargado, setCargado] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((valor) => {
      if (valor === 'light' || valor === 'dark') setGuardado(valor);
      setCargado(true);
    });
  }, []);

  const scheme: Scheme = guardado ?? (sistemaOscuro ? 'dark' : 'light');

  const alternar = () => {
    const nuevo: Scheme = scheme === 'dark' ? 'light' : 'dark';
    setGuardado(nuevo);
    AsyncStorage.setItem(STORAGE_KEY, nuevo);
  };

  const colors = useMemo(() => (scheme === 'dark' ? DarkColors : LightColors), [scheme]);

  if (!cargado) return null;

  return <ThemeContext.Provider value={{ scheme, colors, alternar }}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme debe usarse dentro de <ThemeProvider>');
  return ctx;
}
