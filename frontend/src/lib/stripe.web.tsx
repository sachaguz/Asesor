import { Fragment, type ReactNode } from 'react';

// @stripe/stripe-react-native no compila para web (su index importa specs
// nativos de codegen que Metro no puede resolver ahí) — este archivo lo
// reemplaza solo en la build web (convención de Metro: *.web.tsx pisa al
// .tsx en esa plataforma). La suscripción de Redes no se puede probar en el
// navegador de todos modos: PaymentSheet nativo necesita un build con EAS
// aunque esto no existiera (ver AGENTS.md), así que no se pierde cobertura
// real de test.
const errorNoDisponibleEnWeb = {
  code: 'Failed',
  message: 'La suscripción de Redes todavía no está disponible en la versión web.',
} as const;

export function StripeProvider({ children }: { children: ReactNode }) {
  return <Fragment>{children}</Fragment>;
}

export function useStripe() {
  return {
    initPaymentSheet: async () => ({ error: errorNoDisponibleEnWeb }),
    presentPaymentSheet: async () => ({ error: errorNoDisponibleEnWeb }),
  };
}
