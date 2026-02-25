"use strict";
// TMDB Covers — Figma Plugin (Sandbox)
// This runs in Figma's sandbox and has access to the Figma API.
figma.showUI(__html__, { width: 380, height: 580, themeColors: true });
// -- Module-level cache: IDs of card instances inside VPS (to exclude from cover search) --
let cachedAllCardIds = new Set();
// -- Version counter: cancels stale async sendSelection calls --
let selectionVersion = 0;
// -- Provider prefix → variable value mapping --
const PROVIDER_MAP = {
    'PRIME': 'Prime Video',
    'SKYS': 'SkyShowtime',
    'DSN': 'Disney+',
    'MAX': 'Max',
    'RTVE': 'RTVE Play',
    'FLMN': 'Filmin',
    'APREM': 'A3 Premium'
};
// -- Helper: check if a node or its ancestors are in the exclude set --
function isExcluded(node, excludeIds) {
    if (excludeIds.size === 0)
        return false;
    let current = node;
    while (current && current.type !== 'PAGE' && current.type !== 'DOCUMENT') {
        if (excludeIds.has(current.id))
            return true;
        current = current.parent;
    }
    return false;
}
// -- Check if a node is a valid "cover" target --
function isCoverNode(node) {
    return node.name.trim().toLowerCase() === 'cover' && 'fills' in node;
}
// -- Check if a node is a valid "titleTreatment" target --
function isTitleTreatmentNode(node) {
    const name = node.name.trim().toLowerCase();
    return (name === 'titletreatment' || name === 'title treatment' || name === 'title_treatment') && 'fills' in node;
}
// -- Find a text node by name inside a parent (including hidden) --
function findTextNode(parent, name) {
    if (parent.type === 'TEXT' && parent.name.trim().toLowerCase() === name)
        return parent;
    if ('findAllWithCriteria' in parent) {
        const texts = parent.findAllWithCriteria({ types: ['TEXT'] });
        return texts.find(n => n.name.trim().toLowerCase() === name) || null;
    }
    return null;
}
// -- Find all text nodes by name inside a parent (including hidden) --
function findAllTextNodes(parent, name) {
    const results = [];
    if (parent.type === 'TEXT' && parent.name.trim().toLowerCase() === name)
        results.push(parent);
    if ('findAllWithCriteria' in parent) {
        const texts = parent.findAllWithCriteria({ types: ['TEXT'] });
        results.push(...texts.filter(n => n.name.trim().toLowerCase() === name));
    }
    return results;
}
// -- Find a component instance by name inside a parent (including hidden) --
function findInstanceNode(parent, name) {
    if (parent.type === 'INSTANCE' && parent.name.trim().toLowerCase() === name)
        return parent;
    if ('findAllWithCriteria' in parent) {
        const instances = parent.findAllWithCriteria({ types: ['INSTANCE'] });
        return instances.find(n => n.name.trim().toLowerCase() === name) || null;
    }
    return null;
}
// -- Extract provider from contentId prefix --
function extractProvider(contentId) {
    if (!contentId || contentId.length < 2)
        return null;
    const idUpper = contentId.toUpperCase();
    for (const key of Object.keys(PROVIDER_MAP)) {
        if (idUpper.startsWith(key)) {
            return PROVIDER_MAP[key];
        }
    }
    return null;
}
// -- Apply provider logo to matching instances in a scope --
function applyProviderLogo(logos, providerValue) {
    let applied = 0;
    for (const logo of logos) {
        const props = logo.componentProperties;
        let providerKey = null;
        for (const key of Object.keys(props)) {
            if (key === 'provider' || key.startsWith('provider#')) {
                providerKey = key;
                break;
            }
        }
        if (!providerKey)
            continue;
        try {
            const mainComponent = logo.mainComponent;
            if (mainComponent)
                logo.swapComponent(mainComponent);
            logo.setProperties({ [providerKey]: providerValue });
            applied++;
        }
        catch (e) {
            try {
                logo.setProperties({ [providerKey]: providerValue });
                applied++;
            }
            catch (err) {
                console.warn(`Provider logo failed for "${providerValue}":`, err);
                figma.notify(`⚠️ No se pudo aplicar logo de ${providerValue}`, { timeout: 2000 });
            }
        }
    }
    return applied;
}
// -- Check if node is a provider logo component --
function isProviderLogoComponent(node) {
    if (node.type !== 'INSTANCE')
        return false;
    const name = node.name.trim().toLowerCase();
    return name === 'providerlogosquare' || name === 'providerlogorectangle';
}
// -- Find all provider logo components in selection --
function findProviderLogoNodes(nodes, excludeIds = new Set()) {
    const logos = [];
    for (const node of nodes) {
        if (isExcluded(node, excludeIds))
            continue;
        if (isProviderLogoComponent(node))
            logos.push(node);
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
async function getComponentNameAsync(inst) {
    var _a;
    if ((_a = inst.mainComponent) === null || _a === void 0 ? void 0 : _a.name)
        return inst.mainComponent.name.toLowerCase();
    try {
        const main = await inst.getMainComponentAsync();
        if (main === null || main === void 0 ? void 0 : main.name)
            return main.name.toLowerCase();
    }
    catch (_) { }
    return '';
}
// -- Returns true if a component name matches a card type (portrait, landscape or reparto) --
function isCardComponentName(name) {
    const n = name.toLowerCase();
    return n.includes('card') && (n.includes('portrait') || n.includes('landscape') || n.includes('reparto') || n.includes('chapter'));
}
// -- Sync: build card cache from nodes using only mainComponent.name (no await).
// Fast — catches all locally accessible components immediately. --
function refreshCardCacheSync(nodes) {
    var _a, _b;
    for (const node of nodes) {
        if (node.type === 'INSTANCE') {
            const compName = (((_a = node.mainComponent) === null || _a === void 0 ? void 0 : _a.name) || '').toLowerCase();
            if (isCardComponentName(compName))
                cachedAllCardIds.add(node.id);
        }
        if ('findAllWithCriteria' in node) {
            const instances = node.findAllWithCriteria({ types: ['INSTANCE'] });
            for (const child of instances) {
                const compName = (((_b = child.mainComponent) === null || _b === void 0 ? void 0 : _b.name) || '').toLowerCase();
                if (isCardComponentName(compName))
                    cachedAllCardIds.add(child.id);
            }
        }
    }
}
// -- Async: extend card cache with remote/library components (getMainComponentAsync).
// Called at selection time; sync pre-pass already handled by refreshCardCacheSync.
// Resolves in parallel batches of BATCH_SIZE to avoid blocking the Figma thread. --
const CARD_CACHE_BATCH_SIZE = 10;
async function refreshCardCache(nodes) {
    cachedAllCardIds = new Set();
    refreshCardCacheSync(nodes); // immediate sync pass first
    const instances = [];
    for (const node of nodes) {
        if (node.type === 'INSTANCE' && !cachedAllCardIds.has(node.id)) {
            instances.push(node);
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
            if (isCardComponentName(names[j]))
                cachedAllCardIds.add(batch[j].id);
        }
    }
}
// -- Find cover nodes, skipping subtrees rooted at excluded IDs --
function findCoverNodes(nodes, excludeIds = new Set()) {
    const covers = [];
    for (const node of nodes) {
        if (isExcluded(node, excludeIds))
            continue;
        if (isCoverNode(node))
            covers.push(node);
        if ('findAll' in node) {
            const children = node.findAll(child => isCoverNode(child) && !isExcluded(child, excludeIds));
            covers.push(...children);
        }
    }
    return covers;
}
// -- Find titleTreatment nodes, skipping subtrees rooted at excluded IDs --
function findTitleTreatmentNodes(nodes, excludeIds = new Set()) {
    const titleTreatments = [];
    for (const node of nodes) {
        if (isExcluded(node, excludeIds))
            continue;
        if (isTitleTreatmentNode(node))
            titleTreatments.push(node);
        if ('findAll' in node) {
            const children = node.findAll(child => isTitleTreatmentNode(child) && !isExcluded(child, excludeIds));
            titleTreatments.push(...children);
        }
    }
    return titleTreatments;
}
// -- Helper: check if component name is a chapter card --
function isChapterCardComponent(name) {
    const n = name.toLowerCase();
    // Match: card_chapters, card-chapters, CardChapters, etc.
    // Require both "card" and "chapter" to avoid matching containers like "rowChapters"
    return n.includes('card') && n.includes('chapter');
}
// -- Find chapter card instances (sync - uses only mainComponent.name) --
function findChapterCardInstancesSync(nodes) {
    var _a, _b;
    const chapterCards = [];
    for (const node of nodes) {
        if (node.type === 'INSTANCE') {
            const compName = ((_a = node.mainComponent) === null || _a === void 0 ? void 0 : _a.name) || '';
            if (compName && isChapterCardComponent(compName))
                chapterCards.push(node);
        }
        if ('findAllWithCriteria' in node) {
            const instances = node.findAllWithCriteria({ types: ['INSTANCE'] });
            for (const inst of instances) {
                const compName = ((_b = inst.mainComponent) === null || _b === void 0 ? void 0 : _b.name) || '';
                if (compName && isChapterCardComponent(compName))
                    chapterCards.push(inst);
            }
        }
    }
    return chapterCards;
}
// -- Helper: check if an instance has a "cover" child (confirms it's a real card) --
function hasCoverChild(node) {
    if (isCoverNode(node))
        return true;
    if ('findOne' in node) {
        return !!node.findOne(child => isCoverNode(child));
    }
    return false;
}
// -- Find chapter card instances (async - resolves remote components) --
async function findChapterCardInstancesAsync(nodes) {
    var _a, _b, _c;
    const chapterCards = [];
    const allInstances = [];
    // Collect all instances from the selection tree
    for (const node of nodes) {
        if (node.type === 'INSTANCE' && !allInstances.includes(node)) {
            allInstances.push(node);
        }
        if ('findAllWithCriteria' in node) {
            const instances = node.findAllWithCriteria({ types: ['INSTANCE'] });
            for (const inst of instances) {
                if (!allInstances.includes(inst))
                    allInstances.push(inst);
            }
        }
    }
    // Check each instance (check instance name OR component name OR ComponentSet parent name)
    const addedIds = new Set();
    for (const inst of allInstances) {
        // Skip if already added (prevent duplicates)
        if (addedIds.has(inst.id))
            continue;
        const instanceName = inst.name;
        const syncName = ((_a = inst.mainComponent) === null || _a === void 0 ? void 0 : _a.name) || '';
        let isChapter = false;
        // Check instance name, mainComponent name, or ComponentSet parent name
        if (isChapterCardComponent(instanceName)) {
            isChapter = true;
        }
        else if (syncName && isChapterCardComponent(syncName)) {
            isChapter = true;
        }
        else if (((_c = (_b = inst.mainComponent) === null || _b === void 0 ? void 0 : _b.parent) === null || _c === void 0 ? void 0 : _c.type) === 'COMPONENT_SET') {
            const componentSetName = inst.mainComponent.parent.name;
            if (isChapterCardComponent(componentSetName)) {
                isChapter = true;
            }
        }
        else if (!syncName) {
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
async function setTextContent(parent, name, value) {
    const textNode = findTextNode(parent, name);
    if (textNode) {
        const segments = textNode.getStyledTextSegments(['fontName']);
        if (segments.length > 0) {
            for (const segment of segments) {
                await figma.loadFontAsync(segment.fontName);
            }
        }
        else {
            // Empty text node: no segments, load font from fontName property directly
            const fn = textNode.fontName;
            if (fn !== figma.mixed) {
                await figma.loadFontAsync(fn);
            }
        }
        textNode.characters = value;
    }
}
// -- Helper: check if metadata is for a person --
function isPersonMetadata(m) {
    return 'personName' in m;
}
// -- Fill metadata text nodes and variant properties in the selection --
async function fillMetadata(nodes, metadata) {
    for (const node of nodes) {
        if (isPersonMetadata(metadata)) {
            if (metadata.personName)
                await setTextContent(node, 'name', metadata.personName);
            const rolNode = findTextNode(node, 'rol');
            if (rolNode) {
                if (metadata.isActor) {
                    rolNode.visible = false;
                }
                else {
                    rolNode.visible = true;
                    if (metadata.rol) {
                        for (const segment of rolNode.getStyledTextSegments(['fontName'])) {
                            await figma.loadFontAsync(segment.fontName);
                        }
                        rolNode.characters = metadata.rol;
                    }
                }
            }
        }
        else {
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
                if (field.value)
                    await setTextContent(node, field.name, field.value);
            }
            if (metadata.genres && metadata.genres.length > 0) {
                const genreNames = ['genre', 'genre2', 'genre3'];
                for (let i = 0; i < genreNames.length; i++) {
                    const genreNode = findTextNode(node, genreNames[i]);
                    if (i < metadata.genres.length) {
                        if (genreNode) {
                            await setTextContent(node, genreNames[i], metadata.genres[i]);
                            genreNode.visible = true;
                        }
                    }
                    else {
                        if (genreNode)
                            genreNode.visible = false;
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
                    const visibilityStates = [];
                    let currentNode = ageTag;
                    while (currentNode && 'visible' in currentNode) {
                        const sceneNode = currentNode;
                        visibilityStates.push({ node: sceneNode, wasVisible: sceneNode.visible });
                        if (!sceneNode.visible)
                            sceneNode.visible = true;
                        currentNode = sceneNode.parent;
                        if (currentNode === node)
                            break;
                    }
                    const props = ageTag.componentProperties;
                    let ratingKey = null;
                    for (const key of Object.keys(props)) {
                        if (key === 'rating' || key.startsWith('rating#')) {
                            ratingKey = key;
                            break;
                        }
                    }
                    if (ratingKey) {
                        try {
                            const mainComponent = ageTag.mainComponent;
                            if (mainComponent)
                                ageTag.swapComponent(mainComponent);
                            ageTag.setProperties({ [ratingKey]: metadata.ageRating });
                        }
                        catch (e) {
                            try {
                                ageTag.setProperties({ [ratingKey]: metadata.ageRating });
                            }
                            catch (_) { }
                        }
                    }
                    for (let i = visibilityStates.length - 1; i >= 0; i--) {
                        const { node: stateNode, wasVisible } = visibilityStates[i];
                        if (!wasVisible)
                            stateNode.visible = false;
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
function findMetadataScope(coverNode) {
    let fallback = null;
    let current = coverNode.parent;
    while (current && current.type !== 'PAGE' && current.type !== 'DOCUMENT') {
        const sceneNode = current;
        if ('findAllWithCriteria' in sceneNode) {
            const texts = sceneNode.findAllWithCriteria({ types: ['TEXT'] });
            if (texts.length > 0) {
                if (!fallback)
                    fallback = sceneNode;
                const hasMetadataNode = texts.some(t => METADATA_NODE_NAMES.has(t.name.trim().toLowerCase()));
                if (hasMetadataNode)
                    return sceneNode;
            }
        }
        current = sceneNode.parent;
    }
    return fallback || coverNode.parent || coverNode;
}
// -- Detect component type from a node name --
function typeFromName(name) {
    const n = name.toLowerCase();
    if (n.includes('card') && n.includes('portrait'))
        return 'card-portrait';
    if (n.includes('card') && n.includes('landscape'))
        return 'card-landscape';
    if (n.includes('card') && n.includes('chapter'))
        return 'card-chapters';
    if (n.includes('slideshow'))
        return 'slideshow';
    if (n.includes('vps'))
        return 'vps';
    return 'unknown';
}
// -- Synchronous type detection from selection: walks entire tree, checks node names
// and mainComponent.name (sync). Called at apply time to avoid race conditions. --
function detectTypeSync(nodes) {
    var _a;
    let componentType = 'unknown';
    let found = false;
    for (const node of nodes) {
        const t = typeFromName(node.name);
        if (t !== 'unknown')
            return t;
        if (node.type === 'INSTANCE') {
            const compName = (((_a = node.mainComponent) === null || _a === void 0 ? void 0 : _a.name) || '').toLowerCase();
            const t2 = typeFromName(compName);
            if (t2 !== 'unknown')
                return t2;
        }
        if ('findOne' in node) {
            node.findOne(child => {
                var _a;
                const ct = typeFromName(child.name);
                if (ct !== 'unknown') {
                    componentType = ct;
                    found = true;
                    return true;
                }
                if (child.type === 'INSTANCE') {
                    const compName = (((_a = child.mainComponent) === null || _a === void 0 ? void 0 : _a.name) || '').toLowerCase();
                    const ct2 = typeFromName(compName);
                    if (ct2 !== 'unknown') {
                        componentType = ct2;
                        found = true;
                        return true;
                    }
                }
                return false;
            });
        }
        if (found)
            break;
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
        const allInstances = [];
        for (const node of selection) {
            if (node.type === 'INSTANCE')
                allInstances.push(node);
            if ('findAllWithCriteria' in node) {
                allInstances.push(...node.findAllWithCriteria({ types: ['INSTANCE'] }));
            }
        }
        for (const inst of allInstances) {
            const compName = await getComponentNameAsync(inst);
            if (myVersion !== selectionVersion)
                return; // stale — newer selection started
            const t = typeFromName(compName);
            if (t !== 'unknown') {
                componentType = t;
                break;
            }
        }
    }
    if (myVersion !== selectionVersion)
        return; // stale — discard
    // For VPS: resolve card instance IDs so cover search skips them
    if (componentType === 'vps') {
        await refreshCardCache(selection);
        if (myVersion !== selectionVersion)
            return;
    }
    else {
        cachedAllCardIds = new Set();
    }
    const coverCount = findCoverNodes(selection, cachedAllCardIds).length;
    const titleTreatmentCount = findTitleTreatmentNodes(selection, cachedAllCardIds).length;
    // Always count chapter card instances (even if componentType is unknown/frame)
    // This handles: single card, multiple cards, or frame containing cards
    const chapterInstances = await findChapterCardInstancesAsync(selection);
    if (myVersion !== selectionVersion)
        return; // stale check
    const chapterCardCount = chapterInstances.length;
    figma.ui.postMessage({ type: 'selection-info', count: selection.length, coverCount, titleTreatmentCount, componentType, chapterCardCount });
}
// -- Debounced selection handler: batches rapid selection changes --
let selectionTimer = null;
function debouncedSendSelection() {
    if (selectionTimer)
        clearTimeout(selectionTimer);
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
figma.ui.onmessage = async (msg) => {
    var _a, _b, _c, _d;
    if (msg.type === 'get-selection') {
        sendSelection();
    }
    if (msg.type === 'notify-warning' && msg.message) {
        figma.notify(msg.message, { timeout: 3000 });
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
            const catalogData = msg.data;
            const cacheEntry = {
                data: catalogData,
                timestamp: Date.now()
            };
            await figma.clientStorage.setAsync('otv_catalog_cache', cacheEntry);
            console.log('Catalog cached successfully');
        }
        catch (e) {
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
            }
            else {
                figma.ui.postMessage({
                    type: 'cached-catalog',
                    data: null
                });
            }
        }
        catch (e) {
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
                cover.fills = [{ type: 'IMAGE', imageHash: image.hash, scaleMode: 'FILL' }];
            }
        }
        if (msg.titleTreatmentBytes) {
            const ttBytes = new Uint8Array(msg.titleTreatmentBytes);
            const ttImage = figma.createImage(ttBytes);
            const ttNodes = findTitleTreatmentNodes(selection, cachedAllCardIds);
            for (const ttNode of ttNodes) {
                if ('fills' in ttNode) {
                    ttNode.fills = [{ type: 'IMAGE', imageHash: ttImage.hash, scaleMode: 'FIT' }];
                }
            }
        }
        if (msg.metadata) {
            const scopesDone = new Set();
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
        if (detectTypeSync(selection) === 'vps')
            refreshCardCacheSync(selection);
        const coverNodes = findCoverNodes(selection, cachedAllCardIds);
        if (coverNodes.length === 0) {
            figma.notify('⚠️ No se encontró ningún frame llamado "cover" en la selección.', { error: true });
            figma.ui.postMessage({ type: 'apply-done', success: false });
            return;
        }
        try {
            const image = await figma.createImageAsync(coverUrl);
            for (const cover of coverNodes) {
                if ('fills' in cover) {
                    cover.fills = [{ type: 'IMAGE', imageHash: image.hash, scaleMode: 'FILL' }];
                }
            }
            if (msg.titleTreatmentUrl) {
                try {
                    const ttImage = await figma.createImageAsync(msg.titleTreatmentUrl);
                    const ttNodes = findTitleTreatmentNodes(selection, cachedAllCardIds);
                    for (const ttNode of ttNodes) {
                        if ('fills' in ttNode) {
                            ttNode.fills = [{ type: 'IMAGE', imageHash: ttImage.hash, scaleMode: 'FIT' }];
                        }
                    }
                }
                catch (_) { }
            }
            if (msg.metadata) {
                const scopesDone = new Set();
                for (const cover of coverNodes) {
                    const scope = findMetadataScope(cover);
                    if (!scopesDone.has(scope.id)) {
                        scopesDone.add(scope.id);
                        await fillMetadata([scope], msg.metadata);
                    }
                }
            }
            // Apply provider logo: prefer channelName from HTML paste, fallback to contentId prefix
            const providerLogos = findProviderLogoNodes(selection, cachedAllCardIds);
            if (providerLogos.length > 0) {
                const channelName = (_a = msg.metadata) === null || _a === void 0 ? void 0 : _a.channelName;
                const providerFromId = ((_b = msg.metadata) === null || _b === void 0 ? void 0 : _b.contentId) ? extractProvider(msg.metadata.contentId) : null;
                const providerValue = channelName || providerFromId;
                if (providerValue) {
                    applyProviderLogo(providerLogos, providerValue);
                }
            }
            const ttCount = msg.titleTreatmentUrl ? findTitleTreatmentNodes(selection, cachedAllCardIds).length : 0;
            figma.notify(ttCount > 0
                ? `✅ Cover y título aplicados a ${coverNodes.length} elemento(s).`
                : `✅ Cover aplicada a ${coverNodes.length} elemento(s).`);
            figma.ui.postMessage({ type: 'apply-done', success: true });
        }
        catch (e) {
            figma.notify('⚠️ Error al cargar la imagen.', { error: true });
            figma.ui.postMessage({ type: 'apply-done', success: false, error: e.message });
        }
    }
    // -- Detect if selection is a channel row (skip first 3 covers) --
    function getChannelRowOffset(nodes) {
        for (const node of nodes) {
            const n = node.name.trim().toLowerCase().replace(/[\s_-]+/g, '');
            if (n.includes('row') && n.includes('channel'))
                return 3;
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
                const image = await figma.createImageAsync(coverData.coverUrl);
                if ('fills' in coverNode) {
                    coverNode.fills = [{ type: 'IMAGE', imageHash: image.hash, scaleMode: 'FILL' }];
                }
                successCount++;
            }
            catch (_) { /* imagen no disponible, se salta esta card */ }
            if (coverData.titleTreatmentUrl) {
                try {
                    const ttImage = await figma.createImageAsync(coverData.titleTreatmentUrl);
                    const scope = findMetadataScope(coverNode);
                    const ttNodes = findTitleTreatmentNodes([scope]);
                    if (ttNodes.length > 0 && 'fills' in ttNodes[0]) {
                        ttNodes[0].fills = [{ type: 'IMAGE', imageHash: ttImage.hash, scaleMode: 'FIT' }];
                    }
                }
                catch (_) { }
            }
            if (coverData.metadata) {
                const scope = findMetadataScope(coverNode);
                await fillMetadata([scope], coverData.metadata);
            }
            // Apply provider logo: prefer channelName from HTML paste, fallback to contentId prefix
            const scope2 = findMetadataScope(coverNode);
            const logos = findProviderLogoNodes([scope2], cachedAllCardIds);
            if (logos.length > 0) {
                const channelName = (_c = coverData.metadata) === null || _c === void 0 ? void 0 : _c.channelName;
                const providerFromId = ((_d = coverData.metadata) === null || _d === void 0 ? void 0 : _d.contentId) ? extractProvider(coverData.metadata.contentId) : null;
                const providerValue = channelName || providerFromId;
                if (providerValue) {
                    applyProviderLogo(logos, providerValue);
                }
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
                                }
                                catch (_) { }
                                break;
                            }
                        }
                    }
                }
                // Fallback: find a text node named row_title
                if (!applied) {
                    try {
                        await setTextContent(node, 'row_title', msg.carouselTitle);
                    }
                    catch (_) { }
                }
            }
        }
        const skipped = applyCount - successCount;
        if (skipped > 0) {
            figma.notify(`✅ ${successCount} cover(s) aplicadas. ⚠️ ${skipped} no disponibles.`);
        }
        else {
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
                coverNode.fills = [{ type: 'IMAGE', imageHash: image.hash, scaleMode: 'FILL' }];
            }
            if (coverData.titleTreatmentBytes) {
                const ttBytes = new Uint8Array(coverData.titleTreatmentBytes);
                const ttImage = figma.createImage(ttBytes);
                const scope = findMetadataScope(coverNode);
                const ttNodes = findTitleTreatmentNodes([scope]);
                if (ttNodes.length > 0 && 'fills' in ttNodes[0]) {
                    ttNodes[0].fills = [{ type: 'IMAGE', imageHash: ttImage.hash, scaleMode: 'FIT' }];
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
                let coverNode = null;
                if (isCoverNode(chapterCard)) {
                    coverNode = chapterCard;
                }
                else if ('findOne' in chapterCard) {
                    coverNode = chapterCard.findOne(child => isCoverNode(child));
                }
                if (!coverNode)
                    continue; // Skip if no cover found in this card
                // Apply still image
                if (epData.coverUrl) {
                    const image = await figma.createImageAsync(epData.coverUrl);
                    if ('fills' in coverNode) {
                        coverNode.fills = [
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
                        if (field.value)
                            await setTextContent(chapterCard, field.name, field.value);
                    }
                }
            }
            figma.notify(`✅ ${applyCount} capítulo(s) aplicado(s).`);
            figma.ui.postMessage({ type: 'apply-done', success: true });
        }
        catch (e) {
            figma.notify('⚠️ Error al aplicar capítulos.', { error: true });
            figma.ui.postMessage({ type: 'apply-done', success: false, error: e.message });
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
