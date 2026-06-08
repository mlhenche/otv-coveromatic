// Lógica de detección y aplicación de logos de proveedor en componentes Figma.

import { findBestVariantMatch } from './lib/channels';
import { isExcluded } from './figma-nodes';

export function applyProviderLogo(logos: InstanceNode[], providerValue: string): number {
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
            } catch (_) { }
        }
    }
    return applied;
}

export function isProviderLogoComponent(node: SceneNode): boolean {
    if (node.type !== 'INSTANCE') return false;
    const name = node.name.trim().toLowerCase();
    if (name === 'providerlogosquare' || name === 'providerlogorectangle') return true;
    try {
        const props = (node as InstanceNode).componentProperties;
        return Object.keys(props).some(k => { const kl = k.toLowerCase(); return kl === 'provider' || kl.startsWith('provider#'); });
    } catch (_) {
        return false;
    }
}

export function findNearestInstanceAncestor(node: SceneNode): InstanceNode | null {
    let current: BaseNode | null = node.parent;
    while (current && current.type !== 'PAGE' && current.type !== 'DOCUMENT') {
        if (current.type === 'INSTANCE') return current as InstanceNode;
        current = current.parent;
    }
    return null;
}

export function findProviderLogoAncestor(node: SceneNode): InstanceNode | null {
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

export function findProviderLogoNodes(nodes: readonly SceneNode[], excludeIds: Set<string> = new Set()): InstanceNode[] {
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
