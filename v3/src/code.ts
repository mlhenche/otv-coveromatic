// TMDB Covers — Figma Plugin (Sandbox)
// This runs in Figma's sandbox and has access to the Figma API.

figma.showUI(__html__, { width: 380, height: 580, themeColors: true });

// -- Module-level cache: IDs of card instances inside VPS (to exclude from cover search) --
let cachedAllCardIds = new Set<string>();
// -- Version counter: cancels stale async sendSelection calls --
let selectionVersion = 0;

// -- Provider prefix → variable value mapping --
const PROVIDER_MAP: { [prefix: string]: string } = {
    'PRIME': 'Prime Video',
    'SKYS': 'SkyShowtime',
    'DSN': 'Disney+',
    'MAX': 'Max',
    'RTVE': 'RTVE Play',
    'FLMN': 'Filmin',
    'APREM': 'A3 Premium'
};

// -- Helper: check if a node or its ancestors are in the exclude set --
function isExcluded(node: BaseNode, excludeIds: Set<string>): boolean {
    if (excludeIds.size === 0) return false;
    let current: BaseNode | null = node;
    while (current && current.type !== 'PAGE' && current.type !== 'DOCUMENT') {
        if (excludeIds.has(current.id)) return true;
        current = current.parent;
    }
    return false;
}

// -- Check if a node is a valid "cover" target --
function isCoverNode(node: SceneNode): boolean {
    return node.name.trim().toLowerCase() === 'cover' && 'fills' in node;
}

// -- Check if a node is a valid "titleTreatment" target --
function isTitleTreatmentNode(node: SceneNode): boolean {
    const name = node.name.trim().toLowerCase();
    return (name === 'titletreatment' || name === 'title treatment' || name === 'title_treatment') && 'fills' in node;
}

// -- Find a text node by name inside a parent (including hidden) --
function findTextNode(parent: SceneNode, name: string): TextNode | null {
    if (parent.type === 'TEXT' && parent.name.trim().toLowerCase() === name) return parent as TextNode;
    if ('findAllWithCriteria' in parent) {
        const texts = parent.findAllWithCriteria({ types: ['TEXT'] });
        return texts.find(n => n.name.trim().toLowerCase() === name) || null;
    }
    return null;
}

// -- Find all text nodes by name inside a parent (including hidden) --
function findAllTextNodes(parent: SceneNode, name: string): TextNode[] {
    const results: TextNode[] = [];
    if (parent.type === 'TEXT' && parent.name.trim().toLowerCase() === name) results.push(parent as TextNode);
    if ('findAllWithCriteria' in parent) {
        const texts = parent.findAllWithCriteria({ types: ['TEXT'] });
        results.push(...texts.filter(n => n.name.trim().toLowerCase() === name));
    }
    return results;
}

// -- Find a component instance by name inside a parent (including hidden) --
function findInstanceNode(parent: SceneNode, name: string): InstanceNode | null {
    if (parent.type === 'INSTANCE' && parent.name.trim().toLowerCase() === name) return parent as InstanceNode;
    if ('findAllWithCriteria' in parent) {
        const instances = parent.findAllWithCriteria({ types: ['INSTANCE'] });
        return instances.find(n => n.name.trim().toLowerCase() === name) || null;
    }
    return null;
}

// -- Extract provider from contentId prefix --
function extractProvider(contentId: string | undefined): string | null {
    if (!contentId || contentId.length < 2) return null;

    const idUpper = contentId.toUpperCase();
    for (const key of Object.keys(PROVIDER_MAP)) {
        if (idUpper.startsWith(key)) {
            return PROVIDER_MAP[key];
        }
    }
    return null;
}

// -- Apply provider logo to matching instances in a scope --
// Map from URL channel name (extracted from icon URL) → Figma provider variant name.
// Only needed for cases where normalization can't resolve the match.
const CHANNEL_TO_PROVIDER: Record<string, string> = {
    // Numeric channel IDs
    '1': 'TVE - 1',
    '2': 'La 2 - 2',
    // TDT principales
    'ANTENA_3': 'Antena 3 - 3',
    'CUATRO': 'Cuatro - 4',
    'TELECINCO': 'Telecinco - 5',
    'LA_SEXTA': 'La sexta -6',
    // Canales temáticos con nombre diferente
    'XTRM': 'xtreme - 17',
    'NAT_GEO': 'nationalgeographic - 61',
    'CLAN': 'clanHD - 91',
    'CANAL_HOLLYWOOD': 'hollywood',
    'CANAL_HISTORIA_LOGO': 'historia - 60',
    'CANAL_COCINA_4K': 'Canal Cocina - 68',
    'discovery_logo': 'discovery - 64',
    'ODISEA_4K': 'odisea - 63',
    'WARNER_TV_B': 'warner tv - 13',
    'STAR_CHANNEL': 'StarChannel',
    'VIN_TV': 'verditv - 48',
    '24H': 'tdp - 103',
    // Deportes — MOVISTAR_ → M
    'MOVISTAR_LALIGA': 'MLaLiga - 110',
    'MOVISTAR_LALIGA_HDR': 'MLaLiga - 110',
    'MOVISTAR_LALIGA_2': 'MLaLiga2 - 112',
    'MOVISTAR_LALIGA_2_HDR': 'MLaLiga2 - 112',
    'MOVISTAR_LALIGA_3': 'MLaLiga+ - 122',
    'MOVISTAR_LIGA_DE_CAMPEONES': 'MLiga de Campeones - 115',
    'MOVISTAR_LIGA_DE_CAMPEONES_2': 'MLiga de Campeones 2 - 116',
    'MOVISTAR_LIGA_DE_CAMPEONES_3': 'MLiga de Campeones - 117',
    'LALIGA_HYPERMOTION': 'MLaLigaHyper - 119',
    'LALIGA_HYPERMOTION_2': 'MLaLigaHyper 2 - 120',
    'LALIGA_INSIDE': 'laLigaLiveTvInside',
    'DAZN_F1': 'DAZNF1',
    'DAZN_LALIGA': 'DAZN1',
    'DAZN_LALIGA_2': 'DAZN2',
    'DAZN_BALONCESTO': 'DAZN3',
    'DAZN_BALONCESTO_2': 'DAZN4',
    'DAZN_MOTOGP': 'DAZN Motor',
    'PRIMERA_FEDERACION': 'TodoFutbol',
    // Runtime → RT (Spanish translations)
    'RUNTIME_ACTION_WHITE': 'RT_Acción - 43',
    'RUNTIME_CINE_Y_SERIES_WHITE': 'RT_Cine y series - 41',
    'RUNTIME_THRILLER_HORROR_WHITE': 'RT_Thriller - 42',
    'RUNTIME_COMEDY_WHITE': 'RT_Comedia - 44',
    'RUNTIME_CRIME_WHITE': 'RT_Crimen - 45',
    'RUNTIME_ROMANCE_WHITE': 'RT_Romance - 46',
    'RUNTIME_CLASSICS_WHITE': 'RT_Clásicos - 47',
    'RUNTIME_FAMILIA': 'enfamilia - 20',
    'RUNTIME_SERIES_WHITE': 'RT_Cine y series - 41',
    // AMC
    'AMC_BREAK': 'amcBreak',
    'AMC_CRIME': 'amcCrime',
    'AMC_WESTERN': 'amc western',
    'AMC_LIVING': 'amc living',
    // Eurosport
    'EUROSPORT_1_WHITE': 'eurosport1',
    'EUROSPORT_2_WHITE': 'eurosport2',
    // Deportes misc
    'RUGBY_SPAIN_WHITE': 'rugbySpain',
    'TENNIS_CHANNEL': 'tennisChannel',
    'MY_PADEL_TV': 'myPadelTv',
    'HORSE_TV': 'horseTV',
    'NAUTICAL_CHANNEL': 'nauticalChannel',
    // Sky
    'SKYSHOWTIME_1': 'SkyShowtime1',
};

