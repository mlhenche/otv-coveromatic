# TODO — CoverOmatic v3

## EN CURSO: Fix provider + imágenes en pestaña HTML (card_channel)

### Estado (2026-03-06)

Los cambios aplicados (`upgradeImageUrl`, estrategia 3 `findProviderLogoAncestor`, logging básico) no han resuelto los bugs. Próximo paso: fix case-insensitive + logging diagnóstico.

### Bugs activos

1. **Provider no cambia en card_channel** — `providerLogoSquare` no se actualiza al aplicar fila de canal
2. **Algunas cards sin imagen** — slots quedan en blanco tras aplicar desde la pestaña HTML

### Análisis (code.ts)

**Jerarquía Figma confirmada:**
```
cover(FRAME) → wrapper(FRAME) → epg(INSTANCE) → cardsRow(FRAME) → row_card_channel(FRAME)
```
`providerLogoSquare` es hijo de `epg`, con propiedad `provider` tipo VARIANT.

`cachedAllCardIds` NO es el problema — para selecciones no-VPS se resetea a `new Set()`.

**Flujo de búsqueda provider:**
- S1: dentro de `wrapper` → no lo encuentra (providerLogoSquare es hermano de wrapper)
- S2: dentro de `epg` → debería funcionar pero falla
- S3: `findProviderLogoAncestor` → falla si `epg` no expone `provider` a su nivel

**Causa raíz probable:** checks `key === 'provider' || key.startsWith('provider#')` son **case-sensitive** en `isProviderLogoComponent`, `applyProviderLogo` y `findProviderLogoAncestor`. Si Figma usa `"Provider"` con mayúscula, falla silenciosamente.

**Causa raíz imágenes:** URLs de canal/EPG ya tienen `width=3840` (upgradeImageUrl no ayuda). Si `createImageAsync` falla, el `console.warn` añadido lo mostrará. Si `backgroundUrl` es null, la card se filtra y el slot queda sin actualizar.

### Próximos pasos

**1. `isProviderLogoComponent` (~L246)** — check case-insensitive:
```typescript
return Object.keys(props).some(k => {
    const kl = k.toLowerCase();
    return kl === 'provider' || kl.startsWith('provider#');
});
```

**2. `applyProviderLogo` (~L202)** — lookup case-insensitive + log:
```typescript
for (const key of Object.keys(props)) {
    const kl = key.toLowerCase();
    if (kl === 'provider' || kl.startsWith('provider#')) { providerKey = key; break; }
}
console.log(`[applyProvider] logo="${logo.name}" key="${providerKey}" value="${providerValue}"`);
```

**3. `findProviderLogoAncestor` (~L270)** — mismo fix.

**4. Logging en `apply-multiple-covers-url`** tras cada estrategia para ver dónde falla.

**Verificar:** Figma → Plugins → Development → Open Console → aplicar fila de canal.

---

## Pendiente: tabla `CHANNEL_TO_PROVIDER` incompleta

Tabla en `code.ts` (~L89), ~65 entradas. Necesita validarse contra variantes reales.

Enlace: https://www.figma.com/design/8DlABzc0EynixwUG0GEG6p/Citrus-recap?node-id=165-43521

Canales sin mapeo: `CMM`, `BBC_*`, `SQUIRREL*`, `BOM`, `SANGRE_FRIA_V2`, `HISTORIA_Y_VIDA`, `NATURE_TIME`, `LOVE_*`, `VIVIR_CON_*`, `INGLES_TOTAL`, `DISNEY_JR`, `NICK_JR`, `BABYTV_WHITE`, `TOON_GOOGLES`, `POCOYO_WHITE`, `ANIME_VISION_*`, `GOL*`, `TOP_BARCA_WHITE`, `MOTORVISION`, `BBC_TOP_GEAR_WHITE`, `TRACE_SPORT_STARS`, `UBEAT`, `GAME_TOON_White`, `MMATV_WHITE`, `FIGHT_BOX_White`, `QUELLO_CONCERTS_WHITE`, `SOL`, `FLAMENCO_AUDITORIO`, `QWEST_TV`, `eitb`, `1+1_WHITE`, `BBOriginals_*`, `NEGOCIOS_TV`, `TV5MONDE`, `FRANCE2`, `FRANCE5`, `SOMOS`

Para completar: abrir Desktop Bridge en Figma → Claude lee variantes via MCP.

---

## Notas

- URLs EPG usan `/epg/` en lugar de `/vod/`, mismo dominio base
- Logos de canales en `/attachments_new/{NOMBRE}_{ancho}x{alto}.png`
- Tabla completa de ~130 canales con URL names en `channels.html`
