// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import {
    extractBgUrl,
    detectImageFormat,
    extractChannelIconUrl,
    textContent,
    parseCardEmission,
    parseCardChannel,
    parseCardSlideshow,
    parseCardGeneric,
    parseCardCorner,
    parseHtml,
    buildCardMetadata,
    ParsedCard,
} from './html-parser';

// ── Helpers ────────────────────────────────────────────

function el(html: string): Element {
    const div = document.createElement('div');
    div.innerHTML = html;
    return div.firstElementChild!;
}

// ── extractBgUrl ───────────────────────────────────────

describe('extractBgUrl', () => {
    it('extracts quoted single-quote URL', () => {
        const e = el(`<div style="background-image: url('/img/cover.jpg')"></div>`);
        expect(extractBgUrl(e)).toBe('/img/cover.jpg');
    });

    it('extracts quoted double-quote URL', () => {
        const e = el(`<div style='background-image: url("/img/cover.jpg")'></div>`);
        expect(extractBgUrl(e)).toBe('/img/cover.jpg');
    });

    it('extracts unquoted URL', () => {
        const e = el(`<div style="background-image: url(https://example.com/img.jpg)"></div>`);
        expect(extractBgUrl(e)).toBe('https://example.com/img.jpg');
    });

    it('decodes &amp; in URL', () => {
        const e = el(`<div style="background-image: url('https://ex.com/img?a=1&amp;b=2')"></div>`);
        expect(extractBgUrl(e)).toBe('https://ex.com/img?a=1&b=2');
    });

    it('handles filenames with parentheses (quoted)', () => {
        const e = el(`<div style="background-image: url('https://ex.com/COVER_ART(1).jpg')"></div>`);
        expect(extractBgUrl(e)).toBe('https://ex.com/COVER_ART(1).jpg');
    });

    it('returns null when no background-image', () => {
        const e = el(`<div style="color: red"></div>`);
        expect(extractBgUrl(e)).toBeNull();
    });
});

// ── detectImageFormat ──────────────────────────────────

describe('detectImageFormat', () => {
    it('returns portrait when class contains portrait', () => {
        const e = el(`<div class="card__image portrait"></div>`);
        expect(detectImageFormat(e)).toBe('portrait');
    });

    it('returns landscape by default', () => {
        const e = el(`<div class="card__image landscape"></div>`);
        expect(detectImageFormat(e)).toBe('landscape');
    });

    it('returns landscape for null', () => {
        expect(detectImageFormat(null)).toBe('landscape');
    });
});

// ── extractChannelIconUrl ──────────────────────────────

describe('extractChannelIconUrl', () => {
    it('returns null for null element', () => {
        expect(extractChannelIconUrl(null)).toBeNull();
    });

    it('prefers background-image over img src', () => {
        const e = el(`<div style="background-image: url('https://ex.com/channel.png')"><img src="https://ex.com/fallback.png"></div>`);
        expect(extractChannelIconUrl(e)).toBe('https://ex.com/channel.png');
    });

    it('falls back to img src when no background-image', () => {
        const e = el(`<div><img src="https://ex.com/icon.png"></div>`);
        expect(extractChannelIconUrl(e)).toBe('https://ex.com/icon.png');
    });
});

// ── textContent ────────────────────────────────────────

describe('textContent', () => {
    it('returns trimmed text', () => {
        const e = el(`<div><span class="card__name">  Título   </span></div>`);
        expect(textContent(e, '.card__name')).toBe('Título');
    });

    it('collapses whitespace', () => {
        const e = el(`<div><span class="card__name">Título  con   espacios</span></div>`);
        expect(textContent(e, '.card__name')).toBe('Título con espacios');
    });

    it('returns null when selector not found', () => {
        const e = el(`<div></div>`);
        expect(textContent(e, '.missing')).toBeNull();
    });

    it('returns null for null element', () => {
        expect(textContent(null, '.anything')).toBeNull();
    });
});

// ── parseCardSlideshow ─────────────────────────────────

