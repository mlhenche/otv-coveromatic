"use strict";
// TMDB Covers — Figma Plugin (Sandbox)
// This runs in Figma's sandbox and has access to the Figma API.
figma.showUI(__html__, { width: 380, height: 580, themeColors: true });
// -- Send current selection info to UI --
function sendSelection() {
    const selection = figma.currentPage.selection;
    const coverCount = findCoverNodes(selection).length;
    figma.ui.postMessage({
        type: 'selection-info',
        count: selection.length,
        coverCount: coverCount
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
            ];
            for (const field of fields) {
                if (!field.value)
                    continue;
                await setTextContent(node, field.name, field.value);
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
                    try {
                        ageTag.setProperties({ rating: metadata.ageRating });
                    }
                    catch (e) {
                        try {
                            const props = ageTag.componentProperties;
                            for (const key of Object.keys(props)) {
                                if (key === 'rating' || key.startsWith('rating#')) {
                                    ageTag.setProperties({ [key]: metadata.ageRating });
                                    break;
                                }
                            }
                        }
                        catch (_) { /* variant value not available */ }
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
        // Fill metadata text nodes if provided
        if (msg.metadata) {
            await fillMetadata(figma.currentPage.selection, msg.metadata);
        }
        figma.notify(`✅ Cover aplicada a ${coverNodes.length} elemento(s).`);
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
            // Fill metadata for this specific component
            if (coverData.metadata) {
                const parentNode = figma.currentPage.selection[i];
                if (parentNode) {
                    await fillMetadata([parentNode], coverData.metadata);
                }
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
