// CoverOmatic — Figma Plugin (Sandbox)
// Corre en el sandbox de Figma. esbuild bundlea todos los imports en plugin/code.js.

import { extractProvider } from './lib/channels';
import {
    findTextNode, findAllTextNodes, findInstanceNode,
    findCoverNodes, findTitleTreatmentNodes, findMetadataScope,
} from './figma-nodes';
import {
    applyProviderLogo,
    findNearestInstanceAncestor, findProviderLogoAncestor, findProviderLogoNodes,
} from './provider-logo';
import {
    cachedAllCardIds, resetCardCache,
    detectTypeSync, refreshCardCacheSync, refreshCardCache,
    findChapterCardInstancesAsync,
} from './card-detection';

figma.showUI(__html__, { width: 380, height: 580, themeColors: true });

let selectionVersion = 0;

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

function isPersonMetadata(m: Metadata): m is PersonMetadata {
    return 'personName' in m;
}

async function setTextContent(parent: SceneNode, name: string, value: string) {
    const textNode = findTextNode(parent, name);
    if (textNode) {
        const segments = textNode.getStyledTextSegments(['fontName']);
        if (segments.length > 0) {
            for (const segment of segments) {
                await figma.loadFontAsync(segment.fontName);
            }
        } else {
            const fn = textNode.fontName;
            if (fn !== figma.mixed) {
                await figma.loadFontAsync(fn as FontName);
            }
        }
        textNode.characters = value;
    }
}

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

async function sendSelection() {
    const myVersion = ++selectionVersion;
    const selection = figma.currentPage.selection;

    let componentType = detectTypeSync(selection);

    if (componentType === 'unknown') {
        const allInstances: InstanceNode[] = [];
        for (const node of selection) {
            if (node.type === 'INSTANCE') allInstances.push(node as InstanceNode);
            if ('findAllWithCriteria' in node) {
                allInstances.push(...node.findAllWithCriteria({ types: ['INSTANCE'] }));
            }
        }
        for (const inst of allInstances) {
            if (inst.mainComponent?.name) {
                const compName = inst.mainComponent.name.toLowerCase();
                const t = detectTypeSync([inst]);
                if (t !== 'unknown') { componentType = t; break; }
                void compName;
            }
            if (myVersion !== selectionVersion) return;
        }
    }

    if (myVersion !== selectionVersion) return;

    if (componentType === 'vps') {
        await refreshCardCache(selection);
        if (myVersion !== selectionVersion) return;
    } else {
        resetCardCache();
    }

    const coverCount = findCoverNodes(selection, cachedAllCardIds).length;
    const titleTreatmentCount = findTitleTreatmentNodes(selection, cachedAllCardIds).length;

    const chapterInstances = await findChapterCardInstancesAsync(selection);
    if (myVersion !== selectionVersion) return;
    const chapterCardCount = chapterInstances.length;

    figma.ui.postMessage({ type: 'selection-info', count: selection.length, coverCount, titleTreatmentCount, componentType, chapterCardCount });
}

let selectionTimer: ReturnType<typeof setTimeout> | null = null;
function debouncedSendSelection() {
    if (selectionTimer) clearTimeout(selectionTimer);
    selectionTimer = setTimeout(() => {
        selectionTimer = null;
        sendSelection();
    }, 120);
}

figma.on('selectionchange', () => {
    figma.ui.postMessage({ type: 'selection-changed' });
    debouncedSendSelection();
});

function getChannelRowOffset(nodes: readonly SceneNode[]): number {
    for (const node of nodes) {
        const n = node.name.trim().toLowerCase().replace(/[\s_-]+/g, '');
        if (n.includes('row') && n.includes('channel')) return 3;
    }
    return 0;
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

    if (msg.type === 'cache-catalog') {
        try {
            const catalogData = (msg as any).data;
            await figma.clientStorage.setAsync('otv_catalog_cache', { data: catalogData, timestamp: Date.now() });
        } catch (e) {
            console.error('Error caching catalog:', e);
        }
    }

    if (msg.type === 'get-cached-catalog') {
        try {
            const cacheEntry = await figma.clientStorage.getAsync('otv_catalog_cache');
            figma.ui.postMessage({
                type: 'cached-catalog',
                data: cacheEntry?.data ?? null,
                timestamp: cacheEntry?.timestamp,
            });
        } catch (e) {
            console.error('Error loading cached catalog:', e);
            figma.ui.postMessage({ type: 'cached-catalog', data: null });
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

    if (msg.type === 'apply-cover-url' && msg.coverUrl) {
        const selection = figma.currentPage.selection;
        const coverUrl = msg.coverUrl;

        if (detectTypeSync(selection) === 'vps') refreshCardCacheSync(selection);

        const coverNodes = findCoverNodes(selection, cachedAllCardIds);

        if (coverNodes.length === 0) {
            figma.notify('⚠️ No se encontró ningún frame llamado "cover" en la selección.', { error: true });
            figma.ui.postMessage({ type: 'apply-done', success: false });
            return;
        }

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

        try {
            let providerLogos = findProviderLogoNodes(selection, cachedAllCardIds);
            if (providerLogos.length === 0) {
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

            const scope2 = findMetadataScope(coverNode);
            let logos = findProviderLogoNodes([scope2], cachedAllCardIds);
            console.log(`[provider S1] cover="${coverNode.name}" scope="${scope2.name}" logos=${logos.length}`);
            if (logos.length === 0) {
                const instAncestor = findNearestInstanceAncestor(coverNode);
                console.log(`[provider S2] ancestor="${instAncestor?.name ?? 'null'}"`);
                if (instAncestor) logos = findProviderLogoNodes([instAncestor], cachedAllCardIds);
                console.log(`[provider S2] logos=${logos.length}`);
            }
            if (logos.length === 0) {
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

        if (msg.carouselTitle) {
            for (const node of selection) {
                let applied = false;
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

    if (msg.type === 'apply-episode-covers' && msg.episodesData) {
        const selection = figma.currentPage.selection;
        const episodesData = msg.episodesData;

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
                if ('fills' in chapterCard && chapterCard.name.trim().toLowerCase() === 'cover') {
                    coverNode = chapterCard;
                } else if ('findOne' in chapterCard) {
                    coverNode = chapterCard.findOne(child => child.name.trim().toLowerCase() === 'cover' && 'fills' in child) as SceneNode | null;
                }

                if (!coverNode) continue;

                if (epData.coverUrl) {
                    const image = await figma.createImageAsync(epData.coverUrl);
                    if ('fills' in coverNode) {
                        (coverNode as GeometryMixin & SceneNode).fills = [
                            { type: 'IMAGE', imageHash: image.hash, scaleMode: 'FILL' }
                        ];
                    }
                }

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

sendSelection();
(async () => {
    const storedKey = await figma.clientStorage.getAsync('tmdb_api_key');
    if (storedKey) {
        figma.ui.postMessage({ type: 'loaded-api-key', apiKey: storedKey });
    }
})();