// Normalize a channel name for fuzzy matching: lowercase, strip suffixes, underscores → spaces → collapsed
function normalizeChannel(name: string): string {
    return name
        .toLowerCase()
        .replace(/_/g, ' ')
        .replace(/\b(logo|4k|white|hd|b|v2|color)\b/g, '')  // common URL suffixes
        .replace(/\s*-\s*\d+\s*$/, '')                        // Figma " - N" channel number
        .replace(/^canal\s+/i, '')                             // CANAL_ prefix
        .replace(/^movistar\s+/i, 'm')                         // MOVISTAR_ → M
        .replace(/\s+/g, '')                                    // collapse spaces
        .trim();
}

function findBestVariantMatch(providerValue: string, variantOptions: string[]): string | null {
    // 0. Exact match — cuando las variantes de Figma se renombren para coincidir con los nombres
    // de URL de OTV (ej. "LA_SEXTA", "ANTENA3"), esto resolverá directamente sin necesitar la tabla.
    // TODO: Una vez completado ese renombrado, CHANNEL_TO_PROVIDER puede eliminarse.
    if (variantOptions.includes(providerValue)) return providerValue;
    // 1. Hardcoded mapping table (URL channel name → Figma variant name actual)
    const mapped = CHANNEL_TO_PROVIDER[providerValue];
    if (mapped && variantOptions.includes(mapped)) return mapped;
    // 2. Case-insensitive exact
    const lower = providerValue.toLowerCase();
    const ciMatch = variantOptions.find(o => o.toLowerCase() === lower);
    if (ciMatch) return ciMatch;
    // 3. Normalized match
    const norm = normalizeChannel(providerValue);
    if (!norm) return null;
    const match = variantOptions.find(o => normalizeChannel(o) === norm);
    if (match) return match;
    // 4. Substring match (normalized name contained in variant or vice versa)
    const subMatch = variantOptions.find(o => {
        const normOpt = normalizeChannel(o);
        return normOpt.length >= 3 && (normOpt.includes(norm) || norm.includes(normOpt));
    });
    return subMatch || null;
}

function applyProviderLogo(logos: InstanceNode[], providerValue: string): number {
    let applied = 0;
    for (const logo of logos) {
        const props = logo.componentProperties;
        let providerKey: string | null = null;
        for (const key of Object.keys(props)) {
            const kl = key.toLowerCase();
            if (kl === 'provider' || kl.startsWith('provider#')) {
                providerKey = key;
                break;
            }
        }
        console.log(`[applyProvider] logo="${logo.name}" key="${providerKey}" value="${providerValue}"`);
        if (!providerKey) continue;

        // Resolve the actual variant value to use (exact or fuzzy match)
        let resolvedValue: string | null = providerValue;
        const mainComp = logo.mainComponent;
        const compSet = mainComp?.parent;
        if (compSet && compSet.type === 'COMPONENT_SET') {
            const baseKey = providerKey.split('#')[0];
            const propDef = (compSet as ComponentSetNode).componentPropertyDefinitions[baseKey];
            if (propDef?.type === 'VARIANT' && propDef.variantOptions) {
                resolvedValue = findBestVariantMatch(providerValue, propDef.variantOptions);
                if (!resolvedValue) {
                    console.warn(`[provider] No match for "${providerValue}"`);
                    continue;
                }
            }
        }

        try {
            if (mainComp) logo.swapComponent(mainComp);
            logo.setProperties({ [providerKey]: resolvedValue });
            applied++;
        } catch (e) {
            try {
                logo.setProperties({ [providerKey]: resolvedValue });
                applied++;
            } catch (_) {
                // Valor no válido para este componente — se ignora silenciosamente
            }
        }
    }
    return applied;
}

// -- Check if node is a provider logo component --
function isProviderLogoComponent(node: SceneNode): boolean {
    if (node.type !== 'INSTANCE') return false;
    const name = node.name.trim().toLowerCase();
    if (name === 'providerlogosquare' || name === 'providerlogorectangle') return true;
    // Detecta también por presencia de la propiedad 'provider' (cubre card_channel, card_emission y futuros componentes)
    try {
        const props = (node as InstanceNode).componentProperties;
        return Object.keys(props).some(k => { const kl = k.toLowerCase(); return kl === 'provider' || kl.startsWith('provider#'); });
    } catch (_) {
        return false;
    }
}

// -- Walk up to find the nearest INSTANCE ancestor (any instance, not just provider ones) --
function findNearestInstanceAncestor(node: SceneNode): InstanceNode | null {
    let current: BaseNode | null = node.parent;
    while (current && current.type !== 'PAGE' && current.type !== 'DOCUMENT') {
        if (current.type === 'INSTANCE') return current as InstanceNode;
        current = current.parent;
    }
    return null;
}