describe('parseCardSlideshow', () => {
    it('parses a basic slideshow card', () => {
        const card = el(`
            <app-card-slideshow>
                <div class="card__image" style="background-image: url('https://ex.com/bg.jpg?width=100&height=200')"></div>
                <div class="card__title-image" style="background-image: url('https://ex.com/tt.png')"></div>
                <span class="card__name">Mi Serie</span>
                <p class="card__description">Una descripción</p>
            </app-card-slideshow>
        `);
        const result = parseCardSlideshow(card);

        expect(result.type).toBe('slideshow');
        expect(result.title).toBe('Mi Serie');
        expect(result.description).toBe('Una descripción');
        expect(result.backgroundUrl).toContain('width=3840');
        expect(result.titleTreatmentUrl).toBe('https://ex.com/tt.png');
        expect(result.channelIconUrl).toBeNull();
    });

    it('returns Sin título when card__name is absent', () => {
        const card = el(`<app-card-slideshow></app-card-slideshow>`);
        expect(parseCardSlideshow(card).title).toBe('Sin título');
    });
});

// ── parseCardGeneric ───────────────────────────────────

describe('parseCardGeneric', () => {
    it('extracts year and age rating from metadata spans', () => {
        const card = el(`
            <app-card-generic>
                <div class="card__image" style="background-image: url('https://ex.com/img.jpg?width=1&height=1')"></div>
                <span class="card__name">Película</span>
                <div class="card__metadata">
                    <span>2023</span>
                    <span class="card__metadata__parental-rating">12</span>
                </div>
            </app-card-generic>
        `);
        const result = parseCardGeneric(card);

        expect(result.year).toBe('2023');
        expect(result.ageRating).toBe('12');
        expect(result.backgroundUrl).toContain('width=3840');
    });

    it('ignores non-year text spans', () => {
        const card = el(`
            <app-card-generic>
                <div class="card__metadata">
                    <span>HD</span>
                    <span>Drama</span>
                </div>
            </app-card-generic>
        `);
        const result = parseCardGeneric(card);
        expect(result.year).toBeNull();
        expect(result.ageRating).toBeNull();
    });
});

// ── parseCardEmission ──────────────────────────────────

describe('parseCardEmission', () => {
    it('parses emission card with channel icon', () => {
        const card = el(`
            <app-card-emission>
                <div class="card__image landscape" style="background-image: url('https://ex.com/epg.jpg?width=1&height=1')"></div>
                <div class="card__channel-icon" style="background-image: url('https://cdn.ex.com/attachments_new/LA_SEXTA_176x122.png')"></div>
                <span class="card__name">Programa</span>
                <span class="emission-info__time">20:00</span>
                <span class="emission-info__start-date">En directo</span>
                <span class="emission-info__duration">1h</span>
            </app-card-emission>
        `);
        const result = parseCardEmission(card);

        expect(result.type).toBe('emission');
        expect(result.title).toBe('Programa');
        expect(result.schedule).toBe('20:00');
        expect(result.live).toBe('En directo');
        expect(result.duration).toBe('1h');
        expect(result.channelName).toBe('LA_SEXTA');
        expect(result.backgroundUrl).toContain('width=3840');
        expect(result.imageFormat).toBe('landscape');
    });

    it('rejects non-http background URLs', () => {
        const card = el(`
            <app-card-emission>
                <div class="card__image" style="background-image: url('/relative/path.jpg')"></div>
                <span class="card__name">Programa</span>
            </app-card-emission>
        `);
        expect(parseCardEmission(card).backgroundUrl).toBeNull();
    });
});

// ── parseCardChannel ───────────────────────────────────

describe('parseCardChannel', () => {
    it('prefers landscape/portrait image over square', () => {
        const card = el(`
            <app-card-channel>
                <div class="card__image square" style="background-image: url('https://ex.com/square.jpg?width=1&height=1')"></div>
                <div class="card__image landscape" style="background-image: url('https://ex.com/landscape.jpg?width=1&height=1')"></div>
                <span class="card__name">Programa</span>
            </app-card-channel>
        `);
        const result = parseCardChannel(card);
        expect(result.backgroundUrl).toContain('landscape');
    });
});

// ── parseCardCorner ────────────────────────────────────

describe('parseCardCorner', () => {
    it('parses corner card', () => {
        const card = el(`
            <app-card-corner>
                <div class="card__background-image" style="background-image: url('https://ex.com/bg.jpg?width=1&height=1')"></div>
                <div class="card__logo-image" style="background-image: url('https://ex.com/logo.png')"></div>
            </app-card-corner>
        `);
        const result = parseCardCorner(card);

        expect(result.type).toBe('corner');
        expect(result.title).toBe('Corner');
        expect(result.backgroundUrl).toContain('width=3840');
        expect(result.titleTreatmentUrl).toBe('https://ex.com/logo.png');
    });
});

