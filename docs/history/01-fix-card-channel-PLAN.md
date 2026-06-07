---
phase: 01-fix-card-channel
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - v3/src/code.ts
  - v3/src/ui/components/HtmlPasteTab.tsx
  - v3/plugin/code.js
  - v3/plugin/ui.html
autonomous: true
requirements:
  - FIX-01-provider-logo
  - FIX-02-blank-cards
  - FIX-03-console-logs
  - FIX-04-build

must_haves:
  truths:
    - "Al aplicar una fila completa de canal, cada slot de Figma con imagen disponible recibe exactamente esa imagen (sin desplazamiento de índice)"
    - "El componente providerLogoSquare de cada tarjeta recibe la variante correcta del canal"
    - "No hay llamadas console.log de diagnóstico en el código compilado final"
    - "npm run build en v3/ termina sin errores de compilación TypeScript ni Vite"
  artifacts:
    - path: "v3/src/code.ts"
      provides: "Backend del plugin con los tres bugs corregidos"
      contains: "skip: true"
    - path: "v3/src/ui/components/HtmlPasteTab.tsx"
      provides: "handleApplyAll que incluye todas las cards (con y sin imagen) en el array enviado al backend"
      contains: "skip"
    - path: "v3/plugin/code.js"
      provides: "Build compilado del backend listo para cargar en Figma Desktop"
    - path: "v3/plugin/ui.html"
      provides: "Build compilado del frontend listo para cargar en Figma Desktop"
  key_links:
    - from: "HtmlPasteTab.tsx handleApplyAll"
      to: "apply-multiple-covers-url handler en code.ts"
      via: "postMessage con array que incluye entradas skip:true para mantener alineación de índices"
      pattern: "skip.*true"
    - from: "apply-multiple-covers-url loop (code.ts ~L1018)"
      to: "cada coverNode en targetCoverNodes"
      via: "índice i — salta el slot si coverData.skip === true"
      pattern: "coverData\\.skip"
    - from: "applyProviderLogo (code.ts ~L198)"
      to: "componentProperties del logo"
      via: "key.toLowerCase() para detección case-insensitive de la propiedad 'provider'"
      pattern: "kl === 'provider'"
---

<objective>
Corregir los tres bugs activos del carrusel row_card_channel: (1) el provider logo no se actualiza por una comparación case-sensitive, (2) los slots se desplazan cuando hay cards sin imagen porque el array se filtra antes de enviarlo al backend, y (3) hay console.log de diagnóstico que no deben estar en producción. Terminar con un build limpio y funcional.

Purpose: El carrusel de canales es el caso de uso principal de la pestaña HTML. Sin estas correcciones el flujo completo falla en producción para el equipo de diseño.
Output: v3/plugin/code.js y v3/plugin/ui.html compilados y listos para recargar en Figma Desktop.
</objective>

<execution_context>
@/Users/mlopezhe/.claude/get-shit-done/workflows/execute-plan.md
@/Users/mlopezhe/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/ROADMAP.md

<interfaces>
<!-- Tipos clave que el executor necesita. Extraídos del código fuente. -->

Desde v3/src/code.ts:

```typescript
// ~L769 — interface que viaja en el postMessage desde la UI al backend
interface CoverUrlData {
    coverUrl: string;
    imageBytes?: number[];
    titleTreatmentUrl?: string;
    metadata: Metadata | null;
    // AÑADIR: skip?: boolean;
}

// ~L1002 — handler que recibe el array
// msg.coversUrlData es CoverUrlData[]
// loop: for (let i = 0; i < applyCount; i++) { const coverData = coversUrlData[i]; ... }

// ~L198 — función que fija la variante del logo
function applyProviderLogo(logos: InstanceNode[], providerValue: string): number

// ~L246 — función que detecta si un nodo es un logo de provider
function isProviderLogoComponent(node: SceneNode): boolean

// ~L271 — función que sube en el árbol buscando un INSTANCE con prop 'provider'
function findProviderLogoAncestor(node: SceneNode): InstanceNode | null

// ~L210, ~L1054, ~L1058, ~L1060, ~L1065, ~L1073 — console.log a eliminar
```