// -- Walk up ancestors from a node to find the nearest INSTANCE with a 'provider' componentProperty --
// Used for card_channel / card_emission where the provider variant is on the card itself, not a child.
function findProviderLogoAncestor(node: SceneNode): InstanceNode | null {
    let current: BaseNode | null = node.parent;
    while (current && current.type !== 'PAGE' && current.type !== 'DOCUMENT') {
        if (current.type === 'INSTANCE') {
            try {
                const props = (current as InstanceNode).componentProperties;
                if (Object.keys(props).some(k => { const kl = k.toLowerCase(); return kl === 'provider' || kl.startsWith('provider#'); })) {
                    return current as InstanceNode;
                }
            } catch (_) { }
        }
        current = current.parent;
    }
    return null;
}

// -- Find all provider logo components in selection --
function findProviderLogoNodes(nodes: readonly SceneNode[], excludeIds: Set<string> = new Set()): InstanceNode[] {
    const logos: InstanceNode[] = [];
    for (const node of nodes) {
        if (isExcluded(node, excludeIds)) continue;
        if (isProviderLogoComponent(node)) logos.push(node as InstanceNode);
        if ('findAllWithCriteria' in node) {
            const instances = node.findAllWithCriteria({ types: ['INSTANCE'] });
            for (const child of instances) {
                if (isProviderLogoComponent(child) && !isExcluded(child, excludeIds)) {
                    logos.push(child);
                }
            }
        }
    }
    return logos;
}

// -- Async: resolve component name for an instance (works for remote library components) --
async function getComponentNameAsync(inst: InstanceNode): Promise<string> {
    if (inst.mainComponent?.name) return inst.mainComponent.name.toLowerCase();
    try {
        const main = await inst.getMainComponentAsync();
        if (main?.name) return main.name.toLowerCase();
    } catch (_) { }
    return '';
}

// -- Returns true if a component name matches a card type (portrait, landscape or reparto) --
function isCardComponentName(name: string): boolean {
    const n = name.toLowerCase();
    return n.includes('card') && (n.includes('portrait') || n.includes('landscape') || n.includes('reparto') || n.includes('chapter'));
}

// -- Sync: build card cache from nodes using only mainComponent.name (no await).
// Fast — catches all locally accessible components immediately. --
function refreshCardCacheSync(nodes: readonly SceneNode[]) {
    for (const node of nodes) {
        if (node.type === 'INSTANCE') {
            const compName = (node.mainComponent?.name || '').toLowerCase();
            if (isCardComponentName(compName)) cachedAllCardIds.add(node.id);
        }
        if ('findAllWithCriteria' in node) {
            const instances = node.findAllWithCriteria({ types: ['INSTANCE'] });
            for (const child of instances) {
                const compName = (child.mainComponent?.name || '').toLowerCase();
                if (isCardComponentName(compName)) cachedAllCardIds.add(child.id);
            }
        }
    }
}

// -- Async: extend card cache with remote/library components (getMainComponentAsync).
// Called at selection time; sync pre-pass already handled by refreshCardCacheSync.
// Resolves in parallel batches of BATCH_SIZE to avoid blocking the Figma thread. --
const CARD_CACHE_BATCH_SIZE = 10;

async function refreshCardCache(nodes: readonly SceneNode[]) {
    cachedAllCardIds = new Set<string>();
    refreshCardCacheSync(nodes); // immediate sync pass first
    const instances: InstanceNode[] = [];
    for (const node of nodes) {
        if (node.type === 'INSTANCE' && !cachedAllCardIds.has(node.id)) {
            instances.push(node as InstanceNode);
        }
        if ('findAllWithCriteria' in node) {
            const children = node.findAllWithCriteria({ types: ['INSTANCE'] });
            for (const child of children) {
                if (!cachedAllCardIds.has(child.id)) {
                    instances.push(child);
                }
            }
        }
    }
    // Resolve in parallel batches
    for (let i = 0; i < instances.length; i += CARD_CACHE_BATCH_SIZE) {
        const batch = instances.slice(i, i + CARD_CACHE_BATCH_SIZE);
        const names = await Promise.all(batch.map(inst => getComponentNameAsync(inst)));
        for (let j = 0; j < batch.length; j++) {
            if (isCardComponentName(names[j])) cachedAllCardIds.add(batch[j].id);
        }
    }
}

// -- Find cover nodes, skipping subtrees rooted at excluded IDs --
function findCoverNodes(nodes: readonly SceneNode[], excludeIds: Set<string> = new Set()): SceneNode[] {
    const covers: SceneNode[] = [];
    for (const node of nodes) {
        if (isExcluded(node, excludeIds)) continue;
        if (isCoverNode(node)) covers.push(node);
        if ('findAll' in node) {
            const children = node.findAll(child => isCoverNode(child as SceneNode) && !isExcluded(child, excludeIds));
            covers.push(...(children as SceneNode[]));
        }
    }
    return covers;
}

// -- Find titleTreatment nodes, skipping subtrees rooted at excluded IDs --
function findTitleTreatmentNodes(nodes: readonly SceneNode[], excludeIds: Set<string> = new Set()): SceneNode[] {
    const titleTreatments: SceneNode[] = [];
    for (const node of nodes) {
        if (isExcluded(node, excludeIds)) continue;
        if (isTitleTreatmentNode(node)) titleTreatments.push(node);
        if ('findAll' in node) {
            const children = node.findAll(child => isTitleTreatmentNode(child as SceneNode) && !isExcluded(child, excludeIds));
            titleTreatments.push(...(children as SceneNode[]));
        }
    }
    return titleTreatments;
}

// -- Helper: check if component name is a chapter card --
function isChapterCardComponent(name: string): boolean {
    const n = name.toLowerCase();
    // Match: card_chapters, card-chapters, CardChapters, etc.
    // Require both "card" and "chapter" to avoid matching containers like "rowChapters"
    return n.includes('card') && n.includes('chapter');
}

