/**
 * "localhost" resuelve distinto según dónde corra la app: en el emulador de
 * Android hay que usar 10.0.2.2, en un dispositivo físico (Expo Go) hace
 * falta la IP de LAN de esta máquina. Configurable vía EXPO_PUBLIC_API_BASE_URL
 * en frontend/.env — ver frontend/.env.example.
 */
export const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL ?? 'http://localhost:8000';
