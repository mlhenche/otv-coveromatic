// Parser puro de HTML de Orange TV — sin estado React ni Logger.
// Funciones testeables con jsdom.

import { upgradeImageUrl, extractChannelName } from './urls';

export interface ParsedCard {
    type: 'emission' | 'channel' | 'generic' | 'slideshow' | 'corner';
    title: string;
    backgroundUrl: string | null;
    titleTreatmentUrl: string | null;
    channelIconUrl: string | null;
    channelName: string | null;
    schedule: string | null;
    live: string | null;
    duration: string | null;
    description: string | null;
    year: string | null;
    ageRating: string | null;
    imageFormat: 'portrait' | 'landscape';
}

export interface ParsedCarousel {
    tagName: string;
    label: string;
    title: string | null;
    cards: ParsedCard[];
}

export function extractBgUrl(el: Element): string | null {
    const style = el.getAttribute('style') || '';
    // Quoted URL first — handles filenames with parentheses like COVER_ART(1).jpg
    const quotedMatch = style.match(/background-image:\s*url\(["']([^"']+)["']\)/);
    if (quotedMatch) return quotedMatch[1].replace(/&amp;/g, '&');
    // Fallback: unquoted URL (exclude quotes to avoid capturing url("") as '""')
    const unquotedMatch = style.match(/background-image:\s*url\(([^)"']+)\)/);
    if (unquotedMatch) return unquotedMatch[1].replace(/&amp;/g, '&');
    return null;
}

// Read format from CSS class on the card__image element (Orange TV HTML uses .portrait / .landscape)
export function detectImageFormat(imageEl: Element | null): 'portrait' | 'landscape' {
    if (!imageEl) return 'landscape';
    if (imageEl.classList.contains('portrait')) return 'portrait';
    return 'landscape';
}

export function extractChannelIconUrl(el: Element | null): string | null {
    if (!el) return null;
    const fromBg = extractBgUrl(el);
    if (fromBg) return fromBg;
    const img = el.querySelector('img');
    return img?.getAttribute('src') || null;
}

export function textContent(el: Element | null, selector: string): string | null {
    if (!el) return null;
    const node = el.querySelector(selector);
    return node?.textContent?.trim().replace(/\s+/g, ' ') || null;
}

export function parseCardEmission(card: Element): ParsedCard {
    const imageEl = card.querySelector('.card__image');
    const rawBg = imageEl ? extractBgUrl(imageEl) : null;
    const channelEl = card.querySelector('.card__channel-icon');
    const channelUrl = extractChannelIconUrl(channelEl);

    const validBg = rawBg?.startsWith('http') ? upgradeImageUrl(rawBg) : null;
    return {
        type: 'emission',
        title: textContent(card, '.card__name') || 'Sin título',
        backgroundUrl: validBg,
        titleTreatmentUrl: null,
        channelIconUrl: channelUrl,
        channelName: channelUrl ? extractChannelName(channelUrl) : null,
        schedule: textContent(card, '.emission-info__time'),
        live: textContent(card, '.emission-info__start-date'),
        duration: textContent(card, '.emission-info__duration'),
        description: null,
        year: null,
        ageRating: null,
        imageFormat: detectImageFormat(imageEl),
    };
}

export function parseCardChannel(card: Element): ParsedCard {
    // app-card-channel has two .card__image elements: one hidden square (channel icon wrapper)
    // and one with landscape/portrait class that holds the actual program image.
    const imageEl = card.querySelector<Element>('.card__image.landscape, .card__image.portrait')
        ?? card.querySelector('.card__image:not(.square)');
    const rawBg = imageEl ? extractBgUrl(imageEl) : null;
    const channelEl = card.querySelector('.card__channel-icon');
    const channelUrl = extractChannelIconUrl(channelEl);

    const validBg = rawBg?.startsWith('http') ? upgradeImageUrl(rawBg) : null;
    return {
        type: 'channel',
        title: textContent(card, '.card__name') || 'Sin título',
        backgroundUrl: validBg,
        titleTreatmentUrl: null,
        channelIconUrl: channelUrl,
        channelName: channelUrl ? extractChannelName(channelUrl) : null,
        schedule: textContent(card, '.emission-info__time'),
        live: null,
        duration: null,
        description: null,
        year: null,
        ageRating: null,
        imageFormat: detectImageFormat(imageEl),
    };
}

export function parseCardSlideshow(card: Element): ParsedCard {
    const imageEl = card.querySelector('.card__image');
    const ttEl = card.querySelector('.card__title-image');

    const bgUrl = imageEl ? extractBgUrl(imageEl) : null;
    return {
        type: 'slideshow',
        title: textContent(card, '.card__name') || 'Sin título',
        backgroundUrl: bgUrl ? upgradeImageUrl(bgUrl) : null,
        titleTreatmentUrl: ttEl ? extractBgUrl(ttEl) : null,
        channelIconUrl: null,
        channelName: null,
        schedule: null,
        live: null,
        duration: null,
        description: textContent(card, '.card__description'),
        year: null,
        ageRating: null,
        imageFormat: detectImageFormat(imageEl),
    };
}

export function parseCardGeneric(card: Element): ParsedCard {
    const imageEl = card.querySelector('.card__image');
    const channelEl = card.querySelector('.card__channel-icon');
    const channelUrl = channelEl ? extractBgUrl(channelEl) : null;

    const metaSpans = card.querySelectorAll('.card__metadata > span');
    let year: string | null = null;
    let ageRating: string | null = null;
    metaSpans.forEach(span => {
        const text = span.textContent?.trim() || '';
        if (/^\d{4}$/.test(text)) year = text;
        if (span.classList.contains('card__metadata__parental-rating')) ageRating = text;
    });

    const bgUrl = imageEl ? extractBgUrl(imageEl) : null;
    return {
        type: 'generic',
        title: textContent(card, '.card__name') || 'Sin título',
        backgroundUrl: bgUrl ? upgradeImageUrl(bgUrl) : null,
        titleTreatmentUrl: null,
        channelIconUrl: channelUrl,
        channelName: channelUrl ? extractChannelName(channelUrl) : null,
        schedule: textContent(card, '.emission-info__time'),
        live: null,
        duration: null,
        description: null,
        year,
        ageRating,
        imageFormat: detectImageFormat(imageEl),
    };
}

export function parseCardCorner(card: Element): ParsedCard {
    const bgEl = card.querySelector('.card__background-image');
    const logoEl = card.querySelector('.card__logo-image');

    const bgUrl = bgEl ? extractBgUrl(bgEl) : null;
    return {
        type: 'corner',
        title: 'Corner',
        backgroundUrl: bgUrl ? upgradeImageUrl(bgUrl) : null,
        titleTreatmentUrl: logoEl ? extractBgUrl(logoEl) : null,
        channelIconUrl: null,
        channelName: null,
        schedule: null,
        live: null,
        duration: null,
        description: null,
        year: null,
        ageRating: null,
        imageFormat: detectImageFormat(bgEl),
    };
}

const CARD_PARSERS: Record<string, { selector: string; parse: (el: Element) => ParsedCard }> = {
    slideshow: { selector: 'app-card-slideshow', parse: parseCardSlideshow },
    emission:  { selector: 'app-card-emission',  parse: parseCardEmission },
    channel:   { selector: 'app-card-channel',   parse: parseCardChannel },
    corner:    { selector: 'app-card-corner',     parse: parseCardCorner },
    generic:   { selector: 'app-card-generic',    parse: parseCardGeneric },
};

const CAROUSEL_SELECTOR = Object.keys(CARD_PARSERS).map(t => `app-carousel-${t}`).join(', ');

export function parseHtml(html: string): ParsedCarousel[] {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    return parseDocument(doc);
}

export function parseDocument(doc: Document): ParsedCarousel[] {
    const carousels: ParsedCarousel[] = [];

    doc.querySelectorAll(CAROUSEL_SELECTOR).forEach(el => {
        const tag = el.tagName.toLowerCase();
        const carouselType = tag.replace('app-carousel-', '');
        const titleEl = el.querySelector('.carousel-title');
        const title = titleEl?.textContent?.trim().replace(/\s+/g, ' ') || null;

        const cards: ParsedCard[] = [];
        const p = CARD_PARSERS[carouselType];
        if (p) {
            el.querySelectorAll(p.selector).forEach(card => cards.push(p.parse(card)));
        }

        if (cards.length > 0) {
            const label = title || `${tag} (${cards.length})`;
            carousels.push({ tagName: tag, label, title, cards });
        }
    });

    return carousels;
}

export function buildCardMetadata(card: ParsedCard): Record<string, string> {
    const m: Record<string, string> = { title: card.title };
    if (card.schedule) m.schedule = card.schedule;
    if (card.live) m.live = card.live;
    if (card.duration) m.duration = card.duration;
    if (card.description) m.sinopsis = card.description;
    if (card.year) m.year = card.year;
    if (card.ageRating) m.ageRating = card.ageRating;
    if (card.channelName) m.channelName = card.channelName;
    return m;
}
