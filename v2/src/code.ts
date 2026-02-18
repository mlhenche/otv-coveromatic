// TMDB Covers — Figma Plugin (Sandbox)
// This runs in Figma's sandbox and has access to the Figma API.

figma.showUI(__html__, { width: 380, height: 580, themeColors: true });

// -- Module-level cache: IDs of card instances inside VPS (to exclude from cover search) --
let cachedAllCardIds = new Set<string>();
// -- Version counter: cancels stale async sendSelection calls --
let selectionVersion = 0;

// -- Recursive traversal that includes hidden nodes --
function walkTree(node: SceneNode, callback: (n: SceneNode) => void) {
    callback(node);
    if ('children' in node) {
        for (const child of (node as ChildrenMixin & SceneNode).children) {
            walkTree(child, callback);
        }
    }
}

// -- Like walkTree but skips nodes whose IDs are in the exclude set --
function walkTreeExcludingIds(node: SceneNode, excludeIds: Set<string>, callback: (n: SceneNode) => void) {
    callback(node);
    if ('children' in node) {
        for (const child of (node as ChildrenMixin & SceneNode).children) {
            if (excludeIds.has(child.id)) continue;
            walkTreeExcludingIds(child, excludeIds, callback);
        }
    }
}

// -- Check if a node is a valid "cover" target --
function isCoverNode(node: SceneNode): boolean {
    return node.name.trim().toLowerCase() === 'cover' && 'fills' in node;
}

// -- Check if a node is a valid "titleTreatment" target --
function isTitleTreatmentNode(node: SceneNode): boolean {
    return node.name.trim().toLowerCase() === 'titletreatment' && 'fills' in node;
}

// -- Find a text node by name inside a parent (including hidden) --
function findTextNode(parent: SceneNode, name: string): TextNode | null {
    let result: TextNode | null = null;
    walkTree(parent, (node) => {
        if (!result && node.type === 'TEXT' && node.name.trim().toLowerCase() === name) {
            result = node as TextNode;
        }
    });
    return result;
}

// -- Find all text nodes by name inside a parent (including hidden) --
function findAllTextNodes(parent: SceneNode, name: string): TextNode[] {
    const results: TextNode[] = [];
    walkTree(parent, (node) => {
        if (node.type === 'TEXT' && node.name.trim().toLowerCase() === name) {
            results.push(node as TextNode);
        }
    });
    return results;
}

// -- Find a component instance by name inside a parent (including hidden) --
function findInstanceNode(parent: SceneNode, name: string): InstanceNode | null {
    let result: InstanceNode | null = null;
    walkTree(parent, (node) => {
        if (!result && node.type === 'INSTANCE' && node.name.trim().toLowerCase() === name) {
            result = node as InstanceNode;
        }
    });
    return result;
}

// -- Async: resolve component name for an instance (works for remote library components) --
async function getComponentNameAsync(inst: InstanceNode): Promise<string> {
    if (inst.mainComponent?.name) return inst.mainComponent.name.toLowerCase();
    try {
        const main = await inst.getMainComponentAsync();
        if (main?.name) return main.name.toLowerCase();
    } catch (_) {}
    return '';
}

// -- Returns true if a component name matches a card type (portrait, landscape or reparto) --
function isCardComponentName(name: string): boolean {
    const n = name.toLowerCase();
    return n.includes('card') && (n.includes('portrait') || n.includes('landscape') || n.includes('reparto'));
}

// -- Sync: build card cache from nodes using only mainComponent.name (no await).
// Fast — catches all locally accessible components immediately. --
function refreshCardCacheSync(nodes: readonly SceneNode[]) {
    for (const node of nodes) {
        walkTree(node, (child) => {
            if (child.type !== 'INSTANCE') return;
            const compName = ((child as InstanceNode).mainComponent?.name || '').toLowerCase();
            if (isCardComponentName(compName)) cachedAllCardIds.add(child.id);
        });
    }
}

// -- Async: extend card cache with remote/library components (getMainComponentAsync).
// Called at selection time; sync pre-pass already handled by refreshCardCacheSync. --
async function refreshCardCache(nodes: readonly SceneNode[]) {
    cachedAllCardIds = new Set<string>();
    refreshCardCacheSync(nodes); // immediate sync pass first
    const instances: InstanceNode[] = [];
    for (const node of nodes) {
        walkTree(node, (child) => {
            if (child.type === 'INSTANCE' && !cachedAllCardIds.has(child.id)) {
                instances.push(child as InstanceNode); // only unresolved instances
            }
        });
    }
    for (const inst of instances) {
        const name = await getComponentNameAsync(inst);
        if (isCardComponentName(name)) cachedAllCardIds.add(inst.id);
    }
}

