export type Veredicto = 'RESURTE' | 'NO_PIDAS' | 'VIGILA';
export type Confianza = 'ALTA' | 'BAJA';

export interface User {
  id: number;
  email: string;
  nombre: string;
  email_verificado: boolean;
  created_at: string;
}

export interface TokenResponse {
  access_token: string;
  token_type: string;
}

export interface Business {
  id: number;
  nombre: string;
  giro: string;
  created_at: string;
}

export interface Advice {
  id: number;
  product_id: number;
  producto: string;
  veredicto: Veredicto;
  confianza: Confianza;
  texto: string;
  datos_que_lo_respaldan: Record<string, unknown>;
  fecha: string;
  created_at: string;
}

export interface BusinessContext {
  id: number;
  texto: string | null;
  archivo_path: string | null;
  created_at: string;
}

export interface DailyQuestion {
  id: number;
  pregunta: string;
  respuesta: string | null;
  fecha_pregunta: string;
  fecha_respuesta: string | null;
  created_at: string;
}

export interface ChatMessage {
  id: number;
  role: 'USER' | 'ASSISTANT';
  contenido: string;
  created_at: string;
}

export interface ImportResult {
  filas_importadas: number;
  errores: string[];
}

export interface ResumenVentas {
  fecha: string | null;
  monto: string;
  unidades: number;
}

export interface ArchivoLocal {
  uri: string;
  name: string;
  mimeType?: string | null;
}

export interface InstagramAccount {
  username: string;
  connected_at: string;
  token_expires_at: string;
  racha_actual: number;
  racha_maxima: number;
}

export interface InstagramDailyMetric {
  fecha: string;
  reach: number;
  accounts_engaged: number;
  views: number;
  followers_count: number;
  publico_contenido: boolean;
}

export interface GoogleDriveConnection {
  folder_id: string | null;
  folder_name: string | null;
  connected_at: string;
  last_synced_at: string | null;
}

export interface GoogleDriveSyncResult {
  archivos_importados: number;
  filas_importadas: number;
  errores: string[];
}

export interface ContentTip {
  id: number;
  texto: string;
  fecha: string;
  created_at: string;
}

export interface SubscriptionEstado {
  suscrito: boolean;
}

export interface PaymentSheetParams {
  payment_intent_client_secret: string;
  ephemeral_key_secret: string;
  customer_id: string;
}

export type InstagramMediaType = 'IMAGE' | 'VIDEO' | 'CAROUSEL_ALBUM';

export interface InstagramPatron {
  media_type: InstagramMediaType;
  cantidad: number;
  reach_promedio: number;
  likes_promedio: number;
  comments_promedio: number;
  saved_promedio: number;
}
