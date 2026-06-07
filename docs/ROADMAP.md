# Roadmap: CoverOmatic v3

## Overview

CoverOmatic es un plugin de Figma para el equipo de diseño de Orange TV (FrogTV). Aplica carátulas, metadatos y logos de provider a componentes del Design System. El plugin v3 está funcional; este roadmap cubre los bugs activos del carrusel de canales y las mejoras pendientes identificadas post-lanzamiento.

## Phases

- [ ] **Phase 1: Fix card_channel** - Corregir provider logo y tarjetas en blanco en carrusel de canales
- [ ] **Phase 2: Completar CHANNEL_TO_PROVIDER** - Validar y completar la tabla de mapeo con las variantes reales de Figma

## Phase Details

### Phase 1: Fix card_channel
**Goal**: El plugin aplica correctamente la imagen y el logo de provider en todos los slots de un carrusel `row_card_channel` sin dejar tarjetas en blanco ni fallar en el provider logo.
**Depends on**: Nothing (first phase)
**Success Criteria** (what must be TRUE):
  1. Al aplicar una fila completa de canal, todos los slots con imagen válida reciben su imagen correctamente
  2. El componente `providerLogoSquare` se actualiza con la variante correcta del canal en cada tarjeta
  3. No quedan console.log de diagnóstico en el código de producción
  4. El build compila sin errores y el plugin es recargable en Figma Desktop
**Plans**: 1 plan

Plans:
- [ ] 01-01-PLAN.md — Corregir skip de cards sin imagen, provider logo y console.log; compilar build

### Phase 2: Completar CHANNEL_TO_PROVIDER
**Goal**: La tabla `CHANNEL_TO_PROVIDER` cubre todos los canales disponibles en Orange TV y los ~30 canales sin mapeo actual tienen su entrada correcta.
**Depends on**: Phase 1
**Success Criteria** (what must be TRUE):
  1. Todos los canales listados en TODO.md como "sin mapeo" tienen una entrada en `CHANNEL_TO_PROVIDER`
  2. Las variantes de `providerLogoSquare` en Figma están renombradas para coincidir exactamente con los nombres de URL de OTV (exact match path resuelve directamente)
  3. El plugin aplica el logo correcto para cualquier canal del HTML de `orangetv.orange.es`
**Plans**: TBD

## Progress

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Fix card_channel | 0/1 | In planning | - |
| 2. Completar CHANNEL_TO_PROVIDER | 0/? | Not started | - |