// -- Find cover nodes, skipping subtrees rooted at excluded IDs --
function findCoverNodes(nodes: readonly SceneNode[], excludeIds: Set<string> = new Set()): SceneNode[] {
    const covers: SceneNode[] = [];
    for (const node of nodes) {
        walkTreeExcludingIds(node, excludeIds, (child) => {
            if (isCoverNode(child)) covers.push(child);
        });
    }
    return covers;
}

// -- Find titleTreatment nodes, skipping subtrees rooted at excluded IDs --
function findTitleTreatmentNodes(nodes: readonly SceneNode[], excludeIds: Set<string> = new Set()): SceneNode[] {
    const titleTreatments: SceneNode[] = [];
    for (const node of nodes) {
        walkTreeExcludingIds(node, excludeIds, (child) => {
            if (isTitleTreatmentNode(child)) titleTreatments.push(child);
        });
    }
    return titleTreatments;
}

// -- Helper: set text content on a named text node --
async function setTextContent(parent: SceneNode, name: string, value: string) {
    const textNode = findTextNode(parent, name);
    if (textNode) {
        for (const segment of textNode.getStyledTextSegments(['fontName'])) {
            await figma.loadFontAsync(segment.fontName);
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
                            try { ageTag.setProperties({ [ratingKey]: metadata.ageRating }); } catch (_) {}
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

// -- Find the metadata scope for a cover node --
function findMetadataScope(coverNode: SceneNode): SceneNode {
    let current: BaseNode | null = coverNode.parent;
    while (current && current.type !== 'PAGE' && current.type !== 'DOCUMENT') {
        const sceneNode = current as SceneNode;
        let hasText = false;
        walkTree(sceneNode, (n) => { if (!hasText && n.type === 'TEXT') hasText = true; });
        if (hasText) return sceneNode;
        current = sceneNode.parent;
    }
    return (coverNode.parent as SceneNode) || coverNode;
}

// -- Detect component type from a node name --
function typeFromName(name: string): string {
    const n = name.toLowerCase();
    if (n.includes('card') && n.includes('portrait')) return 'card-portrait';
    if (n.includes('card') && n.includes('landscape')) return 'card-landscape';
    if (n.includes('slideshow') || n.includes('vps')) return 'vps';
    return 'unknown';
}

// -- Synchronous type detection from selection: walks entire tree, checks node names
// and mainComponent.name (sync). Called at apply time to avoid race conditions. --
function detectTypeSync(nodes: readonly SceneNode[]): string {
    let componentType = 'unknown';
    let found = false;
    for (const node of nodes) {
        walkTree(node, (child) => {
            if (found) return;
            const t = typeFromName(child.name);
            if (t !== 'unknown') { componentType = t; found = true; return; }
            if (child.type === 'INSTANCE') {
                const compName = ((child as InstanceNode).mainComponent?.name || '').toLowerCase();
                const t2 = typeFromName(compName);
                if (t2 !== 'unknown') { componentType = t2; found = true; }
            }
        });
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
    let componentType = 'unknown';

    // Pass 1 — full tree walk, sync (node name + mainComponent.name if available)
    let found = false;
    for (const node of selection) {
        walkTree(node, (child) => {
            if (found) return;
            const t = typeFromName(child.name);
            if (t !== 'unknown') { componentType = t; found = true; return; }
            if (child.type === 'INSTANCE') {
                const compName = ((child as InstanceNode).mainComponent?.name || '').toLowerCase();
                const t2 = typeFromName(compName);
                if (t2 !== 'unknown') { componentType = t2; found = true; }
            }
        });
        if (found) break;
    }

    // Pass 2 — full tree walk, async (getMainComponentAsync for remote/library instances)
    if (componentType === 'unknown') {
        const allInstances: InstanceNode[] = [];
        for (const node of selection) {
            walkTree(node, (child) => {
                if (child.type === 'INSTANCE') allInstances.push(child as InstanceNode);
            });
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
    figma.ui.postMessage({ type: 'selection-info', count: selection.length, coverCount, titleTreatmentCount, componentType });
}

// -- Listen to selection changes --
figma.on('selectionchange', () => {
    // Immediately notify UI to reset componentType (prevents stale type being used at apply time)
    figma.ui.postMessage({ type: 'selection-changed' });
    sendSelection();
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
}

interface PersonMetadata {
    personName: string;
    rol: string;
    isActor: boolean;
}

type Metadata = MovieTvMetadata | PersonMetadata;

interface CoverData {
    imageBytes: number[];
    titleTreatmentBytes?: number[];
    metadata: Metadata | null;
}

interface CoverUrlData {
    coverUrl: string;
    titleTreatmentUrl?: string;
    metadata: Metadata | null;
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
}

figma.ui.onmessage = async (msg: PluginMessage) => {
    if (msg.type === 'get-selection') {
        sendSelection();
    }

    if (msg.type === 'save-api-key' && msg.apiKey) {
        await figma.clientStorage.setAsync('tmdb_api_key', msg.apiKey);
    }

    if (msg.type === 'load-api-key') {
        const storedKey = await figma.clientStorage.getAsync('tmdb_api_key');
        figma.ui.postMessage({ type: 'loaded-api-key', apiKey: storedKey || '' });
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

        try {
            const image = await figma.createImageAsync(coverUrl);
            for (const cover of coverNodes) {
                if ('fills' in cover) {
                    (cover as GeometryMixin & SceneNode).fills = [{ type: 'IMAGE', imageHash: image.hash, scaleMode: 'FILL' }];
                }
            }

            if (msg.titleTreatmentUrl) {
                try {
                    const ttImage = await figma.createImageAsync(msg.titleTreatmentUrl);
                    const ttNodes = findTitleTreatmentNodes(selection, cachedAllCardIds);
                    for (const ttNode of ttNodes) {
                        if ('fills' in ttNode) {
                            (ttNode as GeometryMixin & SceneNode).fills = [{ type: 'IMAGE', imageHash: ttImage.hash, scaleMode: 'FIT' }];
                        }
                    }
                } catch (_) {}
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

            const ttCount = msg.titleTreatmentUrl ? findTitleTreatmentNodes(selection, cachedAllCardIds).length : 0;
            figma.notify(ttCount > 0
                ? `✅ Cover y título aplicados a ${coverNodes.length} elemento(s).`
                : `✅ Cover aplicada a ${coverNodes.length} elemento(s).`);
            figma.ui.postMessage({ type: 'apply-done', success: true });
        } catch (e) {
            figma.notify('⚠️ Error al cargar la imagen.', { error: true });
            figma.ui.postMessage({ type: 'apply-done', success: false, error: (e as Error).message });
        }
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
        const applyCount = Math.min(coverNodes.length, coversUrlData.length);

        try {
            for (let i = 0; i < applyCount; i++) {
                const coverNode = coverNodes[i];
                const coverData = coversUrlData[i];

                const image = await figma.createImageAsync(coverData.coverUrl);
                if ('fills' in coverNode) {
                    (coverNode as GeometryMixin & SceneNode).fills = [{ type: 'IMAGE', imageHash: image.hash, scaleMode: 'FILL' }];
                }

                if (coverData.titleTreatmentUrl) {
                    try {
                        const ttImage = await figma.createImageAsync(coverData.titleTreatmentUrl);
                        const scope = findMetadataScope(coverNode);
                        const ttNodes = findTitleTreatmentNodes([scope]);
                        if (ttNodes.length > 0 && 'fills' in ttNodes[0]) {
                            (ttNodes[0] as GeometryMixin & SceneNode).fills = [{ type: 'IMAGE', imageHash: ttImage.hash, scaleMode: 'FIT' }];
                        }
                    } catch (_) {}
                }

                if (coverData.metadata) {
                    const scope = findMetadataScope(coverNode);
                    await fillMetadata([scope], coverData.metadata);
                }
            }

            figma.notify(`✅ ${applyCount} cover(s) aplicadas con contenido aleatorio.`);
            figma.ui.postMessage({ type: 'apply-done', success: true });
        } catch (e) {
            figma.notify('⚠️ Error al cargar imágenes.', { error: true });
            figma.ui.postMessage({ type: 'apply-done', success: false, error: (e as Error).message });
        }
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