// -- Find chapter card instances (sync - uses only mainComponent.name) --
function findChapterCardInstancesSync(nodes: readonly SceneNode[]): InstanceNode[] {
    const chapterCards: InstanceNode[] = [];
    for (const node of nodes) {
        if (node.type === 'INSTANCE') {
            const compName = node.mainComponent?.name || '';
            if (compName && isChapterCardComponent(compName)) chapterCards.push(node);
        }
        if ('findAllWithCriteria' in node) {
            const instances = node.findAllWithCriteria({ types: ['INSTANCE'] });
            for (const inst of instances) {
                const compName = inst.mainComponent?.name || '';
                if (compName && isChapterCardComponent(compName)) chapterCards.push(inst);
            }
        }
    }
    return chapterCards;
}

// -- Helper: check if an instance has a "cover" child (confirms it's a real card) --
function hasCoverChild(node: SceneNode): boolean {
    if (isCoverNode(node)) return true;
    if ('findOne' in node) {
        return !!node.findOne(child => isCoverNode(child as SceneNode));
    }
    return false;
}

// -- Find chapter card instances (async - resolves remote components) --
async function findChapterCardInstancesAsync(nodes: readonly SceneNode[]): Promise<InstanceNode[]> {
    const chapterCards: InstanceNode[] = [];
    const allInstances: InstanceNode[] = [];

    // Collect all instances from the selection tree
    for (const node of nodes) {
        if (node.type === 'INSTANCE' && !allInstances.includes(node as InstanceNode)) {
            allInstances.push(node as InstanceNode);
        }
        if ('findAllWithCriteria' in node) {
            const instances = node.findAllWithCriteria({ types: ['INSTANCE'] });
            for (const inst of instances) {
                if (!allInstances.includes(inst)) allInstances.push(inst);
            }
        }
    }

    // Check each instance (check instance name OR component name OR ComponentSet parent name)
    const addedIds = new Set<string>();

    for (const inst of allInstances) {
        // Skip if already added (prevent duplicates)
        if (addedIds.has(inst.id)) continue;

        const instanceName = inst.name;
        const syncName = inst.mainComponent?.name || '';
        let isChapter = false;

        // Check instance name, mainComponent name, or ComponentSet parent name
        if (isChapterCardComponent(instanceName)) {
            isChapter = true;
        } else if (syncName && isChapterCardComponent(syncName)) {
            isChapter = true;
        } else if (inst.mainComponent?.parent?.type === 'COMPONENT_SET') {
            const componentSetName = inst.mainComponent.parent.name;
            if (isChapterCardComponent(componentSetName)) {
                isChapter = true;
            }
        } else if (!syncName) {
            const asyncName = await getComponentNameAsync(inst);
            if (isChapterCardComponent(asyncName)) {
                isChapter = true;
            }
        }

        // Only add if it matches AND has a "cover" child (confirms it's a real card,
        // not a nested sub-component like a chapter badge or indicator)
        if (isChapter && hasCoverChild(inst)) {
            chapterCards.push(inst);
            addedIds.add(inst.id);
        }
    }

    return chapterCards;
}

// -- Helper: set text content on a named text node --
async function setTextContent(parent: SceneNode, name: string, value: string) {
    const textNode = findTextNode(parent, name);
    if (textNode) {
        const segments = textNode.getStyledTextSegments(['fontName']);
        if (segments.length > 0) {
            for (const segment of segments) {
                await figma.loadFontAsync(segment.fontName);
            }
        } else {
            // Empty text node: no segments, load font from fontName property directly
            const fn = textNode.fontName;
            if (fn !== figma.mixed) {
                await figma.loadFontAsync(fn as FontName);
            }
        }
        textNode.characters = value;
    }
}

// -- Helper: check if metadata is for a person --
function isPersonMetadata(m: Metadata): m is PersonMetadata {
    return 'personName' in m;
}

// -- Fill metadata text nodes and variant properties in the selection --
async function fillMetadata(nodes: readonly SceneNode[], metadata: Metadata) {
    for (const node of nodes) {
        if (isPersonMetadata(metadata)) {
            if (metadata.personName) await setTextContent(node, 'name', metadata.personName);

            const rolNode = findTextNode(node, 'rol');
            if (rolNode) {
                if (metadata.isActor) {
                    rolNode.visible = false;
                } else {
                    rolNode.visible = true;
                    if (metadata.rol) {
                        for (const segment of rolNode.getStyledTextSegments(['fontName'])) {
                            await figma.loadFontAsync(segment.fontName);
                        }
                        rolNode.characters = metadata.rol;
                    }
                }
            }
        } else {
            const fields = [
                { name: 'title', value: metadata.title },
                { name: 'rating', value: metadata.rating },
                { name: 'year', value: metadata.year },
                { name: 'duration', value: metadata.duration },
                { name: 'sinopsis', value: metadata.sinopsis },
                { name: 'schedule', value: metadata.schedule },
                { name: 'live', value: metadata.live },
            ];
            for (const field of fields) {
                if (field.value) await setTextContent(node, field.name, field.value);
            }

            if (metadata.genres && metadata.genres.length > 0) {
                const genreNames = ['genre', 'genre2', 'genre3'];
                for (let i = 0; i < genreNames.length; i++) {
                    const genreNode = findTextNode(node, genreNames[i]);
                    if (i < metadata.genres.length) {
                        if (genreNode) { await setTextContent(node, genreNames[i], metadata.genres[i]); genreNode.visible = true; }
                    } else {
                        if (genreNode) genreNode.visible = false;
                    }
                }
                const allSeparators = findAllTextNodes(node, 'separator');
                const numGenres = metadata.genres.length;
                for (let i = 0; i < allSeparators.length; i++) {
                    allSeparators[i].visible = i < numGenres - 1;
                }
            }

            if (metadata.ageRating) {
                const ageTag = findInstanceNode(node, 'agetag');
                if (ageTag) {
                    const visibilityStates: Array<{ node: SceneNode; wasVisible: boolean }> = [];
                    let currentNode: BaseNode | null = ageTag;
                    while (currentNode && 'visible' in currentNode) {
                        const sceneNode = currentNode as SceneNode;
                        visibilityStates.push({ node: sceneNode, wasVisible: sceneNode.visible });
                        if (!sceneNode.visible) sceneNode.visible = true;
                        currentNode = sceneNode.parent;
                        if (currentNode === node) break;
                    }
                    const props = ageTag.componentProperties;
                    let ratingKey: string | null = null;
                    for (const key of Object.keys(props)) {
                        if (key === 'rating' || key.startsWith('rating#')) { ratingKey = key; break; }
                    }
                    if (ratingKey) {
                        try {
                            const mainComponent = ageTag.mainComponent;
                            if (mainComponent) ageTag.swapComponent(mainComponent);
                            ageTag.setProperties({ [ratingKey]: metadata.ageRating });
                        } catch (e) {
                            try { ageTag.setProperties({ [ratingKey]: metadata.ageRating }); } catch (_) { }
                        }
                    }
                    for (let i = visibilityStates.length - 1; i >= 0; i--) {
                        const { node: stateNode, wasVisible } = visibilityStates[i];
                        if (!wasVisible) stateNode.visible = false;
                    }
                }
            }
        }
    }
}

