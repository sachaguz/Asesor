import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';

import { api } from '@/api/client';
import { useAuth } from '@/hooks/use-auth';
import { useStripe } from '@/lib/stripe';

type SubscriptionContextValue = {
  suscrito: boolean;
  cargando: boolean;
  /** Devuelve false si el usuario cerró el PaymentSheet sin pagar. */
  suscribirse: () => Promise<boolean>;
};

const SubscriptionContext = createContext<SubscriptionContextValue | null>(null);

export function SubscriptionProvider({ children }: { children: ReactNode }) {
  const { token, user } = useAuth();
  const { initPaymentSheet, presentPaymentSheet } = useStripe();
  const [suscrito, setSuscrito] = useState(false);
  const [cargando, setCargando] = useState(true);

  const refrescarEstado = useCallback(async () => {
    if (!token) {
      setSuscrito(false);
      return;
    }
    const estado = await api.estadoSuscripcion();
    setSuscrito(estado.suscrito);
  }, [token]);

  useEffect(() => {
    setCargando(true);
    refrescarEstado().finally(() => setCargando(false));
  }, [refrescarEstado, user?.id]);

  const suscribirse = async () => {
    const params = await api.crearPaymentSheet();
    const init = await initPaymentSheet({
      merchantDisplayName: 'El Asesor',
      customerId: params.customer_id,
      customerEphemeralKeySecret: params.ephemeral_key_secret,
      paymentIntentClientSecret: params.payment_intent_client_secret,
    });
    if (init.error) throw new Error(init.error.message);

    const resultado = await presentPaymentSheet();
    if (resultado.error) {
      // El usuario cerró el PaymentSheet sin pagar — no es un error real,
      // no hay nada que mostrarle ni que reintentar.
      if (resultado.error.code === 'Canceled') return false;
      throw new Error(resultado.error.message);
    }

    // El estado real lo escribe el webhook de Stripe, no este resultado —
    // puede haber un pequeño desfasaje entre "el cobro se confirmó acá" y
    // "el backend ya se enteró". Se reintenta una vez más después de un
    // respiro por si el webhook todavía no llegó.
    await refrescarEstado();
    setTimeout(refrescarEstado, 2000);
    return true;
  };

  return (
    <SubscriptionContext.Provider value={{ suscrito, cargando, suscribirse }}>
      {children}
    </SubscriptionContext.Provider>
  );
}

export function useSubscription(): SubscriptionContextValue {
  const ctx = useContext(SubscriptionContext);
  if (!ctx) throw new Error('useSubscription debe usarse dentro de <SubscriptionProvider>');
  return ctx;
}
