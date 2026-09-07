'use no memo';

import React from 'react';
import { FlexWidget, OverlapWidget, SvgWidget, TextWidget } from 'react-native-android-widget';

import { mascotAvatarSvg } from './mascot-svg';
import { WidgetColors as Colors } from './widget-colors';

export type DiaSemana = { letra: string; publico: boolean; esHoy: boolean };

type Dimensiones = { width: number; height: number };

export type RachaEstado =
  | { estado: 'cargando' | 'sin_sesion' | 'sin_negocio' | 'sin_instagram' | 'error' }
  | { estado: 'ok'; racha: number; publicoHoy: boolean; urgente: boolean; semana: DiaSemana[] };

// `data` va como un único objeto (en vez de props sueltas) a propósito: si
// se desarma el estado (unión discriminada) y se lo vuelve a mezclar con
// `width`/`height` como atributos JSX separados, TypeScript pierde la
// correlación entre `estado: 'ok'` y sus campos (`racha`, `semana`, etc.).
export type RachaWidgetProps = Dimensiones & { data: RachaEstado };

const MENSAJES = {
  cargando: 'Actualizando…',
  sin_sesion: 'Iniciá sesión en El Asesor',
  sin_negocio: 'Abrí la app para configurar tu negocio',
  sin_instagram: 'Conectá tu Instagram en la app',
  error: 'No se pudo actualizar. Abrí la app.',
};

const clamp = (min: number, valor: number, max: number) => Math.min(max, Math.max(min, valor));

/** Tamaño "de diseño" (declarado en app.json) contra el que se calcula la
 * escala — el ancho/alto real que da el launcher casi nunca es exactamente
 * este (grilla de celda distinta según el equipo, o el usuario redimensionó
 * el widget a mano), así que todo el layout de abajo se recalcula en base a
 * `width`/`height` reales en vez de asumir este tamaño. */
const BASE_WIDTH = 180;

/** Widget de racha "estilo Duolingo", con la mascota de la app en vez de un
 * ícono genérico. Sin animación real (RemoteViews no soporta Lottie/gif) —
 * la "desesperación" se aproxima con la cara de la mascota, el color y el
 * texto cuando queda poco tiempo del día sin publicar. */
