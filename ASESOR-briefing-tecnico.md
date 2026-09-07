# El Asesor — Briefing técnico de arranque

> Documento para arrancar el proyecto en Claude Code. Pégalo como primer contexto,
> o guárdalo como `CLAUDE.md` en la raíz del repositorio para que Claude Code lo lea siempre.

---

## 1. Qué estamos construyendo (en una frase)

Un **asesor de negocio para comercios tradicionales que ya tienen punto de venta**. No es un
dashboard: es un asistente que revisa las ventas y le dice al dueño, en su idioma y en frases
accionables, **qué le conviene resurtir y qué no**. El primer giro (y primer cliente real) es una
**zapatería**.

La propuesta de valor no está en mostrar datos, sino en **entregar una decisión**: "resurte este
modelo aunque te quedó una talla suelta; deja de pedir este otro que lleva 3 meses parado".

---

## 2. Principios de producto que mandan sobre las decisiones técnicas

Estos no son adornos: cada uno tiene consecuencias en el código.

1. **Un consejo, no un reporte.** La salida del sistema es texto en lenguaje natural con un veredicto
   claro (Resurte / No pidas / Vigila) + el porqué. Nada de gráficas obligatorias.
2. **El buen consejo depende de contexto que NO está en las ventas.** Ej.: "la talla 22 es de punta,
   siempre sale al último; que quede suelta no significa que el modelo esté muerto". El sistema debe
   combinar datos de ventas **con conocimiento del giro + contexto que el dueño aporta**.
3. **La confianza se pierde con UN consejo tonto.** Un comerciante tradicional cierra la app para
   siempre si el primer consejo contradice su experiencia de forma obvia. → La calidad del consejo
   importa más que el volumen de features.
4. **El "conocimiento del giro" es una pieza intercambiable.** Hoy calzado; mañana farmacia/ropa.
   Debe vivir separado del núcleo, no incrustado.
5. **Bajo costo y baja fricción.** El usuario ya tiene POS; no queremos obligarlo a capturar datos a
   mano ni a instalar cosas raras.

---

## 3. Decisiones ya tomadas (contexto, no re-discutir salvo que haga falta)

- **Usuario:** comerciante tradicional con POS que ya genera datos de ventas pero no los aprovecha.
- **Dolor concreto:** decisión de resurtido por modelo y por temporada.
- **Forma:** app (móvil o escritorio) con un asesor conversacional; hay un frontend ya bocetado
  (ver `asesor-zapateria-v6.html`, adjunto como referencia visual — es solo fachada, sin backend).
- **Onboarding definido:** configuración del negocio (identidad, giro, temporadas, contexto libre,
  archivos adjuntos) → el asesor "analiza" → entrega un **primer consejo** → pregunta del día → tour.
- **Pregunta del día:** el asesor hace UNA pregunta diaria para ir aprendiendo contexto que no está
  en los datos. Debe existir un mecanismo que muestre que la respuesta se usó (cerrar el círculo).

---

## 4. Stack recomendado

> Perfil del dev: programa bien. Preferencia declarada: modelo **open source** para la IA. Hosting:
> **a decidir → recomendación: nube.** Todo lo de abajo es una recomendación con su porqué; cámbialo
> si tienes una razón mejor, pero lee el porqué antes.

### 4.1. Backend
- **Lenguaje/framework: Python + FastAPI.**
  - Porqué: el ecosistema de IA/LLM/data vive en Python; FastAPI es rápido, tipado (Pydantic),
    async, y con documentación OpenAPI automática. Encaja perfecto con un backend que orquesta
    llamadas a un modelo y hace análisis de datos.
  - Alternativa válida si prefieres TS end-to-end: **NestJS**. Pierdes cercanía al ecosistema de IA.

### 4.2. Base de datos
- **PostgreSQL.**
  - Porqué: relacional (ventas, modelos, tallas, temporadas encajan en tablas), robusto, gratis,
    corre en cualquier nube. Con `pgvector` te sirve además para búsquedas semánticas / memoria del
    asesor más adelante, sin meter otra pieza.
- ORM: **SQLAlchemy 2.x + Alembic** (migraciones).

### 4.3. La IA (el "asesor") — LA DECISIÓN CLAVE
Diséñala como una **pieza intercambiable detrás de una interfaz** (patrón provider/adapter). NO
acoples el resto del backend a un modelo concreto.

