import type { WidgetTaskHandler, WidgetTaskHandlerProps } from 'react-native-android-widget';

import { api, ApiError, setAuthToken } from '@/api/client';
import { tokenStorage } from '@/lib/token-storage';

import { PreguntaWidget, type PreguntaEstado } from './pregunta-widget';
import { RachaWidget, type RachaEstado, type DiaSemana } from './racha-widget';

const TOKEN_STORAGE_KEY = 'elasesor.token';
// Mismo umbral que el recordatorio de racha (use-streak-reminder.tsx) — a
// partir de esta hora local, sin publicar todavía, se considera "urgente".
const HORA_LIMITE_RACHA = 20;

/** YYYY-MM-DD en hora local, igual que el resto de la app (ver index.tsx) —
 * nunca usar `toISOString` acá, corre el día por la zona horaria UTC. */
function fechaIsoLocal(fecha: Date): string {
  return new Intl.DateTimeFormat('en-CA').format(fecha);
}

const FORMATO_LETRA_DIA = new Intl.DateTimeFormat('es-AR', { weekday: 'narrow' });

/** Últimos 7 días (hoy incluido, al final), con la letra del día y si hubo
 * publicación — para la tira semanal estilo Duolingo. */
function calcularSemana(diasConPublicacion: Set<string>): DiaSemana[] {
  const hoyIso = fechaIsoLocal(new Date());
  const dias: DiaSemana[] = [];
  for (let i = 6; i >= 0; i--) {
    const fecha = new Date();
    fecha.setDate(fecha.getDate() - i);
    const iso = fechaIsoLocal(fecha);
    dias.push({
      letra: FORMATO_LETRA_DIA.format(fecha).toUpperCase(),
      publico: diasConPublicacion.has(iso),
      esHoy: iso === hoyIso,
    });
  }
  return dias;
}

/** Corre en un headless task de Android — puede que la app NUNCA haya
 * montado el árbol de React (proceso arrancado solo para esto), así que no
 * podemos depender de `AuthProvider`/`BusinessProvider`: hay que leer el
 * token del storage y pedir el negocio a mano. */
async function prepararSesion(): Promise<number | null> {
  const token = await tokenStorage.getItem(TOKEN_STORAGE_KEY);
  if (!token) return null;
  setAuthToken(token);
  const negocios = await api.listarNegocios();
  return negocios[0]?.id ?? null;
}

export async function calcularRacha(): Promise<RachaEstado> {
  try {
    const businessId = await prepararSesion();
    if (businessId == null) return { estado: 'sin_sesion' };

    const cuenta = await api.obtenerCuentaInstagram(businessId);
    const metricas = await api.obtenerMetricasInstagram(businessId);
    const diasConPublicacion = new Set(metricas.filter((m) => m.publico_contenido).map((m) => m.fecha));
    const hoy = fechaIsoLocal(new Date());
    const publicoHoy = diasConPublicacion.has(hoy);
    const urgente = !publicoHoy && new Date().getHours() >= HORA_LIMITE_RACHA;

    return {
      estado: 'ok',
      racha: cuenta.racha_actual,
      publicoHoy,
      urgente,
      semana: calcularSemana(diasConPublicacion),
    };
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return { estado: 'sin_instagram' };
    return { estado: 'error' };
  }
}

export async function calcularPregunta(): Promise<PreguntaEstado> {
  try {
    const businessId = await prepararSesion();
    if (businessId == null) return { estado: 'sin_sesion' };

    const pregunta = await api.preguntaDelDiaActual(businessId);
    if (!pregunta) return { estado: 'sin_pregunta' };

    return { estado: 'ok', pregunta: pregunta.pregunta, respondida: pregunta.respuesta != null };
  } catch {
    return { estado: 'error' };
  }
}

export const widgetTaskHandler: WidgetTaskHandler = async (props: WidgetTaskHandlerProps) => {
  const { widgetInfo, widgetAction, renderWidget } = props;
  console.log(`[widget] ${widgetInfo.widgetName} ${widgetAction}`);

  if (widgetAction === 'WIDGET_DELETED') return;
  if (widgetAction !== 'WIDGET_ADDED' && widgetAction !== 'WIDGET_UPDATE' && widgetAction !== 'WIDGET_RESIZED') {
    return;
  }

  // widgetInfo.width/height (dp) reflejan el tamaño real que el launcher le
  // dio al widget — puede no coincidir con el minWidth/minHeight declarado
  // en app.json (grillas de celda distintas según el equipo, o el usuario
  // lo agrandó/achicó a mano) — se lo pasamos al componente para que arme
  // el layout a ese tamaño en vez de asumir uno fijo.
  const { width, height } = widgetInfo;

  try {
    if (widgetInfo.widgetName === 'Racha') {
      // Se renderiza un estado "cargando" de entrada — si el fetch tarda o el
      // task se corta a mitad de camino, al menos se ve algo en vez de nada.
      renderWidget(<RachaWidget data={{ estado: 'cargando' }} width={width} height={height} />);
      renderWidget(<RachaWidget data={await calcularRacha()} width={width} height={height} />);
    } else if (widgetInfo.widgetName === 'PreguntaDelDia') {
      renderWidget(<PreguntaWidget data={{ estado: 'cargando' }} width={width} height={height} />);
      renderWidget(<PreguntaWidget data={await calcularPregunta()} width={width} height={height} />);
    }
  } catch (error) {
    console.error('[widget] fallo inesperado', error);
    if (widgetInfo.widgetName === 'Racha')
      renderWidget(<RachaWidget data={{ estado: 'error' }} width={width} height={height} />);
    else if (widgetInfo.widgetName === 'PreguntaDelDia')
      renderWidget(<PreguntaWidget data={{ estado: 'error' }} width={width} height={height} />);
  }
};