// -- Known metadata text node names (used by findMetadataScope to validate scope) --
const METADATA_NODE_NAMES = new Set(['title', 'rating', 'year', 'duration', 'sinopsis', 'genre', 'name', 'rol', 'chapter']);

// -- Find the metadata scope for a cover node --
// Walks up from the cover, preferring the nearest ancestor that contains
// at least one text node with a known metadata name. Falls back to the
// first ancestor with any text if no named match is found.
function findMetadataScope(coverNode: SceneNode): SceneNode {
    let fallback: SceneNode | null = null;
    let current: BaseNode | null = coverNode.parent;
    while (current && current.type !== 'PAGE' && current.type !== 'DOCUMENT') {
        const sceneNode = current as SceneNode;
        if ('findAllWithCriteria' in sceneNode) {
            const texts = sceneNode.findAllWithCriteria({ types: ['TEXT'] });
            if (texts.length > 0) {
                if (!fallback) fallback = sceneNode;
                const hasMetadataNode = texts.some(t => METADATA_NODE_NAMES.has(t.name.trim().toLowerCase()));
                if (hasMetadataNode) return sceneNode;
            }
        }
        current = sceneNode.parent;
    }
    return fallback || (coverNode.parent as SceneNode) || coverNode;
}

// -- Detect component type from a node name --
function typeFromName(name: string): string {
    const n = name.toLowerCase();
    if (n.includes('card') && n.includes('portrait')) return 'card-portrait';
    if (n.includes('card') && n.includes('landscape')) return 'card-landscape';
    if (n.includes('card') && n.includes('chapter')) return 'card-chapters';
    if (n.includes('slideshow')) return 'slideshow';
    if (n.includes('vps')) return 'vps';
    return 'unknown';
}

// -- Synchronous type detection from selection: walks entire tree, checks node names
// and mainComponent.name (sync). Called at apply time to avoid race conditions. --
function detectTypeSync(nodes: readonly SceneNode[]): string {
    let componentType = 'unknown';
    let found = false;
    for (const node of nodes) {
        const t = typeFromName(node.name);
        if (t !== 'unknown') return t;
        if (node.type === 'INSTANCE') {
            const compName = (node.mainComponent?.name || '').toLowerCase();
            const t2 = typeFromName(compName);
            if (t2 !== 'unknown') return t2;
        }
        if ('findOne' in node) {
            node.findOne(child => {
                const ct = typeFromName(child.name);
                if (ct !== 'unknown') { componentType = ct; found = true; return true; }
                if (child.type === 'INSTANCE') {
                    const compName = ((child as InstanceNode).mainComponent?.name || '').toLowerCase();
                    const ct2 = typeFromName(compName);
                    if (ct2 !== 'unknown') { componentType = ct2; found = true; return true; }
                }
                return false;
            });
        }
        if (found) break;
    }
    return componentType;
}

// -- Send current selection info to UI --
// Pass 1 (sync): full tree walk — node names + sync mainComponent.name.
//   walkTree visits parent before children, so a VPS frame is detected before
//   any nested card instances inside it.
// Pass 2 (async): full tree walk — getMainComponentAsync for remote/library
//   instances that had null mainComponent in Pass 1.
// Version counter discards stale results when selection changes mid-async.
async function sendSelection() {
    const myVersion = ++selectionVersion;
    const selection = figma.currentPage.selection;

    let componentType = detectTypeSync(selection);

    // Pass 2 — full tree walk, async (getMainComponentAsync for remote/library instances)
    if (componentType === 'unknown') {
        const allInstances: InstanceNode[] = [];
        for (const node of selection) {
            if (node.type === 'INSTANCE') allInstances.push(node as InstanceNode);
            if ('findAllWithCriteria' in node) {
                allInstances.push(...node.findAllWithCriteria({ types: ['INSTANCE'] }));
            }
        }
        for (const inst of allInstances) {
            const compName = await getComponentNameAsync(inst);
            if (myVersion !== selectionVersion) return; // stale — newer selection started
            const t = typeFromName(compName);
            if (t !== 'unknown') { componentType = t; break; }
        }
    }

    if (myVersion !== selectionVersion) return; // stale — discard

    // For VPS: resolve card instance IDs so cover search skips them
    if (componentType === 'vps') {
        await refreshCardCache(selection);
        if (myVersion !== selectionVersion) return;
    } else {
        cachedAllCardIds = new Set<string>();
    }

    const coverCount = findCoverNodes(selection, cachedAllCardIds).length;
    const titleTreatmentCount = findTitleTreatmentNodes(selection, cachedAllCardIds).length;

    // Always count chapter card instances (even if componentType is unknown/frame)
    // This handles: single card, multiple cards, or frame containing cards
    const chapterInstances = await findChapterCardInstancesAsync(selection);
    if (myVersion !== selectionVersion) return; // stale check
    const chapterCardCount = chapterInstances.length;

    figma.ui.postMessage({ type: 'selection-info', count: selection.length, coverCount, titleTreatmentCount, componentType, chapterCardCount });
}

// -- Debounced selection handler: batches rapid selection changes --
let selectionTimer: ReturnType<typeof setTimeout> | null = null;
function debouncedSendSelection() {
    if (selectionTimer) clearTimeout(selectionTimer);
    selectionTimer = setTimeout(() => {
        selectionTimer = null;
        sendSelection();
    }, 120);
}

// -- Listen to selection changes --
figma.on('selectionchange', () => {
    // Immediately notify UI to reset componentType (prevents stale type being used at apply time)
    figma.ui.postMessage({ type: 'selection-changed' });
    debouncedSendSelection();
});

