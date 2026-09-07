import { Platform } from 'react-native';
import { requestWidgetUpdate } from 'react-native-android-widget';

import { calcularPregunta, calcularRacha } from './widget-task-handler';
import { PreguntaWidget } from './pregunta-widget';
import { RachaWidget } from './racha-widget';

/** Los widgets solo se refrescan solos cada 30 min (el mínimo que permite
 * Android) o al agregarlos/redimensionarlos — nada dispara un refresco
 * cuando algo relevante cambia adentro de la app. Se llama a esto desde el
 * `onSuccess` de las mutations que sí cambian ese dato (responder la
 * pregunta, sincronizar Instagram) para que el widget se vea actualizado
 * al toque en vez de esperar hasta media hora. */
export function refrescarWidgetPregunta(): void {
  if (Platform.OS !== 'android') return;
  requestWidgetUpdate({
    widgetName: 'PreguntaDelDia',
    renderWidget: async ({ width, height }) => (
      <PreguntaWidget data={await calcularPregunta()} width={width} height={height} />
    ),
  }).catch(() => {});
}

export function refrescarWidgetRacha(): void {
  if (Platform.OS !== 'android') return;
  requestWidgetUpdate({
    widgetName: 'Racha',
    renderWidget: async ({ width, height }) => (
      <RachaWidget data={await calcularRacha()} width={width} height={height} />
    ),
  }).catch(() => {});
}
