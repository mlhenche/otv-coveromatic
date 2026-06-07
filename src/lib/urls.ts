// Construcción de URLs de imagen de OTV y utilidades de URL — funciones puras.

export const OTV_BASE = 'https://pc.orangetv.orange.es/pc/api/rtv/v1/images/vod';

export function buildOTVUrls(
    contentId: string,
    typeToUse: string,
): { coverUrl: string; titleTreatmentUrl: string | null } {
    switch (typeToUse) {
        case 'card-portrait':
            return {
                coverUrl: `${OTV_BASE}/VERTICAL/${contentId}_VERTICAL.jpg?width=3840&height=2160`,
                titleTreatmentUrl: null,
            };
        case 'card-landscape':
            return {
                coverUrl: `${OTV_BASE}/COVER_ART/${contentId}_COVER_ART.jpg?width=3840&height=2160`,
                titleTreatmentUrl: null,
            };
        case 'vps':
        case 'slideshow':
            return {
                coverUrl: `${OTV_BASE}/BACKGROUND/${contentId}_BACKGROUND.jpg?width=3840&height=2160`,
                titleTreatmentUrl: `${OTV_BASE}/TITLE_TREATMENT/${contentId}_title_treatment.png?width=1280&height=720`,
            };
        default:
            return {
                coverUrl: `${OTV_BASE}/VERTICAL/${contentId}_VERTICAL.jpg?width=3840&height=2160`,
                titleTreatmentUrl: null,
            };
    }
}

// Sube la resolución pedida en la URL a 3840x2160.
export function upgradeImageUrl(url: string): string {
    return url.replace(/([?&]width=)\d+/, '$13840').replace(/([?&]height=)\d+/, '$12160');
}

// Extrae el nombre del canal desde la URL del icono.
export function extractChannelName(url: string): string | null {
    // Pattern 1: /attachments_new/{CHANNEL_NAME}_{NNNxNNN}.ext (e.g. LA_SEXTA_176x122.png)
    const match = url.match(/\/([^/]+?)_\d+x\d+\.\w+/);
    if (match) return match[1];
    // Pattern 2: /attachments/{name}.ext (e.g. discovery_logo.png) — extract filename without ext
    const match2 = url.match(/\/([^/?]+)\.\w+(?:\?|$)/);
    return match2 ? match2[1] : null;
}
