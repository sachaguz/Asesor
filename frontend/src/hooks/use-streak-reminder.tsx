import * as Notifications from 'expo-notifications';
import { useEffect } from 'react';
import { AppState } from 'react-native';

import { api } from '@/api/client';

const REMINDER_ID = 'racha-instagram-reminder';
const HORA_RECORDATORIO = 20; // 8pm hora local del dispositivo

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: false,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

/**
 * Recordatorio local (no push del servidor — no hay infraestructura de cron
 * todavía) tipo "no perdás tu racha": si a esta hora todavía no publicaste
 * nada hoy, dispara una notificación. Se revisa cada vez que la app pasa a
 * primer plano, así que solo funciona mientras la app se abra al menos una
 * vez al día — suficiente para el MVP, sin necesitar push real del backend.
 */
export function useStreakReminder(businessId: number | null | undefined, suscrito: boolean) {
  useEffect(() => {
    if (!suscrito || businessId == null) return;

    const revisarYAgendar = async () => {
      try {
        const { status: actual } = await Notifications.getPermissionsAsync();
        let status = actual;
        if (status !== 'granted') {
          ({ status } = await Notifications.requestPermissionsAsync());
        }
        if (status !== 'granted') return;

        const metricas = await api.obtenerMetricasInstagram(businessId);
        const hoy = new Date().toISOString().slice(0, 10);
        const publicoHoy = metricas.some((m) => m.fecha === hoy && m.publico_contenido);

        await Notifications.cancelScheduledNotificationAsync(REMINDER_ID).catch(() => {});
        if (publicoHoy) return;

        const disparo = new Date();
        disparo.setHours(HORA_RECORDATORIO, 0, 0, 0);
        if (disparo <= new Date()) return;

        await Notifications.scheduleNotificationAsync({
          identifier: REMINDER_ID,
          content: {
            title: '🔥 No perdás tu racha',
            body: 'Todavía no publicaste nada hoy en Instagram.',
          },
          trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: disparo },
        });
      } catch {
        // Sin Instagram conectado (404) o cualquier otro fallo de red: no
        // hay nada que recordar, y es un recordatorio, no algo crítico.
      }
    };

    revisarYAgendar();
    const suscripcion = AppState.addEventListener('change', (estado) => {
      if (estado === 'active') revisarYAgendar();
    });
    return () => suscripcion.remove();
  }, [businessId, suscrito]);
}
