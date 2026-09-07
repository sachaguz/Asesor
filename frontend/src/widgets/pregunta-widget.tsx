'use no memo';

import React from 'react';
import { FlexWidget, OverlapWidget, SvgWidget, TextWidget } from 'react-native-android-widget';

import { mascotAvatarSvg } from './mascot-svg';
import { WidgetColors as Colors } from './widget-colors';

type Dimensiones = { width: number; height: number };

export type PreguntaEstado =
  | { estado: 'cargando' | 'sin_sesion' | 'sin_negocio' | 'sin_pregunta' | 'error' }
  | { estado: 'ok'; pregunta: string; respondida: boolean };

// Ver el comentario equivalente en racha-widget.tsx: `data` va aparte de
// `width`/`height` para no perder la unión discriminada al mezclarla con
// props sueltas en JSX.
export type PreguntaWidgetProps = Dimensiones & { data: PreguntaEstado };

const MENSAJES = {
  cargando: 'Actualizando…',
  sin_sesion: 'Iniciá sesión en El Asesor',
  sin_negocio: 'Abrí la app para configurar tu negocio',
  sin_pregunta: 'Todavía no hay pregunta para hoy',
  error: 'No se pudo actualizar. Abrí la app.',
};

const clamp = (min: number, valor: number, max: number) => Math.min(max, Math.max(min, valor));

const BASE_WIDTH = 250;

/** RemoteViews (los widgets de Android) no soporta campos de texto reales
 * (no hay EditText disponible para widgets de terceros) — tocar el widget
 * abre la app para responder de verdad. La prioridad es que se alcance a
 * leer la pregunta completa, así que el resto del "chrome" (encabezado,
 * pista de "tocá para responder") se reduce al mínimo cuando el widget es
 * chico, y la pregunta gana las líneas extra cuando es grande. */
export function PreguntaWidget({ width, height, data }: PreguntaWidgetProps) {
  if (data.estado !== 'ok') {
    return <MensajeWidget texto={MENSAJES[data.estado]} width={width} height={height} />;
  }

  const { pregunta, respondida } = data;

  const escala = clamp(0.8, width / BASE_WIDTH, 1.8);
  const padding = clamp(8, 10 * escala, 18);
  const avatarSize = clamp(16, 20 * escala, 30);
  const etiquetaFontSize = clamp(8, 9 * escala, 12);
  const preguntaFontSize = clamp(11, 12.5 * escala, 18);
  const preguntaLineHeight = preguntaFontSize * 1.28;
  const pieFontSize = clamp(9, 10 * escala, 13);
  // Cuánto espacio vertical le queda a la pregunta descontando encabezado,
  // pie y padding — de ahí sale cuántas líneas entran sin desbordar.
  const chromeVertical = padding * 2 + etiquetaFontSize + pieFontSize + 18;
  const maxLines = clamp(2, Math.floor((height - chromeVertical) / preguntaLineHeight), 10);

  return (
    <OverlapWidget clickAction="OPEN_APP" style={{ height: 'match_parent', width: 'match_parent' }}>
      {/* Capa de fondo: degradé + mancha de color de adorno, recortada a las
          esquinas redondeadas. */}
      <FlexWidget
        style={{
          height: 'match_parent',
          width: 'match_parent',
          borderRadius: 18,
          backgroundGradient: { from: Colors.card, to: Colors.brandSoft, orientation: 'TL_BR' },
          overflow: 'hidden',
        }}>
        <FlexWidget style={{ alignItems: 'flex-end', width: 'match_parent' }}>
          <FlexWidget
            style={{
              width: 90,
              height: 90,
              borderRadius: 45,
              backgroundColor: 'rgba(124, 92, 252, 0.10)',
              marginTop: -40,
              marginRight: -30,
            }}
          />
        </FlexWidget>
      </FlexWidget>

      {/* Capa de contenido. */}
      <FlexWidget style={{ height: 'match_parent', width: 'match_parent', padding }}>
        <FlexWidget style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 5 }}>
          <SvgWidget
            svg={mascotAvatarSvg(respondida ? 'feliz' : 'neutral', Colors.brand)}
            style={{ width: avatarSize, height: avatarSize }}
          />
          <FlexWidget style={{ flex: 1, marginLeft: 6 }}>
            <TextWidget
              text={respondida ? 'PREGUNTA DEL DÍA · RESPONDIDA' : 'PREGUNTA DEL DÍA'}
              style={{ fontSize: etiquetaFontSize, color: Colors.brandDeep, fontWeight: 'bold', letterSpacing: 0.5 }}
              maxLines={1}
              truncate="END"
            />
          </FlexWidget>
          {respondida ? <TextWidget text="✅" style={{ fontSize: pieFontSize }} /> : null}
        </FlexWidget>

        <FlexWidget style={{ flex: 1 }}>
          <TextWidget
            text={pregunta}
            style={{ fontSize: preguntaFontSize, color: Colors.ink, lineHeight: preguntaLineHeight }}
            maxLines={maxLines}
            truncate="END"
          />
        </FlexWidget>

        <FlexWidget style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
          <TextWidget text="✏️" style={{ fontSize: pieFontSize }} />
          <TextWidget
            text={respondida ? ' Tocá para ver tu respuesta' : ' Tocá para responder'}
            style={{ fontSize: pieFontSize, color: Colors.inkSoft, marginLeft: 3 }}
          />
        </FlexWidget>
      </FlexWidget>
    </OverlapWidget>
  );
}

function MensajeWidget({ texto, width }: { texto: string } & Dimensiones) {
  const escala = clamp(0.8, width / BASE_WIDTH, 1.8);
  const avatarSize = clamp(22, 28 * escala, 40);
  const fontSize = clamp(10, 12 * escala, 16);

  return (
    <FlexWidget
      clickAction="OPEN_APP"
      style={{
        height: 'match_parent',
        width: 'match_parent',
        backgroundColor: Colors.card,
        borderRadius: 18,
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