```
            ┌─────────────────────────────┐
            │   AdvisorService (núcleo)   │  ← arma el contexto, aplica reglas de giro,
            └──────────────┬──────────────┘     decide QUÉ preguntarle al modelo
                           │  interfaz LLMProvider (generate(prompt) -> texto)
          ┌────────────────┼────────────────┐
          │                │                │
   OpenSourceProvider  HostedProvider   MockProvider
   (Llama/Qwen/etc.)   (API comercial)  (respuestas fijas, para tests)
```

- **Recomendación de arranque:** implementa **primero `MockProvider`** (respuestas predefinidas) para
  poder construir y probar TODO el backend sin depender de infraestructura de IA. Luego enchufas el
  modelo real cambiando una sola clase.
- **Para el modelo open source:** empieza probando en local con **Ollama** (corre Llama 3.1 / Qwen 2.5
  con un comando, sin pelearte con GPUs desde el día uno). Cuando valides que el producto sirve y
  necesites servirlo a usuarios, evalúa **vLLM** en una nube con GPU. Modelos candidatos a evaluar
  por su relación calidad/tamaño: **Qwen 2.5 (7B/14B instruct)**, **Llama 3.1 8B instruct**,
  **Mistral**. Para consejos de negocio en español, prueba varios: la calidad varía.
- ⚠️ **Advertencia honesta:** un open source que dé consejos confiables no es gratis de operar (GPU).
  Tenlo presupuestado. El patrón de arriba existe justamente para que puedas validar el producto con
  un modelo fácil primero y migrar a open source cuando el costo tenga sentido.

### 4.4. Ingesta de datos del POS (el punto MÁS espinoso — leer con atención)
Este es el módulo que decide si el producto es real. Cada POS guarda las ventas distinto.

- **No intentes soportar "todos los POS" al inicio.** Soporta **uno** — idealmente el que usa la
  zapatería del primer cliente — y hazlo bien.
- Diseña un **`SalesImporter` con interfaz común** (misma idea de adapter) que normalice cualquier
  fuente a un modelo interno de "venta" (fecha, modelo, talla, cantidad, precio). Fuentes iniciales:
  1. **Export a CSV/Excel** del POS (lo más universal para empezar).
  2. API del POS si la tiene (segunda fase).
- Averigua PRIMERO qué POS usa la zapatería y si exporta CSV/Excel. Eso destraba todo lo demás.

### 4.5. Archivos de contexto (PDF, Excel, fotos de libreta)
El onboarding permite subir archivos. Procesarlos bien es difícil; escalona:
- Fase 1: acepta y guarda el archivo, extrae texto de PDF/Excel (texto plano) para dárselo al modelo
  como contexto.
- Fase 2 (después): OCR de fotos de libretas manuscritas. Es un problema serio; no lo metas al MVP.

### 4.6. Hosting / infra (recomendación: nube)
- **Por qué nube y no local en la compu de la tienda:** una app local es una pesadilla de instalación
  y actualización por cada tienda, y si se descompone la máquina, se pierde todo. La nube te deja
  iterar, respaldar y actualizar sin tocar el changarro del cliente.
- **Para empezar (barato y simple):** un contenedor (Docker) en **Railway / Render / Fly.io** +
  Postgres administrado. Nada de Kubernetes al inicio.
- **Privacidad (importante para este usuario):** las ventas son sagradas. Cífralas en reposo, aísla
  los datos por negocio, sé explícito en la app sobre que no se comparten (ya está prometido en el
  onboarding). Documenta esto desde el día uno; para un comerciante desconfiado es decisivo.

### 4.7. Frontend (ya bocetado, para después)
- El boceto está en HTML/CSS/JS puro (`asesor-zapateria-v6.html`). Para el producto real:
  **React Native / Expo** si el objetivo principal es móvil (un solo código para iOS y Android), o
  **React** web si arrancas por escritorio. Decide según dónde estén tus primeros usuarios.
- No empieces por el frontend: el backend + calidad del consejo es lo que valida el producto.

---

## 5. Modelo de datos inicial (borrador para discutir con Claude Code)

Tablas mínimas para el MVP de resurtido:

