# Spec — Componente `card_emission` (emisiones en directo)

- **Estado**: Borrador
- **Fecha**: 2026-06-07
- **ADRs relacionados**: —

## Problema

La pestaña HTML del plugin ya parsea las *emission cards* de
`orangetv.orange.es` (carrusel `app-carousel-emission`), pero el Design System
**no tiene un componente específico para emisiones en directo**. Hoy esas cards
solo pueden aplicarse a componentes genéricos, perdiendo los datos propios de
una emisión (horario, indicador de directo, duración, logo del canal).

## Usuario y caso de uso

El diseñador de OTV, al montar pantallas de EPG / directo, quiere aplicar una
emisión real (con su imagen, canal y horario) a un componente que represente
fielmente cómo se ve una card de emisión en producto.

## Comportamiento esperado

1. El diseñador selecciona en Figma un componente `card_emission` (o una fila
   de ellos).
2. En la pestaña HTML elige un carrusel de tipo `emission` y aplica una card
   (o la fila completa).
3. El plugin rellena, por cada card: imagen de fondo, logo del canal, título,
   horario, indicador de directo y duración.

## Datos de entrada

Vienen del parser ya existente en `src/ui/components/HtmlPasteTab.tsx`
(`parseCardEmission`, `ParsedCard` con `type: 'emission'`):

| Campo | Origen (selector HTML) | Capa Figma destino (propuesta) |
|-------|------------------------|-------------------------------|
| `backgroundUrl` | `background-image` de la card | imagen de fondo (`BACKGROUND`) |
| `channelIconUrl` | `extractChannelIconUrl()` | logo del canal |
| `title` | nombre de la card | texto título |
| `schedule` | `.emission-info__time` | texto horario |
| `live` | `.emission-info__start-date` | indicador "en directo" (visibilidad/badge) |
| `duration` | `.emission-info__duration` | texto duración |

`backgroundUrl` puede venir de `/epg/COVER/...`; en ese caso se descarga en la
UI y se envían los bytes al backend (ver carga de imágenes EPG en CLAUDE.md).

## Componentes Figma afectados

Requiere **crear** el componente `card_emission` en el DS con, al menos, estas
capas nombradas de forma reconocible por el plugin:

- Una capa de imagen de fondo (que el plugin detecte como el cover node).
- Un slot para el logo del canal (instancia de `providerLogoSquare` o capa de
  imagen).
- Nodos de texto para: título, horario, duración.
- Un elemento de estado "en directo" (badge o capa con visibilidad togglable).

> Decisión abierta: nombres exactos de capa/propiedad. Deben acordarse con el
> equipo de DS y reflejarse luego en la detección de `code.ts`.

## Cambios en código

- `src/code.ts`: añadir un `componentType` `card-emission` a la detección
  (`detectTypeSync`) y un handler que mapee los campos de la emisión a las capas
  del componente. Reutilizar `applyProviderLogo` para el logo del canal.
- `src/ui/components/CoverGrid.tsx` / `HtmlPasteTab.tsx`: enrutar el apply de
  cards `emission` al nuevo flujo cuando el componente seleccionado sea
  `card-emission`.

## Criterios de aceptación

- [ ] Existe el componente `card_emission` en el DS con las capas listadas.
- [ ] Al aplicar una emisión, la imagen, el logo del canal, el título, el
      horario y la duración se rellenan correctamente.
- [ ] El indicador de directo refleja el dato `live` (presente/ausente).
- [ ] Aplicar una fila completa rellena N cards en orden.
- [ ] Una card sin imagen no rompe el flujo (queda oculta, como hoy en el grid).

## Fuera de alcance

- Animaciones o estados interactivos del componente.
- Lógica de "ahora mismo en directo" en tiempo real (los datos son del HTML
  pegado, estáticos).
- Completar la tabla `CHANNEL_TO_PROVIDER` (tarea aparte en TODO.md).
