import { Baloo2_500Medium, Baloo2_600SemiBold } from '@expo-google-fonts/baloo-2';
import {
  Manrope_400Regular,
  Manrope_600SemiBold,
  Manrope_700Bold,
} from '@expo-google-fonts/manrope';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useFonts } from 'expo-font';
import { Redirect, Stack, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useMemo } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { TourOverlay } from '@/components/tour-overlay';
import { AuthProvider, useAuth } from '@/hooks/use-auth';
import { BusinessProvider, useBusinessId } from '@/hooks/use-business-id';
import { SubscriptionProvider, useSubscription } from '@/hooks/use-subscription';
import { useStreakReminder } from '@/hooks/use-streak-reminder';
import { ThemeProvider, useTheme } from '@/hooks/use-theme';
import { TourProvider } from '@/hooks/use-tour';
import { StripeProvider } from '@/lib/stripe';

SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient();
const STRIPE_PUBLISHABLE_KEY = process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? '';

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <QueryClientProvider client={queryClient}>
          <AuthProvider>
            <BusinessProvider>
              <StripeProvider publishableKey={STRIPE_PUBLISHABLE_KEY}>
                <SubscriptionProvider>
                  <TourProvider>
                    <RootLayoutNav />
                  </TourProvider>
                </SubscriptionProvider>
              </StripeProvider>
            </BusinessProvider>
          </AuthProvider>
        </QueryClientProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

function RootLayoutNav() {
  const [fontsLoaded] = useFonts({
    Baloo2_500Medium,
    Baloo2_600SemiBold,
    Manrope_400Regular,
    Manrope_600SemiBold,
    Manrope_700Bold,
  });
  const { token, user, cargando: cargandoAuth } = useAuth();
  const { businessId, cargando: cargandoBusiness } = useBusinessId();
  const { colors, scheme } = useTheme();
  const { suscrito } = useSubscription();
  const segments = useSegments();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const listo = fontsLoaded && !cargandoAuth && !cargandoBusiness;

  useStreakReminder(businessId, suscrito);

  useEffect(() => {
    if (listo) SplashScreen.hideAsync();
  }, [listo]);

  // Redirect DECLARATIVO en vez de llamar a router.replace() a mano desde un
  // efecto: con el imperativo, un router.replace() que llega un instante
  // antes de que el navegador termine de asentarse produce
  // "REPLACE ... was not handled by any navigator" — pasaba justo después de
  // registrarse o de crear el negocio, y en nativo directamente no navegaba.
  // <Redirect> es el patrón que expo-router espera para esto: se limita a
  // pedir la ruta mientras la condición siga siendo cierta, y deja de
  // renderizarse solo cuando `segments` ya refleja el cambio — sin timings
  // manuales.
  let redirectTo: '/login' | '/onboarding' | '/(tabs)' | '/verificar-correo' | null = null;
  // verify-email y reset-password son deep links que llegan desde un correo
  // — tienen que ser alcanzables sin importar si hay sesión o negocio
  // todavía, y se encargan solas de navegar a otro lado cuando terminan.
  const esPantallaStandalone = segments[0] === 'verify-email' || segments[0] === 'reset-password';
  if (listo && !esPantallaStandalone) {
    const enAuth =
      segments[0] === 'login' || segments[0] === 'register' || segments[0] === 'forgot-password';
    const enOnboarding = segments[0] === 'onboarding';
    const enVerificarCorreo = segments[0] === 'verificar-correo';
    if (token == null) {
      if (!enAuth) redirectTo = '/login';
    } else if (user && !user.email_verificado) {
      if (!enVerificarCorreo) redirectTo = '/verificar-correo';
    } else if (businessId == null) {
      if (!enOnboarding) redirectTo = '/onboarding';
    } else if (enAuth || enOnboarding || enVerificarCorreo) {
      redirectTo = '/(tabs)';
    }
  }

  return (
    <>
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
      <Stack screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
        <Stack.Screen name="login" options={{ animation: 'fade' }} />
        <Stack.Screen name="register" />
        <Stack.Screen name="forgot-password" />
        <Stack.Screen name="reset-password" />
        <Stack.Screen name="verify-email" />
        <Stack.Screen name="verificar-correo" />
        <Stack.Screen name="onboarding" options={{ animation: 'fade_from_bottom' }} />
        <Stack.Screen name="(tabs)" options={{ animation: 'fade' }} />
        <Stack.Screen name="configuracion" options={{ presentation: 'modal' }} />
        <Stack.Screen name="eliminar-cuenta" />
        <Stack.Screen name="terminos" />
        <Stack.Screen name="privacidad" />
        <Stack.Screen name="soporte" />
      </Stack>
      {redirectTo && <Redirect href={redirectTo} />}
      <TourOverlay />
      {!listo && (
        // Overlay, nunca un return temprano que reemplace al <Stack>: si el
        // navegador se desmonta y se vuelve a montar cada vez que `listo`
        // parpadea a false (pasa un instante al resolver si hay negocio),
        // cualquier navegación pendiente le llega a un <Stack> recién
        // montado que todavía no terminó de asentarse.
        <View style={[StyleSheet.absoluteFill, styles.loading]}>
          <ActivityIndicator color={colors.brand} />
        </View>
      )}
    </>
  );
}

function createStyles(colors: ReturnType<typeof useTheme>['colors']) {
  return StyleSheet.create({
    loading: {
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.background,
    },
  });
}
