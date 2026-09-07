import { Platform } from 'react-native';

import { API_BASE_URL } from './config';
import type {
  Advice,
  ArchivoLocal,
  Business,
  BusinessContext,
  ChatMessage,
  ContentTip,
  DailyQuestion,
  GoogleDriveConnection,
  GoogleDriveSyncResult,
  ImportResult,
  InstagramAccount,
  InstagramDailyMetric,
  InstagramPatron,
  PaymentSheetParams,
  ResumenVentas,
  SubscriptionEstado,
  TokenResponse,
  User,
} from './types';

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string
  ) {
    super(message);
  }
}

// Token en una variable de módulo en vez de pasarlo por parámetro a cada
// llamada — hay una sola sesión activa por instancia de la app, y así no
// hay que tocar cada función de `api.*` para mandar el header.
let authToken: string | null = null;

export function setAuthToken(token: string | null): void {
  authToken = token;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const esFormData = init?.body instanceof FormData;
  const respuesta = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      ...(esFormData ? {} : { 'Content-Type': 'application/json' }),
      ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
      ...init?.headers,
    },
  });

  if (!respuesta.ok) {
    const detalle = await respuesta.text();
    throw new ApiError(respuesta.status, formatearErrorDetalle(detalle) || respuesta.statusText);
  }
  if (respuesta.status === 204) return undefined as T;
  return (await respuesta.json()) as T;
}

/** El backend manda errores como `{"detail": "..."}` (o, para errores de
 * validación de FastAPI, `{"detail": [{msg, ...}, ...]}`) — sin esto se
 * mostraba el JSON crudo tal cual en pantalla. */
function formatearErrorDetalle(cuerpo: string): string {
  try {
    const data = JSON.parse(cuerpo);
    if (typeof data.detail === 'string') return data.detail;
    if (Array.isArray(data.detail)) {
      return data.detail
        .map((d: { msg?: string }) => d.msg)
        .filter(Boolean)
        .join(' ');
    }
  } catch {
    // no era JSON — se usa el texto crudo tal cual
  }
  return cuerpo;
}

async function archivoAFormData(campo: string, archivo: ArchivoLocal): Promise<FormData> {
  const formData = new FormData();
  if (Platform.OS === 'web') {
    // En web, expo-document-picker da una blob: URL — el FormData del
    // navegador necesita un Blob/File real ahí, no el objeto {uri,name,type}
    // de abajo (eso es lo que entiende el fetch de React Native en nativo,
    // en web termina como el string literal "[object Object]").
    const blob = await fetch(archivo.uri).then((r) => r.blob());
    formData.append(campo, blob, archivo.name);
    return formData;
  }
  formData.append(
    campo,
    {
      uri: archivo.uri,
      name: archivo.name,
      type: archivo.mimeType ?? 'application/octet-stream',
    } as unknown as Blob
  );
  return formData;
}

