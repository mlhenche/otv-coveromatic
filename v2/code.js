"use strict";
// TMDB Covers — Figma Plugin (Sandbox)
// This runs in Figma's sandbox and has access to the Figma API.
figma.showUI(__html__, { width: 380, height: 580, themeColors: true });
// -- Send current selection info to UI --
function sendSelection() {
    const selection = figma.currentPage.selection;
    const coverCount = findCoverNodes(selection).length;
    const titleTreatmentCount = findTitleTreatmentNodes(selection).length;
    // Detect component type from names
    const names = selection.map(n => n.name.toLowerCase());
    let componentType = 'unknown';
    for (const name of names) {
        if (name.includes('card') && name.includes('portrait')) {
            componentType = 'card-portrait';
            break;
        }
        if (name.includes('card') && name.includes('landscape')) {
            componentType = 'card-landscape';
            break;
        }
        if (name.includes('slideshow') || name.includes('vps')) {
            componentType = 'vps';
            break;
        }
    }
    figma.ui.postMessage({
        type: 'selection-info',
        count: selection.length,
        coverCount: coverCount,
        titleTreatmentCount: titleTreatmentCount,
        componentType: componentType
    });
}
// -- Recursive traversal that includes hidden nodes --
function walkTree(node, callback) {
    callback(node);
    if ('children' in node) {
        for (const child of node.children) {
            walkTree(child, callback);
        }
    }
}
// -- Check if a node is a valid "cover" target --
function isCoverNode(node) {
    return node.name.trim().toLowerCase() === 'cover' && 'fills' in node;
}
// -- Check if a node is a valid "titleTreatment" target --
function isTitleTreatmentNode(node) {
    return node.name.trim().toLowerCase() === 'titletreatment' && 'fills' in node;
}
// -- Find a text node by name inside a parent (including hidden) --
function findTextNode(parent, name) {
    let result = null;
    walkTree(parent, (node) => {
        if (!result && node.type === 'TEXT' && node.name.trim().toLowerCase() === name) {
            result = node;
        }
    });
    return result;
}
// -- Find all text nodes by name inside a parent (including hidden) --
function findAllTextNodes(parent, name) {
    const results = [];
    walkTree(parent, (node) => {
        if (node.type === 'TEXT' && node.name.trim().toLowerCase() === name) {
            results.push(node);
        }
    });
    return results;
}
// -- Find a component instance by name inside a parent (including hidden) --
function findInstanceNode(parent, name) {
    let result = null;
    walkTree(parent, (node) => {
        if (!result && node.type === 'INSTANCE' && node.name.trim().toLowerCase() === name) {
            result = node;
        }
    });
    return result;
}
// -- Helper: set text content on a named text node --
async function setTextContent(parent, name, value) {
    const textNode = findTextNode(parent, name);
    if (textNode) {
        for (const segment of textNode.getStyledTextSegments(['fontName'])) {
            await figma.loadFontAsync(segment.fontName);
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
            // Person: fill "name" text
            if (metadata.personName) {
                await setTextContent(node, 'name', metadata.personName);
            }
            // Person: fill or hide "rol" text
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
            // Movie/TV: fill text fields
            const fields = [
                { name: 'title', value: metadata.title },
                { name: 'rating', value: metadata.rating },
                { name: 'year', value: metadata.year },
                { name: 'duration', value: metadata.duration },
                { name: 'sinopsis', value: metadata.sinopsis },
            ];
            for (const field of fields) {
                if (!field.value)
                    continue;
                await setTextContent(node, field.name, field.value);
            }
            // Fill genres (VPS only: genre, genre2, genre3)
            if (metadata.genres && metadata.genres.length > 0) {
                const genreNames = ['genre', 'genre2', 'genre3'];
                // Fill each genre slot
                for (let i = 0; i < genreNames.length; i++) {
                    const genreNode = findTextNode(node, genreNames[i]);
                    if (i < metadata.genres.length) {
                        // Fill and show genre
                        if (genreNode) {
                            await setTextContent(node, genreNames[i], metadata.genres[i]);
                            genreNode.visible = true;
                        }
                    }
                    else {
                        // Hide unused genre slots
                        if (genreNode)
                            genreNode.visible = false;
                    }
                }
                // Handle all separators (they all have the same name "separator")
                const allSeparators = findAllTextNodes(node, 'separator');
                const numGenres = metadata.genres.length;
                // Show separators between genres, hide the rest
                // Example: 2 genres = show 1 separator (between genre1 and genre2)
                // Example: 1 genre = hide all separators
                for (let i = 0; i < allSeparators.length; i++) {
                    if (i < numGenres - 1) {
                        allSeparators[i].visible = true;
                    }
                    else {
                        allSeparators[i].visible = false;
                    }
                }
            }
            // Set ageTag variant "rating" property
            if (metadata.ageRating) {
                const ageTag = findInstanceNode(node, 'agetag');
                if (ageTag) {
                    // Store original visibility state of ageTag and all its parents
                    const visibilityStates = [];
                    // Walk up the tree and make all parents visible
                    let currentNode = ageTag;
                    while (currentNode && 'visible' in currentNode) {
                        const sceneNode = currentNode;
                        visibilityStates.push({ node: sceneNode, wasVisible: sceneNode.visible });
                        if (!sceneNode.visible) {
                            sceneNode.visible = true;
                        }
                        currentNode = sceneNode.parent;
                        // Stop at the selection root
                        if (currentNode === node)
                            break;
                    }
                    // Find and set the rating property
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
                            // Force the property change by swapping to main component first
                            const mainComponent = ageTag.mainComponent;
                            if (mainComponent) {
                                // Swap to main component to reset overrides
                                ageTag.swapComponent(mainComponent);
                            }
                            // Now set the new property value
                            ageTag.setProperties({ [ratingKey]: metadata.ageRating });
                        }
                        catch (e) {
                            // Fallback: try direct set
                            try {
                                ageTag.setProperties({ [ratingKey]: metadata.ageRating });
                            }
                            catch (_) {
                                // Property change failed
                            }
                        }
                    }
                    // Restore original visibility states (in reverse order)
                    for (let i = visibilityStates.length - 1; i >= 0; i--) {
                        const { node: stateNode, wasVisible } = visibilityStates[i];
                        if (!wasVisible) {
                            stateNode.visible = false;
                        }
                    }
                }
            }
        }
    }
}
// -- Find the metadata scope for a cover node --
// Walks up from the cover to find the nearest ancestor that contains text nodes.
// This ensures each cover's metadata is applied to its own component, not just the first.
function findMetadataScope(coverNode) {
    let current = coverNode.parent;
    while (current && current.type !== 'PAGE' && current.type !== 'DOCUMENT') {
        const sceneNode = current;
        let hasText = false;
        walkTree(sceneNode, (n) => {
            if (!hasText && n.type === 'TEXT')
                hasText = true;
        });
        if (hasText)
            return sceneNode;
        current = sceneNode.parent;
    }
    return coverNode.parent || coverNode;
}
// -- Find all "cover" nodes in the selection (including hidden) --
function findCoverNodes(nodes) {
    const covers = [];
    for (const node of nodes) {
        walkTree(node, (child) => {
            if (isCoverNode(child)) {
                covers.push(child);
            }
        });
    }
    return covers;
}
// -- Find all "titleTreatment" nodes in the selection (including hidden) --
function findTitleTreatmentNodes(nodes) {
    const titleTreatments = [];
    for (const node of nodes) {
        walkTree(node, (child) => {
            if (isTitleTreatmentNode(child)) {
                titleTreatments.push(child);
            }
        });
    }
    return titleTreatments;
}
// -- Listen to selection changes --
figma.on('selectionchange', () => {
    sendSelection();
});
figma.ui.onmessage = async (msg) => {
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
        const coverNodes = findCoverNodes(figma.currentPage.selection);
        if (coverNodes.length === 0) {
            figma.notify('⚠️ No se encontró ningún frame llamado "cover" en la selección.', { error: true });
            return;
        }
        // Apply cover image
        for (const cover of coverNodes) {
            if ('fills' in cover) {
                cover.fills = [
                    {
                        type: 'IMAGE',
                        imageHash: image.hash,
                        scaleMode: 'FILL'
                    }
                ];
            }
        }
        // Apply title treatment if provided
        if (msg.titleTreatmentBytes) {
            const ttBytes = new Uint8Array(msg.titleTreatmentBytes);
            const ttImage = figma.createImage(ttBytes);
            const ttNodes = findTitleTreatmentNodes(figma.currentPage.selection);
            for (const ttNode of ttNodes) {
                if ('fills' in ttNode) {
                    ttNode.fills = [
                        {
                            type: 'IMAGE',
                            imageHash: ttImage.hash,
                            scaleMode: 'FIT'
                        }
                    ];
                }
            }
        }
        // Fill metadata for each cover's component scope
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
        const ttCount = msg.titleTreatmentBytes ? findTitleTreatmentNodes(figma.currentPage.selection).length : 0;
        const message = ttCount > 0
            ? `✅ Cover y título aplicados a ${coverNodes.length} elemento(s).`
            : `✅ Cover aplicada a ${coverNodes.length} elemento(s).`;
        figma.notify(message);
    }
    // -- Apply cover via URL (OTV CDN - uses figma.createImageAsync to bypass CORS) --
    if (msg.type === 'apply-cover-url' && msg.coverUrl) {
        const coverNodes = findCoverNodes(figma.currentPage.selection);
        if (coverNodes.length === 0) {
            figma.notify('⚠️ No se encontró ningún frame llamado "cover" en la selección.', { error: true });
            figma.ui.postMessage({ type: 'apply-done', success: false });
            return;
        }
        try {
            const image = await figma.createImageAsync(msg.coverUrl);
            for (const cover of coverNodes) {
                if ('fills' in cover) {
                    cover.fills = [
                        { type: 'IMAGE', imageHash: image.hash, scaleMode: 'FILL' }
                    ];
                }
            }
            // Apply title treatment if URL provided
            if (msg.titleTreatmentUrl) {
                try {
                    const ttImage = await figma.createImageAsync(msg.titleTreatmentUrl);
                    const ttNodes = findTitleTreatmentNodes(figma.currentPage.selection);
                    for (const ttNode of ttNodes) {
                        if ('fills' in ttNode) {
                            ttNode.fills = [
                                { type: 'IMAGE', imageHash: ttImage.hash, scaleMode: 'FIT' }
                            ];
                        }
                    }
                }
                catch (e) {
                    // Title treatment load failed, continue without it
                }
            }
            // Fill metadata
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
            const ttCount = msg.titleTreatmentUrl ? findTitleTreatmentNodes(figma.currentPage.selection).length : 0;
            const message = ttCount > 0
                ? `✅ Cover y título aplicados a ${coverNodes.length} elemento(s).`
                : `✅ Cover aplicada a ${coverNodes.length} elemento(s).`;
            figma.notify(message);
            figma.ui.postMessage({ type: 'apply-done', success: true });
        }
        catch (e) {
            figma.notify('⚠️ Error al cargar la imagen.', { error: true });
            figma.ui.postMessage({ type: 'apply-done', success: false, error: e.message });
        }
    }
    // -- Apply multiple covers via URL (OTV CDN) --
    if (msg.type === 'apply-multiple-covers-url' && msg.coversUrlData) {
        const coverNodes = findCoverNodes(figma.currentPage.selection);
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
                    coverNode.fills = [
                        { type: 'IMAGE', imageHash: image.hash, scaleMode: 'FILL' }
                    ];
                }
                // Title treatment
                if (coverData.titleTreatmentUrl) {
                    try {
                        const ttImage = await figma.createImageAsync(coverData.titleTreatmentUrl);
                        const scope = findMetadataScope(coverNode);
                        const ttNodes = findTitleTreatmentNodes([scope]);
                        if (ttNodes.length > 0) {
                            const ttNode = ttNodes[0];
                            if ('fills' in ttNode) {
                                ttNode.fills = [
                                    { type: 'IMAGE', imageHash: ttImage.hash, scaleMode: 'FIT' }
                                ];
                            }
                        }
                    }
                    catch (_) { /* skip failed title treatment */ }
                }
                // Metadata
                if (coverData.metadata) {
                    const scope = findMetadataScope(coverNode);
                    await fillMetadata([scope], coverData.metadata);
                }
            }
            figma.notify(`✅ ${applyCount} cover(s) aplicadas con contenido aleatorio.`);
            figma.ui.postMessage({ type: 'apply-done', success: true });
        }
        catch (e) {
            figma.notify('⚠️ Error al cargar imágenes.', { error: true });
            figma.ui.postMessage({ type: 'apply-done', success: false, error: e.message });
        }
    }
    if (msg.type === 'apply-multiple-covers' && msg.coversData) {
        const coverNodes = findCoverNodes(figma.currentPage.selection);
        if (coverNodes.length === 0) {
            figma.notify('⚠️ No se encontró ningún frame llamado "cover" en la selección.', { error: true });
            return;
        }
        const coversData = msg.coversData;
        const applyCount = Math.min(coverNodes.length, coversData.length);
        for (let i = 0; i < applyCount; i++) {
            const coverNode = coverNodes[i];
            const coverData = coversData[i];
            // Apply image
            const bytes = new Uint8Array(coverData.imageBytes);
            const image = figma.createImage(bytes);
            if ('fills' in coverNode) {
                coverNode.fills = [
                    {
                        type: 'IMAGE',
                        imageHash: image.hash,
                        scaleMode: 'FILL'
                    }
                ];
            }
            // Apply title treatment if provided
            if (coverData.titleTreatmentBytes) {
                const ttBytes = new Uint8Array(coverData.titleTreatmentBytes);
                const ttImage = figma.createImage(ttBytes);
                const scope = findMetadataScope(coverNode);
                const ttNodes = findTitleTreatmentNodes([scope]);
                if (ttNodes.length > 0) {
                    const ttNode = ttNodes[0];
                    if ('fills' in ttNode) {
                        ttNode.fills = [
                            {
                                type: 'IMAGE',
                                imageHash: ttImage.hash,
                                scaleMode: 'FIT'
                            }
                        ];
                    }
                }
            }
            // Fill metadata scoped to this cover's component
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
