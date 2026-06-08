// Detección de tipo de componente Figma y búsqueda de chapter cards.

import { isCoverNode } from './figma-nodes';

// Mutable singleton — exportado como objeto para que los módulos importadores
// siempre lean el valor actual (un `let` reasignado rompería la referencia).
const _cache = { ids: new Set<string>() };

export const cachedAllCardIds: Set<string> = _cache.ids;

export function resetCardCache() {
    _cache.ids.clear();
}

export async function getComponentNameAsync(inst: InstanceNode): Promise<string> {
    if (inst.mainComponent?.name) return inst.mainComponent.name.toLowerCase();
    try {
        const main = await inst.getMainComponentAsync();
        if (main?.name) return main.name.toLowerCase();
    } catch (_) { }
    return '';
}

export function isCardComponentName(name: string): boolean {
    const n = name.toLowerCase();
    return n.includes('card') && (n.includes('portrait') || n.includes('landscape') || n.includes('reparto') || n.includes('chapter'));
}

export function isChapterCardComponent(name: string): boolean {
    const n = name.toLowerCase();
    return n.includes('card') && n.includes('chapter');
}

export function hasCoverChild(node: SceneNode): boolean {
    if (isCoverNode(node)) return true;
    if ('findOne' in node) {
        return !!node.findOne(child => isCoverNode(child as SceneNode));
    }
    return false;
}

export function typeFromName(name: string): string {
    const n = name.toLowerCase();
    if (n.includes('card') && n.includes('portrait')) return 'card-portrait';
    if (n.includes('card') && n.includes('landscape')) return 'card-landscape';
    if (n.includes('card') && n.includes('chapter')) return 'card-chapters';
    if (n.includes('slideshow')) return 'slideshow';
    if (n.includes('vps')) return 'vps';
    return 'unknown';
}

export function detectTypeSync(nodes: readonly SceneNode[]): string {
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

const CARD_CACHE_BATCH_SIZE = 10;

export function refreshCardCacheSync(nodes: readonly SceneNode[]) {
    for (const node of nodes) {
        if (node.type === 'INSTANCE') {
            const compName = (node.mainComponent?.name || '').toLowerCase();
            if (isCardComponentName(compName)) _cache.ids.add(node.id);
        }
        if ('findAllWithCriteria' in node) {
            const instances = node.findAllWithCriteria({ types: ['INSTANCE'] });
            for (const child of instances) {
                const compName = (child.mainComponent?.name || '').toLowerCase();
                if (isCardComponentName(compName)) _cache.ids.add(child.id);
            }
        }
    }
}

export async function refreshCardCache(nodes: readonly SceneNode[]) {
    _cache.ids.clear();
    refreshCardCacheSync(nodes);
    const instances: InstanceNode[] = [];
    for (const node of nodes) {
        if (node.type === 'INSTANCE' && !_cache.ids.has(node.id)) {
            instances.push(node as InstanceNode);
        }
        if ('findAllWithCriteria' in node) {
            const children = node.findAllWithCriteria({ types: ['INSTANCE'] });
            for (const child of children) {
                if (!_cache.ids.has(child.id)) {
                    instances.push(child);
                }
            }
        }
    }
    for (let i = 0; i < instances.length; i += CARD_CACHE_BATCH_SIZE) {
        const batch = instances.slice(i, i + CARD_CACHE_BATCH_SIZE);
        const names = await Promise.all(batch.map(inst => getComponentNameAsync(inst)));
        for (let j = 0; j < batch.length; j++) {
            if (isCardComponentName(names[j])) _cache.ids.add(batch[j].id);
        }
    }
}

export function findChapterCardInstancesSync(nodes: readonly SceneNode[]): InstanceNode[] {
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

export async function findChapterCardInstancesAsync(nodes: readonly SceneNode[]): Promise<InstanceNode[]> {
    const chapterCards: InstanceNode[] = [];
    const allInstances: InstanceNode[] = [];

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

    const addedIds = new Set<string>();

    for (const inst of allInstances) {
        if (addedIds.has(inst.id)) continue;

        const instanceName = inst.name;
        const syncName = inst.mainComponent?.name || '';
        let isChapter = false;

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

        if (isChapter && hasCoverChild(inst)) {
            chapterCards.push(inst);
            addedIds.add(inst.id);
        }
    }

    return chapterCards;
}