Desde v3/src/ui/components/HtmlPasteTab.tsx:

```typescript
// ~L345 — punto de filtrado actual (genera el desplazamiento de índices)
const validCards = selectedCarousel.cards.filter(c => c.backgroundUrl);

// ~L351 — construcción del array que se envía al backend
const coversUrlData = await Promise.all(
    validCards.map(async card => { ... })
);

// ~L369 — postMessage con el array
coversUrlData.slice(0, selectionInfo.coverCount || coversUrlData.length)
```
</interfaces>
</context>

<tasks>

<task type="auto" tdd="false">
  <name>Task 1: Añadir skip:true a CoverUrlData y respetar saltos en el backend</name>
  <files>v3/src/code.ts</files>
  <action>
Dos cambios en code.ts, ambos en el handler apply-multiple-covers-url:

**Cambio A — Añadir campo skip a la interfaz (~L769):**
```typescript
interface CoverUrlData {
    coverUrl: string;
    imageBytes?: number[];
    titleTreatmentUrl?: string;
    metadata: Metadata | null;
    skip?: boolean;  // ← añadir esta línea
}
```

**Cambio B — Respetar skip en el loop de aplicación (~L1018):**
Al inicio de cada iteración del loop `for (let i = 0; i < applyCount; i++)`, antes de hacer cualquier otra cosa, comprobar si `coverData.skip === true` y continuar al siguiente slot sin modificar nada:

```typescript
const coverData = coversUrlData[i];
if (coverData.skip) { successCount++; continue; }
```

El `successCount++` es intencionado: los slots sin imagen no son un fallo, el slot simplemente se preserva tal y como está. Si se prefiere no contarlos como éxito, se puede usar solo `continue` — pero es preferible el `successCount++` para que el mensaje final sea consistente con el número de slots procesados.

No hay otros cambios en este archivo en esta tarea.
  </action>
  <verify>
    <automated>cd "/Users/mlopezhe/Documents/Trabajo/frog/00_Proyectos/OrangeTV/05_CitrusDLS/plan 2026/plugin/covers/v3" && npx tsc --noEmit 2>&1 | head -20</automated>
  </verify>
  <done>La interfaz CoverUrlData tiene el campo opcional skip?: boolean. El loop del handler salta el slot sin error si coverData.skip === true. tsc --noEmit pasa sin errores.</done>
</task>

<task type="auto" tdd="false">
  <name>Task 2: Corregir handleApplyAll para preservar índices y eliminar console.log de diagnóstico</name>
  <files>v3/src/ui/components/HtmlPasteTab.tsx, v3/src/code.ts</files>
  <action>
**HtmlPasteTab.tsx — corregir handleApplyAll (~L343):**

Reemplazar la lógica actual de `handleApplyAll` para que itere sobre `selectedCarousel.cards` completo (no solo los validCards filtrados). Para cada card, si no tiene backgroundUrl, incluir una entrada con `skip: true` y valores vacíos; si tiene backgroundUrl, proceder como ahora (fetch de imagen):

```typescript
const handleApplyAll = async () => {
    if (!selectedCarousel) return;
    const allCards = selectedCarousel.cards;
    if (allCards.every(c => !c.backgroundUrl)) return;

    setApplying(true);

    const coversUrlData = await Promise.all(
        allCards.map(async card => {
            if (!card.backgroundUrl) {
                return { coverUrl: '', metadata: buildCardMetadata(card), skip: true };
            }
            const data: { coverUrl: string; imageBytes?: number[]; titleTreatmentUrl: string | null; metadata: Record<string, string>; skip?: boolean } = {
                coverUrl: card.backgroundUrl,
                titleTreatmentUrl: card.titleTreatmentUrl,
                metadata: buildCardMetadata(card),
            };
            try {
                const res = await fetch(card.backgroundUrl);
                if (res.ok) data.imageBytes = Array.from(new Uint8Array(await res.arrayBuffer()));
            } catch (_) {}
            return data;
        })
    );

    parent.postMessage({
        pluginMessage: {
            type: 'apply-multiple-covers-url',
            coversUrlData: coversUrlData.slice(0, selectionInfo.coverCount || coversUrlData.length),
            carouselTitle: selectedCarousel.title,
        }
    }, '*');

    const validCount = allCards.filter(c => c.backgroundUrl).length;
    Logger.add('HTML Apply - Row', selectedCarousel.label, [`${validCount} cards`]);
    setTimeout(() => setApplying(false), 800);
};
```