- **business** — id, nombre, giro, logo, config (temporadas, umbral de días sin vender, etc.)
- **business_context** — texto libre que el dueño aporta ("lo que solo tú sabes") + archivos.
- **product** — id, business_id, modelo, marca, categoría, temporada, tipo (de piso / de temporada).
- **variant** — id, product_id, talla, atributos (para calzado: si es talla de punta).
- **sale** — id, business_id, variant_id, fecha, cantidad, precio. (Normalizado desde el POS.)
- **stock** — variant_id, cantidad_actual.
- **advice** — id, business_id, product_id, veredicto (RESURTE/NO_PIDAS/VIGILA), texto, fecha,
  datos_que_lo_respaldan (json). ← guardar cada consejo permite después MEDIR si acertó.
- **daily_question / daily_answer** — la pregunta del día y lo que respondió el dueño.

> Nota clave: guarda cada `advice` con su fecha. Así, meses después, puedes comparar lo que el asesor
> aconsejó contra lo que realmente pasó con esa mercancía. Sin eso, nunca sabrás si el asesor sirve —
> solo *sentirás* que sí, que no es lo mismo.

---

## 6. Cómo pensar el núcleo del asesor (lo que le da o le quita valor)

El `AdvisorService` NO es "mandarle las ventas al modelo y ya". Ese es el error que da consejos
tontos. El flujo correcto:

1. **Calcular señales** desde las ventas (velocidad de venta por modelo, días sin mover, % de tallas
   vendidas, estacionalidad). Esto es análisis de datos determinista, sin IA.
2. **Aplicar reglas del giro** (calzado): "un modelo se juzga completo, no talla por talla"; "una
   talla de punta suelta no cuenta como estancamiento"; "tal temporada arranca en tal mes". Estas
   reglas salen de entrevistar al experto (los papás del fundador ya fueron entrevistados).
3. **Sumar el contexto del negocio** (lo que el dueño escribió + respuestas a la pregunta del día).
   Trátalo como **pistas que se ponderan**, no como verdades absolutas (un dueño puede tener manías).
4. **Recién entonces**, usar el LLM para **redactar** el consejo en lenguaje natural cálido y claro —
   y opcionalmente para razonar sobre casos ambiguos. El LLM es el que *habla*; las reglas y los datos
   son los que *deciden*. Esta separación es lo que evita el consejo tonto.

---

## 7. Plan de implementación del backend por fases

**Fase 0 — Cimientos**
- Repo, FastAPI corriendo, Postgres conectado, Docker, migraciones (Alembic). Endpoint `/health`.
- `MockProvider` del LLM (respuestas fijas) para no depender de IA todavía.

**Fase 1 — Datos**
- Modelo de datos (sección 5). Averiguar el POS del primer cliente y construir el primer
  `SalesImporter` (CSV/Excel). Cargar ventas reales de la zapatería.

**Fase 2 — El núcleo del asesor (sin IA aún)**
- Calcular las señales (sección 6, paso 1) y las reglas de calzado (paso 2). Generar veredictos
  RESURTE/NO_PIDAS/VIGILA con texto plantilla. **Valida esto contra la intuición de los papás:** si
  las reglas + señales aciertan a mano, el producto tiene fundamento.

**Fase 3 — Enchufar el LLM**
- Implementar `OpenSourceProvider` (Ollama en local para empezar). Que el LLM **redacte** los consejos
  a partir de los veredictos y datos de la Fase 2. Comparar contra el texto plantilla.

**Fase 4 — Contexto y pregunta del día**
- Endpoints para el contexto libre, archivos (extracción de texto), y el ciclo de pregunta del día
  (generar pregunta útil → guardar respuesta → usarla en el siguiente consejo → mostrar que se usó).

**Fase 5 — Medición**
- Mecanismo para, con el tiempo, comparar `advice` histórico vs. lo que realmente pasó. Esta es la
  única prueba honesta de que el asesor funciona.

---

## 8. Primeras preguntas que Claude Code debería ayudarte a resolver

1. **¿Qué POS usa la zapatería y exporta CSV/Excel?** (destraba toda la Fase 1)
2. ¿Móvil (Expo) o escritorio (web) primero, según dónde estén los primeros usuarios?
3. ¿Presupuesto para GPU si vas a open source servido, o arrancamos con Ollama local para validar?
4. ¿Qué nube prefieres para el primer deploy (Railway/Render/Fly)?

---

## 9. La regla de oro para no perderte

Cada vez que dudes si construir algo, pregúntate: **¿esto acerca a que el asesor dé un consejo
correcto y confiable, o es fachada alrededor de eso?** La fachada ya está bocetada. Lo que decide si
el negocio existe es que el consejo **acierte**. Prioriza el motor.
