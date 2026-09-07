import { Redirect } from 'expo-router';

// Mismo motivo que instagram-connected.tsx: evita el "Unmatched Route"
// cuando expo-router intercepta la apertura de `elasesor://...`.
export default function GoogleDriveConnectedScreen() {
  return <Redirect href="/(tabs)/negocio" />;
}
