import { DocumentScreen, DocumentSection } from '@/components/document-screen';

// Contenido de referencia / borrador, no revisado por un abogado — hay que
// reemplazarlo por el texto legal definitivo antes de lanzar la app de
// verdad. Última actualización: agosto de 2026.
export default function TerminosScreen() {
  return (
    <DocumentScreen titulo="Términos y condiciones">
      <DocumentSection titulo="1. Qué es El Asesor">
        El Asesor es una aplicación que ayuda a dueños de negocios chicos a tomar decisiones sobre
        su stock y sus ventas, usando inteligencia artificial. Los consejos que genera la app son
        sugerencias basadas en los datos que vos cargás — no son garantía de resultados ni
        reemplazan tu propio criterio como dueño del negocio.
      </DocumentSection>
      <DocumentSection titulo="2. Tu cuenta">
        Sos responsable de mantener segura tu contraseña y de todo lo que pase en tu cuenta. Si
        creés que alguien más accedió a ella, contactanos apenas puedas desde la sección Soporte.
      </DocumentSection>
      <DocumentSection titulo="3. La suscripción de Redes">
        La función “Redes” (métricas de Instagram, racha diaria e ideas de contenido) es una
        suscripción paga, con cobro recurrente mensual procesado por Stripe. Podés cancelarla
        cuando quieras; seguís teniendo acceso hasta el final del período ya pagado. No se hacen
        devoluciones de períodos ya cobrados, salvo que la ley aplicable diga lo contrario.
      </DocumentSection>
      <DocumentSection titulo="4. Tus datos y contenido">
        Las ventas, productos y archivos que subís a El Asesor siguen siendo tuyos. Los usamos
        únicamente para generarte consejos y funciones dentro de la app, nunca los vendemos.
      </DocumentSection>
      <DocumentSection titulo="5. Servicios de terceros">
        Algunas funciones dependen de servicios externos — Instagram/Meta si conectás tu cuenta, y
        Stripe para procesar pagos. El uso de esas funciones también está sujeto a los términos de
        esos proveedores.
      </DocumentSection>
      <DocumentSection titulo="6. Cambios a estos términos">
        Podemos actualizar estos términos de vez en cuando. Si el cambio es importante, te
        avisamos dentro de la app.
      </DocumentSection>
      <DocumentSection titulo="7. Contacto">
        ¿Dudas sobre estos términos? Escribinos desde la sección Soporte, en Configuración.
      </DocumentSection>
    </DocumentScreen>
  );
}
