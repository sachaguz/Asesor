import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

/**
 * expo-secure-store no tiene implementación en web (usa Keychain/Keystore,
 * que no existen ahí) — en web cae a AsyncStorage. En nativo (el target
 * real de la app) sí usa el storage seguro del sistema operativo.
 */
export const tokenStorage = {
  getItem(key: string): Promise<string | null> {
    return Platform.OS === 'web' ? AsyncStorage.getItem(key) : SecureStore.getItemAsync(key);
  },
  setItem(key: string, value: string): Promise<void> {
    return Platform.OS === 'web'
      ? AsyncStorage.setItem(key, value)
      : SecureStore.setItemAsync(key, value);
  },
  removeItem(key: string): Promise<void> {
    return Platform.OS === 'web' ? AsyncStorage.removeItem(key) : SecureStore.deleteItemAsync(key);
  },
};
