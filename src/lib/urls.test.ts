import { describe, it, expect } from 'vitest';
import { buildOTVUrls, upgradeImageUrl, extractChannelName, OTV_BASE } from './urls';

describe('buildOTVUrls', () => {
    it('card-portrait → VERTICAL, sin title treatment', () => {
        const { coverUrl, titleTreatmentUrl } = buildOTVUrls('MFO_123', 'card-portrait');
        expect(coverUrl).toBe(`${OTV_BASE}/VERTICAL/MFO_123_VERTICAL.jpg?width=3840&height=2160`);
        expect(titleTreatmentUrl).toBeNull();
    });

    it('card-landscape → COVER_ART, sin title treatment', () => {
        const { coverUrl, titleTreatmentUrl } = buildOTVUrls('SKYS_9', 'card-landscape');
        expect(coverUrl).toBe(`${OTV_BASE}/COVER_ART/SKYS_9_COVER_ART.jpg?width=3840&height=2160`);
        expect(titleTreatmentUrl).toBeNull();
    });

    it('vps y slideshow → BACKGROUND + title treatment', () => {
        for (const type of ['vps', 'slideshow']) {
            const { coverUrl, titleTreatmentUrl } = buildOTVUrls('DSN_1', type);
            expect(coverUrl).toContain('/BACKGROUND/DSN_1_BACKGROUND.jpg');
            expect(titleTreatmentUrl).toContain('/TITLE_TREATMENT/DSN_1_title_treatment.png');
        }
    });

    it('tipo desconocido → fallback a VERTICAL', () => {
        const { coverUrl } = buildOTVUrls('X', 'algo-raro');
        expect(coverUrl).toContain('/VERTICAL/X_VERTICAL.jpg');
    });
});

describe('upgradeImageUrl', () => {
    it('sube width y height a 3840x2160', () => {
        const out = upgradeImageUrl('https://x/img.jpg?width=176&height=122');
        expect(out).toBe('https://x/img.jpg?width=3840&height=2160');
    });

    it('deja la URL igual si no hay width/height', () => {
        expect(upgradeImageUrl('https://x/img.jpg')).toBe('https://x/img.jpg');
    });
});

describe('extractChannelName', () => {
    it('patrón attachments_new/{NAME}_{NNNxNNN}.ext', () => {
        expect(extractChannelName('/attachments_new/LA_SEXTA_176x122.png')).toBe('LA_SEXTA');
    });

    it('patrón attachments/{name}.ext', () => {
        expect(extractChannelName('/attachments/discovery_logo.png')).toBe('discovery_logo');
    });

    it('ignora query string en el patrón 2', () => {
        expect(extractChannelName('/path/telecinco.png?v=2')).toBe('telecinco');
    });

    it('devuelve null si no hay coincidencia', () => {
        expect(extractChannelName('sin-barra-ni-extension')).toBeNull();
    });
});