// -- Handle messages from UI --
interface MovieTvMetadata {
    title: string;
    rating: string;
    year: string;
    duration: string;
    ageRating: string;
    sinopsis: string;
    genres?: string[];
    contentId?: string;
    schedule?: string;
    live?: string;
    channelName?: string;
}

interface PersonMetadata {
    personName: string;
    rol: string;
    isActor: boolean;
    contentId?: string;
}

type Metadata = MovieTvMetadata | PersonMetadata;

interface CoverData {
    imageBytes: number[];
    titleTreatmentBytes?: number[];
    metadata: Metadata | null;
}

interface CoverUrlData {
    coverUrl: string;
    imageBytes?: number[];
    titleTreatmentUrl?: string;
    metadata: Metadata | null;
}

interface EpisodeCoverData {
    coverUrl: string;
    metadata: {
        title: string;
        chapter: string;
        duration: string;
        sinopsis: string;
    };
}

interface PluginMessage {
    type: string;
    imageBytes?: number[];
    titleTreatmentBytes?: number[];
    coverUrl?: string;
    titleTreatmentUrl?: string;
    apiKey?: string;
    metadata?: Metadata | null;
    coversData?: CoverData[];
    coversUrlData?: CoverUrlData[];
    episodesData?: EpisodeCoverData[];
    carouselTitle?: string;
}

