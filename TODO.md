# TODO — CoverOmatic

## Bugs activos

### Algunas cards sin imagen al aplicar desde pestaña HTML

Slots quedan en blanco. Posibles causas: `backgroundUrl` null (la card se filtra antes de aplicar) o `createImageAsync` falla silenciosamente para URLs EPG.

---

## Pendiente: tabla `CHANNEL_TO_PROVIDER` incompleta

Tabla en `src/lib/channels.ts`, ~65 entradas. Necesita validarse contra variantes reales del DS.

Enlace: https://www.figma.com/design/8DlABzc0EynixwUG0GEG6p/Citrus-recap?node-id=165-43521

Canales sin mapeo: `CMM`, `BBC_*`, `SQUIRREL*`, `BOM`, `SANGRE_FRIA_V2`, `HISTORIA_Y_VIDA`, `NATURE_TIME`, `LOVE_*`, `VIVIR_CON_*`, `INGLES_TOTAL`, `DISNEY_JR`, `NICK_JR`, `BABYTV_WHITE`, `TOON_GOOGLES`, `POCOYO_WHITE`, `ANIME_VISION_*`, `GOL*`, `TOP_BARCA_WHITE`, `MOTORVISION`, `BBC_TOP_GEAR_WHITE`, `TRACE_SPORT_STARS`, `UBEAT`, `GAME_TOON_White`, `MMATV_WHITE`, `FIGHT_BOX_White`, `QUELLO_CONCERTS_WHITE`, `SOL`, `FLAMENCO_AUDITORIO`, `QWEST_TV`, `eitb`, `1+1_WHITE`, `BBOriginals_*`, `NEGOCIOS_TV`, `TV5MONDE`, `FRANCE2`, `FRANCE5`, `SOMOS`

Para completar: abrir Desktop Bridge en Figma → Claude lee variantes via MCP → renombrar variantes para que el exact match resuelva directamente y la tabla pueda eliminarse.

---

## Pendiente

### Activar `strict: true` en UI

`src/ui/tsconfig.json` tiene el flag en `false`. Encenderlo + eliminar todos los `any` explícitos. El compilador guiará el trabajo.

### Componente `card_emission`

El DS aún no tiene componente para emisiones en directo. Ver spec en [docs/specs/card-emission.md](docs/specs/card-emission.md). Una vez exista en Figma, actualizar la detección en `code.ts` y los `switch` de URLs en `CoverGrid.tsx`.

---

## Notas

- URLs EPG usan `/epg/` en lugar de `/vod/`, mismo dominio base
- Logos de canales en `/attachments_new/{NOMBRE}_{ancho}x{alto}.png`
- Tabla completa de ~130 canales con URL names en `channels.html`
