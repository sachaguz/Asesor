// `@expo/metro-runtime` MUST be the first import to ensure Fast Refresh works
// on web.
import '@expo/metro-runtime';

import { Platform } from 'react-native';

import { App } from 'expo-router/build/qualified-entry';
import { renderRootComponent } from 'expo-router/build/renderRootComponent';
import { registerWidgetTaskHandler } from 'react-native-android-widget';

import { widgetTaskHandler } from '@/widgets/widget-task-handler';

// Reemplaza a `expo-router/entry` (ver su código fuente) para poder además
// registrar el task handler de los widgets de Android — no puede ir en
// ningún componente, tiene que registrarse acá, en el entry point.
renderRootComponent(App);

// AppRegistry.registerHeadlessTask (que usa registerWidgetTaskHandler por
// dentro) no existe en react-native-web — sin este guard, tira una excepción
// sin capturar en cada carga web.
if (Platform.OS === 'android') {
  registerWidgetTaskHandler(widgetTaskHandler);
}