export function RachaWidget({ width, height, data }: RachaWidgetProps) {
  if (data.estado !== 'ok') {
    return <MensajeWidget texto={MENSAJES[data.estado]} width={width} height={height} />;
  }

  const { racha, publicoHoy, urgente, semana } = data;
  const acento = urgente ? Colors.nopidas : publicoHoy ? Colors.resurte : Colors.brand;
  const mood = urgente ? 'preocupado' : publicoHoy ? 'feliz' : 'neutral';
  const subtitulo = urgente
    ? '¡Se acaba el día!'
    : publicoHoy
      ? 'Racha asegurada hoy'
      : racha > 0
        ? 'Publicá algo hoy'
        : 'Arrancá tu racha hoy';

  // Escala general para tipografía/avatar a partir del ancho real.
  const escala = clamp(0.85, width / BASE_WIDTH, 1.9);
  const padding = clamp(8, 9 * escala, 16);
  const avatarSize = clamp(28, 34 * escala, 48);
  const rachaFontSize = clamp(16, 19 * escala, 28);
  const diaFontSize = clamp(9, 10 * escala, 13);
  const subFontSize = clamp(8, 9 * escala, 13);

  // La tira de 7 días se calcula directo del ancho disponible (no de la
  // escala general) para garantizar que siempre entren los 7 círculos sin
  // recortarse, sea cual sea el ancho real del widget.
  const anchoContenido = width - padding * 2;
  const circulo = clamp(11, (anchoContenido / 7) * 0.55, 22);
  const letraFontSize = clamp(6, circulo * 0.55, 11);
  // A menos de ~95dp de alto no entra cómodo la letra del día arriba del
  // círculo — se prioriza que la tira quepa a mostrar la letra.
  const mostrarLetraDia = height >= 95;

  return (
    <OverlapWidget
      clickAction="OPEN_URI"
      clickActionData={{ uri: 'elasesor://redes' }}
      style={{ height: 'match_parent', width: 'match_parent' }}>
      {/* Capa de fondo: degradé suave + una mancha de color de adorno,
          recortada a las esquinas redondeadas de la tarjeta. */}
      <FlexWidget
        style={{
          height: 'match_parent',
          width: 'match_parent',
          borderRadius: 16,
          backgroundGradient: {
            from: Colors.card,
            to: urgente ? Colors.nopidasBg : publicoHoy ? Colors.resurteBg : Colors.brandSoft,
            orientation: 'TL_BR',
          },
          overflow: 'hidden',
        }}>
        <FlexWidget style={{ alignItems: 'flex-end', width: 'match_parent' }}>
          <FlexWidget
            style={{
              width: 70,
              height: 70,
              borderRadius: 35,
              backgroundColor: 'rgba(124, 92, 252, 0.12)',
              marginTop: -30,
              marginRight: -20,
            }}
          />
        </FlexWidget>
      </FlexWidget>

      {/* Capa de contenido. */}
      <FlexWidget
        style={{ height: 'match_parent', width: 'match_parent', padding, justifyContent: 'space-between' }}>
        <FlexWidget style={{ flexDirection: 'row', alignItems: 'center' }}>
          <SvgWidget
            svg={mascotAvatarSvg(mood, acento)}
            style={{ width: avatarSize, height: avatarSize }}
          />
          <FlexWidget style={{ marginLeft: 7, flex: 1 }}>
            <FlexWidget style={{ flexDirection: 'row', alignItems: 'flex-end' }}>
              <TextWidget
                text={String(racha)}
                style={{ fontSize: rachaFontSize, color: Colors.ink, fontWeight: 'bold' }}
              />
              <TextWidget
                text={racha === 1 ? ' día' : ' días'}
                style={{ fontSize: diaFontSize, color: Colors.inkSoft, marginBottom: 2, marginLeft: 2 }}
              />
            </FlexWidget>
            <TextWidget
              text={subtitulo}
              style={{ fontSize: subFontSize, color: urgente ? Colors.nopidasInk : Colors.inkSoft }}
              maxLines={1}
              truncate="END"
            />
          </FlexWidget>
        </FlexWidget>

        <FlexWidget style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 5 }}>
          {semana.map((dia, i) => (
            <FlexWidget key={i} style={{ alignItems: 'center' }}>
              {mostrarLetraDia ? (
                <TextWidget
                  text={dia.letra}
                  style={{ fontSize: letraFontSize, color: Colors.inkSoft, marginBottom: 2 }}
                />
              ) : null}
              <FlexWidget
                style={{
                  width: circulo,
                  height: circulo,
                  borderRadius: circulo / 2,
                  backgroundColor: dia.publico ? Colors.brand : Colors.card,
                  borderWidth: dia.esHoy ? 1.5 : 1,
                  borderColor: dia.publico ? Colors.brandDeep : Colors.line,
                  justifyContent: 'center',
                  alignItems: 'center',
                }}>
                {dia.publico ? (
                  <TextWidget text="✓" style={{ fontSize: circulo * 0.58, color: Colors.white }} />
                ) : null}
              </FlexWidget>
            </FlexWidget>
          ))}
        </FlexWidget>
      </FlexWidget>
    </OverlapWidget>
  );
}

function MensajeWidget({ texto, width }: { texto: string } & Dimensiones) {
  const escala = clamp(0.85, width / BASE_WIDTH, 1.9);
  const avatarSize = clamp(24, 30 * escala, 42);
  const fontSize = clamp(10, 12 * escala, 16);
  return (
    <FlexWidget
      clickAction="OPEN_APP"
      style={{
        height: 'match_parent',
        width: 'match_parent',
        backgroundColor: Colors.card,
        borderRadius: 16,
        padding: 12,
        justifyContent: 'center',
        alignItems: 'center',
      }}>
      <SvgWidget
        svg={mascotAvatarSvg('neutral', Colors.brand)}
        style={{ width: avatarSize, height: avatarSize, marginBottom: 6 }}
      />
      <TextWidget text={texto} style={{ fontSize, color: Colors.inkSoft, textAlign: 'center' }} maxLines={2} />
    </FlexWidget>
  );
}