// ── parseHtml ──────────────────────────────────────────

describe('parseHtml', () => {
    it('returns empty array for html with no carousels', () => {
        expect(parseHtml('<div>sin carruseles</div>')).toEqual([]);
    });

    it('parses a slideshow carousel', () => {
        const html = `
            <app-carousel-slideshow>
                <div class="carousel-title">Estrenos</div>
                <app-card-slideshow>
                    <div class="card__image" style="background-image: url('https://ex.com/a.jpg?width=1&height=1')"></div>
                    <span class="card__name">Serie A</span>
                </app-card-slideshow>
                <app-card-slideshow>
                    <div class="card__image" style="background-image: url('https://ex.com/b.jpg?width=1&height=1')"></div>
                    <span class="card__name">Serie B</span>
                </app-card-slideshow>
            </app-carousel-slideshow>
        `;
        const result = parseHtml(html);

        expect(result).toHaveLength(1);
        expect(result[0].tagName).toBe('app-carousel-slideshow');
        expect(result[0].title).toBe('Estrenos');
        expect(result[0].label).toBe('Estrenos');
        expect(result[0].cards).toHaveLength(2);
        expect(result[0].cards[0].title).toBe('Serie A');
    });

    it('uses tagName as label fallback when no carousel-title', () => {
        const html = `
            <app-carousel-generic>
                <app-card-generic>
                    <div class="card__image" style="background-image: url('https://ex.com/img.jpg?width=1&height=1')"></div>
                    <span class="card__name">Film</span>
                </app-card-generic>
            </app-carousel-generic>
        `;
        const result = parseHtml(html);
        expect(result[0].label).toContain('app-carousel-generic');
        expect(result[0].title).toBeNull();
    });

    it('skips carousels with no valid cards', () => {
        const html = `<app-carousel-slideshow></app-carousel-slideshow>`;
        expect(parseHtml(html)).toHaveLength(0);
    });

    it('parses multiple carousel types', () => {
        const html = `
            <app-carousel-slideshow>
                <app-card-slideshow>
                    <div class="card__image" style="background-image: url('https://ex.com/s.jpg?width=1&height=1')"></div>
                    <span class="card__name">Slide</span>
                </app-card-slideshow>
            </app-carousel-slideshow>
            <app-carousel-generic>
                <app-card-generic>
                    <div class="card__image" style="background-image: url('https://ex.com/g.jpg?width=1&height=1')"></div>
                    <span class="card__name">Film</span>
                </app-card-generic>
            </app-carousel-generic>
        `;
        const result = parseHtml(html);
        expect(result).toHaveLength(2);
        expect(result[0].cards[0].type).toBe('slideshow');
        expect(result[1].cards[0].type).toBe('generic');
    });
});

// ── buildCardMetadata ──────────────────────────────────

describe('buildCardMetadata', () => {
    it('always includes title', () => {
        const card: ParsedCard = {
            type: 'generic', title: 'Test', backgroundUrl: null,
            titleTreatmentUrl: null, channelIconUrl: null, channelName: null,
            schedule: null, live: null, duration: null, description: null,
            year: null, ageRating: null, imageFormat: 'landscape',
        };
        expect(buildCardMetadata(card)).toEqual({ title: 'Test' });
    });

    it('includes optional fields when present', () => {
        const card: ParsedCard = {
            type: 'emission', title: 'Show', backgroundUrl: null,
            titleTreatmentUrl: null, channelIconUrl: null, channelName: 'CUATRO',
            schedule: '21:00', live: 'En directo', duration: '2h',
            description: 'Descripción', year: '2023', ageRating: '16', imageFormat: 'landscape',
        };
        const meta = buildCardMetadata(card);
        expect(meta.schedule).toBe('21:00');
        expect(meta.live).toBe('En directo');
        expect(meta.duration).toBe('2h');
        expect(meta.sinopsis).toBe('Descripción');
        expect(meta.year).toBe('2023');
        expect(meta.ageRating).toBe('16');
        expect(meta.channelName).toBe('CUATRO');
    });
});