export const api = {
  registrar: (email: string, password: string, nombre: string) =>
    request<TokenResponse>('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password, nombre }),
    }),

  iniciarSesion: (email: string, password: string) =>
    request<TokenResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),

  iniciarSesionGoogle: (idToken: string) =>
    request<TokenResponse>('/auth/google', {
      method: 'POST',
      body: JSON.stringify({ id_token: idToken }),
    }),

  perfilActual: () => request<User>('/auth/me'),

  verificarEmail: (token: string) =>
    request<{ verificado: boolean }>('/auth/verify-email', {
      method: 'POST',
      body: JSON.stringify({ token }),
    }),

  reenviarVerificacion: () => request<void>('/auth/resend-verification', { method: 'POST' }),

  olvidePassword: (email: string) =>
    request<void>('/auth/forgot-password', { method: 'POST', body: JSON.stringify({ email }) }),

  resetearPassword: (token: string, password: string) =>
    request<TokenResponse>('/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify({ token, password }),
    }),

  eliminarCuenta: (confirmacion: string) =>
    request<void>('/auth/me', { method: 'DELETE', body: JSON.stringify({ confirmacion }) }),

  crearNegocio: (nombre: string, giro: string) =>
    request<Business>('/businesses', { method: 'POST', body: JSON.stringify({ nombre, giro }) }),

  listarNegocios: () => request<Business[]>('/businesses'),

  obtenerConsejos: (businessId: number) => request<Advice[]>(`/businesses/${businessId}/advice`),

  resumenVentasDeAyer: (businessId: number) =>
    request<ResumenVentas>(`/businesses/${businessId}/sales/resumen-ayer`),

  generarConsejos: (businessId: number) =>
    request<Advice[]>(`/businesses/${businessId}/advice/generate`, { method: 'POST' }),

  obtenerContexto: (businessId: number) =>
    request<BusinessContext[]>(`/businesses/${businessId}/context`),

  eliminarContexto: (businessId: number, contextId: number) =>
    request<void>(`/businesses/${businessId}/context/${contextId}`, { method: 'DELETE' }),

  agregarContextoTexto: (businessId: number, texto: string) =>
    request<BusinessContext>(`/businesses/${businessId}/context`, {
      method: 'POST',
      body: JSON.stringify({ texto }),
    }),

  agregarContextoArchivo: async (businessId: number, archivo: ArchivoLocal) =>
    request<BusinessContext>(`/businesses/${businessId}/context/files`, {
      method: 'POST',
      body: await archivoAFormData('archivo', archivo),
    }),

  importarVentasCsv: async (businessId: number, archivo: ArchivoLocal) =>
    request<ImportResult>(`/businesses/${businessId}/sales/import`, {
      method: 'POST',
      body: await archivoAFormData('archivo', archivo),
    }),

  preguntaDelDiaActual: (businessId: number) =>
    request<DailyQuestion | null>(`/businesses/${businessId}/daily-question/current`),

  generarPreguntaDelDia: (businessId: number) =>
    request<DailyQuestion>(`/businesses/${businessId}/daily-question/generate`, { method: 'POST' }),

  responderPreguntaDelDia: (businessId: number, questionId: number, respuesta: string) =>
    request<DailyQuestion>(`/businesses/${businessId}/daily-question/${questionId}/answer`, {
      method: 'POST',
      body: JSON.stringify({ respuesta }),
    }),

  obtenerChat: (businessId: number) => request<ChatMessage[]>(`/businesses/${businessId}/chat`),

  enviarMensajeChat: (businessId: number, mensaje: string) =>
    request<ChatMessage>(`/businesses/${businessId}/chat`, {
      method: 'POST',
      body: JSON.stringify({ mensaje }),
    }),

  conectarInstagram: (businessId: number) =>
    request<{ url: string }>(`/businesses/${businessId}/instagram/connect`),

  obtenerCuentaInstagram: (businessId: number) =>
    request<InstagramAccount>(`/businesses/${businessId}/instagram`),

  desconectarInstagram: (businessId: number) =>
    request<void>(`/businesses/${businessId}/instagram`, { method: 'DELETE' }),

  sincronizarInstagram: (businessId: number) =>
    request<InstagramDailyMetric>(`/businesses/${businessId}/instagram/sync`, { method: 'POST' }),

  obtenerMetricasInstagram: (businessId: number) =>
    request<InstagramDailyMetric[]>(`/businesses/${businessId}/instagram/metrics`),

  obtenerPatronesInstagram: (businessId: number) =>
    request<InstagramPatron[]>(`/businesses/${businessId}/instagram/patterns`),

  conectarGoogleDrive: (businessId: number) =>
    request<{ url: string }>(`/businesses/${businessId}/google-drive/connect`),

  obtenerConexionGoogleDrive: (businessId: number) =>
    request<GoogleDriveConnection>(`/businesses/${businessId}/google-drive`),

  desconectarGoogleDrive: (businessId: number) =>
    request<void>(`/businesses/${businessId}/google-drive`, { method: 'DELETE' }),

  elegirCarpetaGoogleDrive: (businessId: number, folderUrl: string) =>
    request<GoogleDriveConnection>(`/businesses/${businessId}/google-drive/folder`, {
      method: 'POST',
      body: JSON.stringify({ folder_url: folderUrl }),
    }),

  sincronizarGoogleDrive: (businessId: number) =>
    request<GoogleDriveSyncResult>(`/businesses/${businessId}/google-drive/sync`, {
      method: 'POST',
    }),

  tipDeContenidoActual: (businessId: number) =>
    request<ContentTip | null>(`/businesses/${businessId}/content-tip/current`),

  generarTipDeContenido: (businessId: number) =>
    request<ContentTip>(`/businesses/${businessId}/content-tip/generate`, { method: 'POST' }),

  estadoSuscripcion: () => request<SubscriptionEstado>('/subscription/estado'),

  crearPaymentSheet: () =>
    request<PaymentSheetParams>('/subscription/payment-sheet', { method: 'POST' }),
};
