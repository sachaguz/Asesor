import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { AppState } from 'react-native';

import { api, setAuthToken } from '@/api/client';
import type { User } from '@/api/types';
import { tokenStorage } from '@/lib/token-storage';

const STORAGE_KEY = 'elasesor.token';

type AuthContextValue = {
  token: string | null | undefined;
  user: User | null;
  cargando: boolean;
  login: (email: string, password: string) => Promise<void>;
  registrar: (email: string, password: string, nombre: string) => Promise<void>;
  loginConGoogle: (idToken: string) => Promise<void>;
  entrarConToken: (accessToken: string) => Promise<void>;
  refrescarPerfil: () => Promise<User | null>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null | undefined>(undefined);
  const [user, setUser] = useState<User | null>(null);
  const tokenRef = useRef(token);
  tokenRef.current = token;

  const refrescarPerfil = useCallback(async () => {
    if (!tokenRef.current) return null;
    try {
      const perfil = await api.perfilActual();
      setUser(perfil);
      return perfil;
    } catch {
      // si el token venció justo ahora, el próximo request protegido ya se
      // va a encargar de mandar a login — acá no hace falta hacer nada más.
      return null;
    }
  }, []);

  useEffect(() => {
    // El perfil (ej. email_verificado) puede cambiar afuera de la app —
    // confirmar el correo pasa en su propia pantalla, sin tocar este
    // estado — así que se refresca solo al volver a primer plano.
    const suscripcion = AppState.addEventListener('change', (estado) => {
      if (estado === 'active') refrescarPerfil();
    });
    return () => suscripcion.remove();
  }, [refrescarPerfil]);

  useEffect(() => {
    (async () => {
      const guardado = await tokenStorage.getItem(STORAGE_KEY);
      if (!guardado) {
        setToken(null);
        return;
      }
      setAuthToken(guardado);
      try {
        const perfil = await api.perfilActual();
        setUser(perfil);
        setToken(guardado);
      } catch {
        // token vencido o inválido: se descarta y se manda a login de nuevo
        await tokenStorage.removeItem(STORAGE_KEY);
        setAuthToken(null);
        setToken(null);
      }
    })();
  }, []);

  const entrar = useCallback(async (accessToken: string) => {
    await tokenStorage.setItem(STORAGE_KEY, accessToken);
    setAuthToken(accessToken);
    const perfil = await api.perfilActual();
    setUser(perfil);
    setToken(accessToken);
  }, []);

  const login = useCallback(
    async (email: string, password: string) => {
      const { access_token } = await api.iniciarSesion(email, password);
      await entrar(access_token);
    },
    [entrar]
  );

  const registrar = useCallback(
    async (email: string, password: string, nombre: string) => {
      const { access_token } = await api.registrar(email, password, nombre);
      await entrar(access_token);
    },
    [entrar]
  );

  const loginConGoogle = useCallback(
    async (idToken: string) => {
      const { access_token } = await api.iniciarSesionGoogle(idToken);
      await entrar(access_token);
    },
    [entrar]
  );

  const logout = useCallback(async () => {
    await tokenStorage.removeItem(STORAGE_KEY);
    setAuthToken(null);
    setUser(null);
    setToken(null);
  }, []);

  const value: AuthContextValue = {
    token,
    user,
    cargando: token === undefined,
    login,
    registrar,
    loginConGoogle,
    entrarConToken: entrar,
    refrescarPerfil,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth debe usarse dentro de <AuthProvider>');
  }
  return ctx;
}
