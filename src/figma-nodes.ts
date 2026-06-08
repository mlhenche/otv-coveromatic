// Helpers puros de DOM Figma: búsqueda de nodos, fills, scope de metadata.
// Sin referencias a figma.ui ni figma.clientStorage.

export function isExcluded(node: BaseNode, excludeIds: Set<string>): boolean {
    if (excludeIds.size === 0) return false;
    let current: BaseNode | null = node;
    while (current && current.type !== 'PAGE' && current.type !== 'DOCUMENT') {
        if (excludeIds.has(current.id)) return true;
        current = current.parent;
    }
    return false;
}

export function isCoverNode(node: SceneNode): boolean {
    return node.name.trim().toLowerCase() === 'cover' && 'fills' in node;
}

export function isTitleTreatmentNode(node: SceneNode): boolean {
    const name = node.name.trim().toLowerCase();
    return (name === 'titletreatment' || name === 'title treatment' || name === 'title_treatment') && 'fills' in node;
}

export function findTextNode(parent: SceneNode, name: string): TextNode | null {
    if (parent.type === 'TEXT' && parent.name.trim().toLowerCase() === name) return parent as TextNode;
    if ('findAllWithCriteria' in parent) {
        const texts = parent.findAllWithCriteria({ types: ['TEXT'] });
        return texts.find(n => n.name.trim().toLowerCase() === name) || null;
    }
    return null;
}

export function findAllTextNodes(parent: SceneNode, name: string): TextNode[] {
    const results: TextNode[] = [];
    if (parent.type === 'TEXT' && parent.name.trim().toLowerCase() === name) results.push(parent as TextNode);
    if ('findAllWithCriteria' in parent) {
        const texts = parent.findAllWithCriteria({ types: ['TEXT'] });
        results.push(...texts.filter(n => n.name.trim().toLowerCase() === name));
    }
    return results;
}

export function findInstanceNode(parent: SceneNode, name: string): InstanceNode | null {
    if (parent.type === 'INSTANCE' && parent.name.trim().toLowerCase() === name) return parent as InstanceNode;
    if ('findAllWithCriteria' in parent) {
        const instances = parent.findAllWithCriteria({ types: ['INSTANCE'] });
        return instances.find(n => n.name.trim().toLowerCase() === name) || null;
    }
    return null;
}

export function findCoverNodes(nodes: readonly SceneNode[], excludeIds: Set<string> = new Set()): SceneNode[] {
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

export function findTitleTreatmentNodes(nodes: readonly SceneNode[], excludeIds: Set<string> = new Set()): SceneNode[] {
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

export const METADATA_NODE_NAMES = new Set(['title', 'rating', 'year', 'duration', 'sinopsis', 'genre', 'name', 'rol', 'chapter']);

export function findMetadataScope(coverNode: SceneNode): SceneNode {
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