También actualizar la UI que muestra el botón "Aplicar fila completa (N)" (~L495): el conteo debe seguir siendo el número de cards con imagen (validCards.length), no allCards.length. Asegurarse de que la variable `validCards` que se usa solo para la UI sigue existiendo donde se necesita (~L474).

**code.ts — eliminar todos los console.log de diagnóstico:**

Eliminar exactamente estas líneas (no los console.warn que son warnings reales):
- ~L210: `console.log(\`[applyProvider] logo="${logo.name}" key="${providerKey}" value="${providerValue}"\`);`
- ~L1054: `console.log(\`[provider S1] cover="${coverNode.name}" scope="${scope2.name}" logos=${logos.length}\`);`
- ~L1058: `console.log(\`[provider S2] ancestor="${instAncestor?.name ?? 'null'}"\`);`
- ~L1060: `console.log(\`[provider S2] logos=${logos.length}\`);`
- ~L1065: `console.log(\`[provider S3] providerAncestor="${providerAncestor?.name ?? 'null'}"\`);`
- ~L1073: `console.log(\`[provider] channelName="${channelName}" providerValue="${providerValue}" logos=${logos.length}\`);`

No eliminar console.warn (~L223): `console.warn(\`[provider] No match for "${providerValue}"\`);` — ese es un warning real de producción.
  </action>
  <verify>
    <automated>cd "/Users/mlopezhe/Documents/Trabajo/frog/00_Proyectos/OrangeTV/05_CitrusDLS/plan 2026/plugin/covers/v3" && npx tsc --noEmit 2>&1 | head -20 && grep -n "console\.log" src/code.ts src/ui/components/HtmlPasteTab.tsx | grep -v "^Binary" || echo "OK: no console.log found"</automated>
  </verify>
  <done>handleApplyAll itera sobre todas las cards (no solo validCards). Las cards sin backgroundUrl generan entradas con skip:true. Cero console.log en ambos archivos fuente. tsc --noEmit pasa sin errores.</done>
</task>

<task type="auto" tdd="false">
  <name>Task 3: Compilar y verificar build limpio</name>
  <files>v3/plugin/code.js, v3/plugin/ui.html</files>
  <action>
Compilar el proyecto completo desde el directorio v3/:

```bash
cd v3
npm run build
```

Este comando ejecuta tsc (compila code.ts → plugin/code.js) y vite build (empaqueta la UI React → plugin/ui.html).

Tras el build, verificar que los outputs no contienen los console.log eliminados:
```bash
grep -c "provider S1\|provider S2\|provider S3\|\[applyProvider\]\|\[provider\] channelName" v3/plugin/code.js || echo "OK: sin logs de diagnóstico en build"
```