figma.ui.onmessage = async (msg: PluginMessage) => {
    if (msg.type === 'get-selection') {
        sendSelection();
    }

    if (msg.type === 'notify-warning' && (msg as any).message) {
        figma.notify((msg as any).message, { timeout: 3000 });
    }

    if (msg.type === 'save-api-key' && msg.apiKey) {
        await figma.clientStorage.setAsync('tmdb_api_key', msg.apiKey);
    }

    if (msg.type === 'load-api-key') {
        const storedKey = await figma.clientStorage.getAsync('tmdb_api_key');
        figma.ui.postMessage({ type: 'loaded-api-key', apiKey: storedKey || '' });
    }

    // -- Cache catalog from Supabase (v3) --
    if (msg.type === 'cache-catalog') {
        try {
            const catalogData = (msg as any).data;
            const cacheEntry = {
                data: catalogData,
                timestamp: Date.now()
            };
            await figma.clientStorage.setAsync('otv_catalog_cache', cacheEntry);
            console.log('Catalog cached successfully');
        } catch (e) {
            console.error('Error caching catalog:', e);
        }
    }

    // -- Get cached catalog (v3) --
    if (msg.type === 'get-cached-catalog') {
        try {
            const cacheEntry = await figma.clientStorage.getAsync('otv_catalog_cache');
            if (cacheEntry) {
                figma.ui.postMessage({
                    type: 'cached-catalog',
                    data: cacheEntry.data,
                    timestamp: cacheEntry.timestamp
                });
            } else {
                figma.ui.postMessage({
                    type: 'cached-catalog',
                    data: null
                });
            }
        } catch (e) {
            console.error('Error loading cached catalog:', e);
            figma.ui.postMessage({
                type: 'cached-catalog',
                data: null
            });
        }
    }

    if (msg.type === 'apply-cover' && msg.imageBytes) {
        const bytes = new Uint8Array(msg.imageBytes);
        const image = figma.createImage(bytes);
        const selection = figma.currentPage.selection;
        const coverNodes = findCoverNodes(selection, cachedAllCardIds);

        if (coverNodes.length === 0) {
            figma.notify('⚠️ No se encontró ningún frame llamado "cover" en la selección.', { error: true });
            return;
        }

        for (const cover of coverNodes) {
            if ('fills' in cover) {
                (cover as GeometryMixin & SceneNode).fills = [{ type: 'IMAGE', imageHash: image.hash, scaleMode: 'FILL' }];
            }
        }

        if (msg.titleTreatmentBytes) {
            const ttBytes = new Uint8Array(msg.titleTreatmentBytes);
            const ttImage = figma.createImage(ttBytes);
            const ttNodes = findTitleTreatmentNodes(selection, cachedAllCardIds);
            for (const ttNode of ttNodes) {
                if ('fills' in ttNode) {
                    (ttNode as GeometryMixin & SceneNode).fills = [{ type: 'IMAGE', imageHash: ttImage.hash, scaleMode: 'FIT' }];
                }
            }
        }

        if (msg.metadata) {
            const scopesDone = new Set<string>();
            for (const cover of coverNodes) {
                const scope = findMetadataScope(cover);
                if (!scopesDone.has(scope.id)) {
                    scopesDone.add(scope.id);
                    await fillMetadata([scope], msg.metadata);
                }
            }
        }

        const ttCount = msg.titleTreatmentBytes ? findTitleTreatmentNodes(selection, cachedAllCardIds).length : 0;
        figma.notify(ttCount > 0
            ? `✅ Cover y título aplicados a ${coverNodes.length} elemento(s).`
            : `✅ Cover aplicada a ${coverNodes.length} elemento(s).`);
    }

    // -- Apply cover via URL (OTV CDN) --
    if (msg.type === 'apply-cover-url' && msg.coverUrl) {
        const selection = figma.currentPage.selection;
        const coverUrl = msg.coverUrl;

        // If VPS, run sync card cache pass at apply time to handle timing gaps
        // (the async refreshCardCache in sendSelection may not have completed yet)
        if (detectTypeSync(selection) === 'vps') refreshCardCacheSync(selection);

        const coverNodes = findCoverNodes(selection, cachedAllCardIds);

        if (coverNodes.length === 0) {
            figma.notify('⚠️ No se encontró ningún frame llamado "cover" en la selección.', { error: true });
            figma.ui.postMessage({ type: 'apply-done', success: false });
            return;
        }

        // 1. Cargar imagen principal (único punto de fallo que muestra error al usuario)
        // Preferimos imageBytes (pre-fetched en la UI con cookies de sesión OTV, necesario para EPG)
        let image: Image;
        try {
            if (msg.imageBytes) {
                image = figma.createImage(new Uint8Array(msg.imageBytes));
            } else {
                image = await figma.createImageAsync(coverUrl);
            }
        } catch (e) {
            figma.notify('⚠️ Error al cargar la imagen.', { error: true });
            figma.ui.postMessage({ type: 'apply-done', success: false, error: (e as Error).message });
            return;
        }
        for (const cover of coverNodes) {
            if ('fills' in cover) {
                (cover as GeometryMixin & SceneNode).fills = [{ type: 'IMAGE', imageHash: image.hash, scaleMode: 'FILL' }];
            }
        }

        // 2. Title treatment (opcional, falla silenciosamente)
        if (msg.titleTreatmentUrl) {
            try {
                const ttImage = await figma.createImageAsync(msg.titleTreatmentUrl);
                const ttNodes = findTitleTreatmentNodes(selection, cachedAllCardIds);
                for (const ttNode of ttNodes) {
                    if ('fills' in ttNode) {
                        (ttNode as GeometryMixin & SceneNode).fills = [{ type: 'IMAGE', imageHash: ttImage.hash, scaleMode: 'FIT' }];
                    }
                }
            } catch (_) { }
        }

        // 3. Metadata (falla silenciosamente)
        if (msg.metadata) {
            try {
                const scopesDone = new Set<string>();
                for (const cover of coverNodes) {
                    const scope = findMetadataScope(cover);
                    if (!scopesDone.has(scope.id)) {
                        scopesDone.add(scope.id);
                        await fillMetadata([scope], msg.metadata);
                    }
                }
            } catch (_) { }
        }

        // 4. Provider logo (falla silenciosamente)
        try {
            let providerLogos = findProviderLogoNodes(selection, cachedAllCardIds);
            if (providerLogos.length === 0) {
                // Fallback: walk up from each cover looking for an INSTANCE with 'provider' property
                for (const cn of coverNodes) {
                    const pa = findProviderLogoAncestor(cn);
                    if (pa) { providerLogos = [pa]; break; }
                }
            }
            if (providerLogos.length > 0) {
                const channelName = (msg.metadata as MovieTvMetadata)?.channelName;
                const providerFromId = msg.metadata?.contentId ? extractProvider(msg.metadata.contentId) : null;
                const providerValue = channelName || providerFromId;
                if (providerValue) applyProviderLogo(providerLogos, providerValue);
            }
        } catch (_) { }

        const ttCount = msg.titleTreatmentUrl ? findTitleTreatmentNodes(selection, cachedAllCardIds).length : 0;
        figma.notify(ttCount > 0
            ? `✅ Cover y título aplicados a ${coverNodes.length} elemento(s).`
            : `✅ Cover aplicada a ${coverNodes.length} elemento(s).`);
        figma.ui.postMessage({ type: 'apply-done', success: true });
    }

    // -- Detect if selection is a channel row (skip first 3 covers) --
    function getChannelRowOffset(nodes: readonly SceneNode[]): number {
        for (const node of nodes) {
            const n = node.name.trim().toLowerCase().replace(/[\s_-]+/g, '');
            if (n.includes('row') && n.includes('channel')) return 3;
        }
        return 0;
    }

    // -- Apply multiple covers via URL (OTV CDN) --
    if (msg.type === 'apply-multiple-covers-url' && msg.coversUrlData) {
        const selection = figma.currentPage.selection;
        const coverNodes = findCoverNodes(selection, cachedAllCardIds);

        if (coverNodes.length === 0) {
            figma.notify('⚠️ No se encontró ningún frame llamado "cover" en la selección.', { error: true });
            figma.ui.postMessage({ type: 'apply-done', success: false });
            return;
        }

        const coversUrlData = msg.coversUrlData;
        const cardOffset = getChannelRowOffset(selection);
        const targetCoverNodes = coverNodes.slice(cardOffset);
        const applyCount = Math.min(targetCoverNodes.length, coversUrlData.length);

        let successCount = 0;
        for (let i = 0; i < applyCount; i++) {
            const coverNode = targetCoverNodes[i];
            const coverData = coversUrlData[i];

            try {
                // Preferimos imageBytes (pre-fetched en la UI con cookies de sesión OTV, necesario para EPG)
                const image = coverData.imageBytes
                    ? figma.createImage(new Uint8Array(coverData.imageBytes))
                    : await figma.createImageAsync(coverData.coverUrl);
                if ('fills' in coverNode) {
                    (coverNode as GeometryMixin & SceneNode).fills = [{ type: 'IMAGE', imageHash: image.hash, scaleMode: 'FILL' }];
                }
                successCount++;
            } catch (e) { console.warn(`[cover ${i}] Image failed: ${coverData.coverUrl.substring(0, 100)}`); }

            if (coverData.titleTreatmentUrl) {
                try {
                    const ttImage = await figma.createImageAsync(coverData.titleTreatmentUrl);
                    const scope = findMetadataScope(coverNode);
                    const ttNodes = findTitleTreatmentNodes([scope]);
                    if (ttNodes.length > 0 && 'fills' in ttNodes[0]) {
                        (ttNodes[0] as GeometryMixin & SceneNode).fills = [{ type: 'IMAGE', imageHash: ttImage.hash, scaleMode: 'FIT' }];
                    }
                } catch (_) { }
            }

            if (coverData.metadata) {
                const scope = findMetadataScope(coverNode);
                await fillMetadata([scope], coverData.metadata);
            }

            // Apply provider logo: prefer channelName from HTML paste, fallback to contentId prefix
            // Search strategy: metadata scope first, then nearest INSTANCE ancestor (covers card_channel where
            // providerLogoSquare is a sibling of wrapper inside the card instance, not inside metadata scope)
            const scope2 = findMetadataScope(coverNode);
            let logos = findProviderLogoNodes([scope2], cachedAllCardIds);
            console.log(`[provider S1] cover="${coverNode.name}" scope="${scope2.name}" logos=${logos.length}`);
            if (logos.length === 0) {
                // Expand search to nearest INSTANCE ancestor of cover
                const instAncestor = findNearestInstanceAncestor(coverNode);
                console.log(`[provider S2] ancestor="${instAncestor?.name ?? 'null'}"`);
                if (instAncestor) logos = findProviderLogoNodes([instAncestor], cachedAllCardIds);
                console.log(`[provider S2] logos=${logos.length}`);
            }
            if (logos.length === 0) {
                // Last resort: walk up ancestors looking for an INSTANCE with a 'provider' property
                const providerAncestor = findProviderLogoAncestor(coverNode);
                console.log(`[provider S3] providerAncestor="${providerAncestor?.name ?? 'null'}"`);
                if (providerAncestor) logos = [providerAncestor];
            }

            const metaRaw = coverData.metadata as unknown as Record<string, string> | null;
            const channelName = metaRaw?.channelName;
            const providerFromId = metaRaw?.contentId ? extractProvider(metaRaw.contentId) : null;
            const providerValue = channelName || providerFromId;
            console.log(`[provider] channelName="${channelName}" providerValue="${providerValue}" logos=${logos.length}`);
            if (logos.length > 0 && providerValue) {
                applyProviderLogo(logos, providerValue);
            }
        }

        // Apply carousel title to Row_title node if present
        if (msg.carouselTitle) {
            for (const node of selection) {
                let applied = false;
                // Try component text property first (e.g. "título de la row", "row_title")
                if (node.type === 'INSTANCE') {
                    const props = node.componentProperties;
                    for (const [key, prop] of Object.entries(props)) {
                        if (prop.type === 'TEXT') {
                            const baseName = key.split('#')[0].trim().toLowerCase();
                            if (baseName.includes('row')) {
                                try {
                                    node.setProperties({ [key]: msg.carouselTitle });
                                    applied = true;
                                } catch (_) { }
                                break;
                            }
                        }
                    }
                }
                // Fallback: find a text node named row_title
                if (!applied) {
                    try {
                        await setTextContent(node, 'row_title', msg.carouselTitle);
                    } catch (_) { }
                }
            }
        }

        const skipped = applyCount - successCount;
        if (skipped > 0) {
            figma.notify(`✅ ${successCount} cover(s) aplicadas. ⚠️ ${skipped} no disponibles.`);
        } else {
            figma.notify(`✅ ${successCount} cover(s) aplicadas.`);
        }
        figma.ui.postMessage({ type: 'apply-done', success: true });
    }

    if (msg.type === 'apply-multiple-covers' && msg.coversData) {
        const selection = figma.currentPage.selection;
        const coverNodes = findCoverNodes(selection, cachedAllCardIds);

        if (coverNodes.length === 0) {
            figma.notify('⚠️ No se encontró ningún frame llamado "cover" en la selección.', { error: true });
            return;
        }

        const coversData = msg.coversData;
        const applyCount = Math.min(coverNodes.length, coversData.length);

        for (let i = 0; i < applyCount; i++) {
            const coverNode = coverNodes[i];
            const coverData = coversData[i];

            const bytes = new Uint8Array(coverData.imageBytes);
            const image = figma.createImage(bytes);
            if ('fills' in coverNode) {
                (coverNode as GeometryMixin & SceneNode).fills = [{ type: 'IMAGE', imageHash: image.hash, scaleMode: 'FILL' }];
            }

            if (coverData.titleTreatmentBytes) {
                const ttBytes = new Uint8Array(coverData.titleTreatmentBytes);
                const ttImage = figma.createImage(ttBytes);
                const scope = findMetadataScope(coverNode);
                const ttNodes = findTitleTreatmentNodes([scope]);
                if (ttNodes.length > 0 && 'fills' in ttNodes[0]) {
                    (ttNodes[0] as GeometryMixin & SceneNode).fills = [{ type: 'IMAGE', imageHash: ttImage.hash, scaleMode: 'FIT' }];
                }
            }

            if (coverData.metadata) {
                const scope = findMetadataScope(coverNode);
                await fillMetadata([scope], coverData.metadata);
            }
        }

        figma.notify(`✅ ${applyCount} cover(s) aplicadas con contenido aleatorio.`);
    }

    // -- Apply episode covers to card_chapters --
    if (msg.type === 'apply-episode-covers' && msg.episodesData) {
        const selection = figma.currentPage.selection;
        const episodesData = msg.episodesData;

        // Find chapter card instances (not just covers - this handles custom instance names)
        const chapterInstances = await findChapterCardInstancesAsync(selection);

        if (chapterInstances.length === 0) {
            figma.notify('⚠️ No se encontraron componentes card_chapters en la selección.', { error: true });
            figma.ui.postMessage({ type: 'apply-done', success: false });
            return;
        }

        const applyCount = Math.min(chapterInstances.length, episodesData.length);

        try {
            for (let i = 0; i < applyCount; i++) {
                const chapterCard = chapterInstances[i];
                const epData = episodesData[i];
                let coverNode: SceneNode | null = null;
                if (isCoverNode(chapterCard)) {
                    coverNode = chapterCard;
                } else if ('findOne' in chapterCard) {
                    coverNode = chapterCard.findOne(child => isCoverNode(child as SceneNode)) as SceneNode | null;
                }

                if (!coverNode) continue; // Skip if no cover found in this card

                // Apply still image
                if (epData.coverUrl) {
                    const image = await figma.createImageAsync(epData.coverUrl);
                    if ('fills' in coverNode) {
                        (coverNode as GeometryMixin & SceneNode).fills = [
                            { type: 'IMAGE', imageHash: image.hash, scaleMode: 'FILL' }
                        ];
                    }
                }

                // Apply episode metadata to the card instance (not just the cover scope)
                if (epData.metadata) {
                    const fields = [
                        { name: 'title', value: epData.metadata.title },
                        { name: 'chapter', value: epData.metadata.chapter },
                        { name: 'duration', value: epData.metadata.duration },
                        { name: 'sinopsis', value: epData.metadata.sinopsis },
                    ];
                    for (const field of fields) {
                        if (field.value) await setTextContent(chapterCard, field.name, field.value);
                    }
                }
            }

            figma.notify(`✅ ${applyCount} capítulo(s) aplicado(s).`);
            figma.ui.postMessage({ type: 'apply-done', success: true });
        } catch (e) {
            figma.notify('⚠️ Error al aplicar capítulos.', { error: true });
            figma.ui.postMessage({ type: 'apply-done', success: false, error: (e as Error).message });
        }
    }

    if (msg.type === 'close') {
        figma.closePlugin();
    }
};

// -- Initial selection + send stored API key --
sendSelection();
(async () => {
    const storedKey = await figma.clientStorage.getAsync('tmdb_api_key');
    if (storedKey) {
        figma.ui.postMessage({ type: 'loaded-api-key', apiKey: storedKey });
    }
})();
