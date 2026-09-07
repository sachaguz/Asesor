import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';

import { api } from '@/api/client';
import type { Business } from '@/api/types';
import { useAuth } from '@/hooks/use-auth';

type BusinessContextValue = {
  business: Business | null | undefined;
  businessId: number | null | undefined;
  cargando: boolean;
  guardarNegocio: (negocio: Business) => void;
  /**
   * true solo durante la sesión en la que el negocio se acaba de crear desde
   * el onboarding — no se persiste. Es la señal que usa el tour para saber
   * si debe arrancar: así arranca únicamente la primera vez que se crea la
   * cuenta, nunca en un login posterior a una cuenta ya existente (donde el
   * negocio se trae de `GET /businesses`, no se "guarda" acá).
   */
  recienCreado: boolean;
};

const BusinessContext = createContext<BusinessContextValue | null>(null);

/**
 * El negocio ahora le pertenece al usuario autenticado (ver Fase de login) —
 * se trae de `GET /businesses`, no se guarda en el dispositivo. Un solo
 * estado compartido vía Context (no un hook con useState local) por la
 * misma razón que antes: la pantalla raíz que decide qué mostrar necesita
 * enterarse cuando el onboarding crea un negocio nuevo.
 */
export function BusinessProvider({ children }: { children: ReactNode }) {
  const { token, cargando: cargandoAuth } = useAuth();
  const [business, setBusiness] = useState<Business | null | undefined>(undefined);
  const [recienCreado, setRecienCreado] = useState(false);

  useEffect(() => {
    if (cargandoAuth) return;
    if (!token) {
      setBusiness(null);
      return;
    }
    let cancelado = false;
    setBusiness(undefined);
    api
      .listarNegocios()
      .then((negocios) => {
        if (!cancelado) setBusiness(negocios[0] ?? null);
      })
      .catch(() => {
        if (!cancelado) setBusiness(null);
      });
    return () => {
      cancelado = true;
    };
  }, [token, cargandoAuth]);

  const guardarNegocio = useCallback((negocio: Business) => {
    setBusiness(negocio);
    setRecienCreado(true);
  }, []);

  const value: BusinessContextValue = {
    business,
    businessId: business ? business.id : business,
    cargando: business === undefined,
    guardarNegocio,
    recienCreado,
  };

  return <BusinessContext.Provider value={value}>{children}</BusinessContext.Provider>;
}

export function useBusinessId(): BusinessContextValue {
  const ctx = useContext(BusinessContext);
  if (!ctx) {
    throw new Error('useBusinessId debe usarse dentro de <BusinessProvider>');
  }
  return ctx;
}