No editar plugin/code.js ni plugin/ui.html manualmente. Solo el build genera esos archivos.
  </action>
  <verify>
    <automated>cd "/Users/mlopezhe/Documents/Trabajo/frog/00_Proyectos/OrangeTV/05_CitrusDLS/plan 2026/plugin/covers/v3" && npm run build 2>&1 | tail -20</automated>
  </verify>
  <done>npm run build termina con código de salida 0, sin errores TypeScript ni Vite. plugin/code.js y plugin/ui.html actualizados con fecha de hoy. Grep de logs de diagnóstico en plugin/code.js devuelve 0 coincidencias.</done>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <what-built>
    Tres correcciones en el plugin CoverOmatic:
    1. handleApplyAll (HtmlPasteTab.tsx) ahora incluye todas las cards en el array, usando skip:true para las que no tienen imagen, preservando la alineación de índices con los slots de Figma
    2. El handler apply-multiple-covers-url (code.ts) salta los slots marcados con skip:true sin modificarlos
    3. Eliminados 6 console.log de diagnóstico de code.ts (se conserva el console.warn de provider no encontrado)
    Build compilado: v3/plugin/code.js y v3/plugin/ui.html
  </what-built>
  <how-to-verify>
    1. En Figma Desktop: Plugins → Development → Import plugin from manifest → seleccionar v3/plugin/manifest.json (o recargar si ya está importado)
    2. Abrir la pestaña HTML del plugin
    3. Pegar el HTML de orangetv.orange.es (una página con carrusel de canales)
    4. Seleccionar un carrusel app-carousel-channel
    5. En Figma, seleccionar un frame row_card_channel con varios slots
    6. Pulsar "Aplicar fila completa"
    7. Verificar: cada slot que tenía imagen en la web ahora muestra esa imagen en Figma (sin desplazamientos)
    8. Verificar: el componente providerLogoSquare de cada tarjeta muestra el logo del canal correspondiente
    9. Abrir DevTools de Figma (Plugins → Development → Open console) y confirmar que no aparecen los mensajes [provider S1], [provider S2], [applyProvider], etc.
  </how-to-verify>
  <resume-signal>Escribe "aprobado" si los tres comportamientos son correctos, o describe qué slot o logo falla para investigar.</resume-signal>
</task>

</tasks>

<verification>
Antes de marcar la fase como completada, verificar en conjunto:

```bash
# 1. Sin console.log de diagnóstico en fuentes
grep -n "console\.log" \
  "/Users/mlopezhe/Documents/Trabajo/frog/00_Proyectos/OrangeTV/05_CitrusDLS/plan 2026/plugin/covers/v3/src/code.ts" \
  "/Users/mlopezhe/Documents/Trabajo/frog/00_Proyectos/OrangeTV/05_CitrusDLS/plan 2026/plugin/covers/v3/src/ui/components/HtmlPasteTab.tsx"
# Resultado esperado: sin salida (0 matches)

# 2. Campo skip en la interfaz
grep -n "skip" \
  "/Users/mlopezhe/Documents/Trabajo/frog/00_Proyectos/OrangeTV/05_CitrusDLS/plan 2026/plugin/covers/v3/src/code.ts" \
  "/Users/mlopezhe/Documents/Trabajo/frog/00_Proyectos/OrangeTV/05_CitrusDLS/plan 2026/plugin/covers/v3/src/ui/components/HtmlPasteTab.tsx"
# Resultado esperado: CoverUrlData con skip?: boolean, handler con coverData.skip, handleApplyAll con skip: true

# 3. Build limpio
cd "/Users/mlopezhe/Documents/Trabajo/frog/00_Proyectos/OrangeTV/05_CitrusDLS/plan 2026/plugin/covers/v3" && npm run build
# Resultado esperado: exit code 0
```
</verification>

<success_criteria>
- handleApplyAll envía al backend N entradas (una por card del carrusel), no solo las que tienen imagen — las sin imagen llevan skip:true
- El backend respeta skip:true y deja ese slot de Figma sin modificar, avanzando al siguiente
- Cero console.log en v3/src/code.ts y v3/src/ui/components/HtmlPasteTab.tsx
- npm run build termina sin errores
- El diseñador puede recargar el plugin en Figma Desktop y aplicar una fila de canal completa obteniendo imagen y provider logo correctos en todos los slots
</success_criteria>

<output>
Tras completar todas las tareas, crear `.planning/phases/01-fix-card-channel/01-01-SUMMARY.md` con:
- Cambios realizados (qué se modificó y por qué)
- Líneas exactas cambiadas en cada archivo
- Resultado de la verificación humana
- Cualquier comportamiento inesperado encontrado durante la ejecución
</output>
