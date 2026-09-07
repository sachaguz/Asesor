import { DocumentScreen, DocumentSection } from '@/components/document-screen';

// Contenido de referencia / borrador, no revisado por un abogado — hay que
// reemplazarlo por el texto legal definitivo antes de lanzar la app de
// verdad. Última actualización: agosto de 2026.
export default function PrivacidadScreen() {
  return (
    <DocumentScreen titulo="Privacidad">
      <DocumentSection titulo="1. Qué datos recolectamos">
        Tu email y nombre al crear la cuenta; los datos de tu negocio que cargás vos mismo (ventas,
        productos, archivos de contexto); y, si conectás Instagram, las métricas públicas de tu
        cuenta comercial.
      </DocumentSection>
      <DocumentSection titulo="2. Para qué los usamos">
        Para generarte consejos, ideas de contenido y respuestas en el chat. Los datos de tu
        negocio se envían a Anthropic (el proveedor de inteligencia artificial que usa la app) solo
        para procesar esos pedidos, nunca para entrenar modelos ni para otro fin.
      </DocumentSection>
      <DocumentSection titulo="3. Con quién se comparte">
        Con los proveedores que hacen funcionar la app: hosting y base de datos, Anthropic (IA),
        Stripe (pagos de la suscripción Redes) y Meta/Instagram (solo si vos conectás tu cuenta).
        No vendemos tus datos a nadie.
      </DocumentSection>
      <DocumentSection titulo="4. Seguridad">
        Las contraseñas se guardan encriptadas, nunca en texto plano. Los pagos los procesa Stripe
        directamente — El Asesor nunca ve ni guarda el número de tu tarjeta.
      </DocumentSection>
      <DocumentSection titulo="5. Tus derechos">
        Podés borrar tu cuenta y todos sus datos en cualquier momento desde Mi negocio → Borrar mi
        cuenta. Es permanente e inmediato.
      </DocumentSection>
      <DocumentSection titulo="6. Cambios a esta política">
        Si actualizamos esta política de forma importante, te avisamos dentro de la app.
      </DocumentSection>
      <DocumentSection titulo="7. Contacto">
        ¿Dudas sobre tus datos? Escribinos desde la sección Soporte, en Configuración.
      </DocumentSection>
    </DocumentScreen>
  );
}
