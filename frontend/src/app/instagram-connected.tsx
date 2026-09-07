import { Redirect } from 'expo-router';

// expo-router intercepta cualquier apertura de `elasesor://...` como
// navegación, aparte de que expo-web-browser ya resuelve el resultado del
// login dentro de negocio.tsx — esta ruta solo evita el "Unmatched Route"
// y devuelve a la pantalla real.
export default function InstagramConnectedScreen() {
  return <Redirect href="/(tabs)/negocio" />;
}
