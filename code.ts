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
function walkTree(node: SceneNode, callback: (n: SceneNode) => void) {
    callback(node);
    if ('children' in node) {
        for (const child of (node as ChildrenMixin & SceneNode).children) {
            walkTree(child, callback);
        }
    }
}

// -- Check if a node is a valid "cover" target --
function isCoverNode(node: SceneNode): boolean {
    return node.name.trim().toLowerCase() === 'cover' && 'fills' in node;
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
            // Person: fill "name" text
            if (metadata.personName) {
                await setTextContent(node, 'name', metadata.personName);
            }

            // Person: fill or hide "rol" text
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
            // Movie/TV: fill text fields
            const fields: { name: string; value: string }[] = [
                { name: 'title', value: metadata.title },
                { name: 'rating', value: metadata.rating },
                { name: 'year', value: metadata.year },
                { name: 'duration', value: metadata.duration },
                { name: 'sinopsis', value: metadata.sinopsis },
            ];

            for (const field of fields) {
                if (!field.value) continue;
                await setTextContent(node, field.name, field.value);
            }

            // Set ageTag variant "rating" property
            if (metadata.ageRating) {
                const ageTag = findInstanceNode(node, 'agetag');
                if (ageTag) {
                    // Store original visibility state of ageTag and all its parents
                    const visibilityStates: Array<{ node: SceneNode; wasVisible: boolean }> = [];

                    // Walk up the tree and make all parents visible
                    let currentNode: BaseNode | null = ageTag;
                    while (currentNode && 'visible' in currentNode) {
                        const sceneNode = currentNode as SceneNode;
                        visibilityStates.push({ node: sceneNode, wasVisible: sceneNode.visible });
                        if (!sceneNode.visible) {
                            sceneNode.visible = true;
                        }
                        currentNode = sceneNode.parent;
                        // Stop at the selection root
                        if (currentNode === node) break;
                    }

                    // Find and set the rating property
                    const props = ageTag.componentProperties;
                    let ratingKey: string | null = null;

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
                        } catch (e) {
                            // Fallback: try direct set
                            try {
                                ageTag.setProperties({ [ratingKey]: metadata.ageRating });
                            } catch (_) {
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
function findMetadataScope(coverNode: SceneNode): SceneNode {
    let current: BaseNode | null = coverNode.parent;
    while (current && current.type !== 'PAGE' && current.type !== 'DOCUMENT') {
        const sceneNode = current as SceneNode;
        let hasText = false;
        walkTree(sceneNode, (n) => {
            if (!hasText && n.type === 'TEXT') hasText = true;
        });
        if (hasText) return sceneNode;
        current = sceneNode.parent;
    }
    return (coverNode.parent as SceneNode) || coverNode;
}

// -- Find all "cover" nodes in the selection (including hidden) --
function findCoverNodes(nodes: readonly SceneNode[]): SceneNode[] {
    const covers: SceneNode[] = [];
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

// -- Handle messages from UI --
interface MovieTvMetadata {
    title: string;
    rating: string;
    year: string;
    duration: string;
    ageRating: string;
    sinopsis: string;
}

interface PersonMetadata {
    personName: string;
    rol: string;
    isActor: boolean;
}

type Metadata = MovieTvMetadata | PersonMetadata;

interface CoverData {
    imageBytes: number[];
    metadata: Metadata | null;
}

interface PluginMessage {
    type: string;
    imageBytes?: number[];
    apiKey?: string;
    metadata?: Metadata | null;
    coversData?: CoverData[];
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
        const coverNodes = findCoverNodes(figma.currentPage.selection);

        if (coverNodes.length === 0) {
            figma.notify('⚠️ No se encontró ningún frame llamado "cover" en la selección.', { error: true });
            return;
        }

        for (const cover of coverNodes) {
            if ('fills' in cover) {
                (cover as GeometryMixin & SceneNode).fills = [
                    {
                        type: 'IMAGE',
                        imageHash: image.hash,
                        scaleMode: 'FILL'
                    }
                ];
            }
        }

        // Fill metadata for each cover's component scope
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
                (coverNode as GeometryMixin & SceneNode).fills = [
                    {
                        type: 'IMAGE',
                        imageHash: image.hash,
                        scaleMode: 'FILL'
                    }
                ];
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
