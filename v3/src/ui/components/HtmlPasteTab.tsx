import React, { useState } from 'react';
import { Logger } from './LogStore';

// ── Types ──────────────────────────────────────────────

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

export interface HtmlPasteState {
    rawHtml: string;
    carousels: ParsedCarousel[] | null;
    selectedIdx: number | null;
}

interface HtmlPasteTabProps {
    selectionInfo: any;
    setApplying: (val: boolean) => void;
    htmlState: HtmlPasteState;
    onHtmlStateChange: (state: HtmlPasteState) => void;
}

// ── HTML Parser ────────────────────────────────────────

function extractBgUrl(el: Element): string | null {
    const style = el.getAttribute('style') || '';
    // Quoted URL first — handles filenames with parentheses like COVER_ART(1).jpg
    const quotedMatch = style.match(/background-image:\s*url\(["']([^"']+)["']\)/);
    if (quotedMatch) return quotedMatch[1].replace(/&amp;/g, '&');
    // Fallback: unquoted URL
    const unquotedMatch = style.match(/background-image:\s*url\(([^)]+)\)/);
    if (unquotedMatch) return unquotedMatch[1].replace(/&amp;/g, '&');
    return null;
}

// Read format from CSS class on the card__image element (Orange TV HTML uses .portrait / .landscape)
function detectImageFormat(imageEl: Element | null): 'portrait' | 'landscape' {
    if (!imageEl) return 'landscape';
    if (imageEl.classList.contains('portrait')) return 'portrait';
    return 'landscape';
}

function extractChannelName(url: string): string | null {
    // Extract from pattern: /attachments_new/{CHANNEL_NAME}_{NNNxNNN}.ext
    const match = url.match(/\/([^/]+?)_\d+x\d+\.\w+/);
    return match ? match[1] : null;
}

function textContent(el: Element | null, selector: string): string | null {
    if (!el) return null;
    const node = el.querySelector(selector);
    return node?.textContent?.trim().replace(/\s+/g, ' ') || null;
}

function parseCardEmission(card: Element): ParsedCard {
    const imageEl = card.querySelector('.card__image');
    const rawBg = imageEl ? extractBgUrl(imageEl) : null;
    const channelEl = card.querySelector('.card__channel-icon');
    const channelUrl = channelEl ? extractBgUrl(channelEl) : null;

    const validBg = rawBg?.startsWith('http') ? rawBg : null;
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

function parseCardChannel(card: Element): ParsedCard {
    const imageEl = card.querySelector('.card__image');
    const rawBg = imageEl ? extractBgUrl(imageEl) : null;
    const channelEl = card.querySelector('.card__channel-icon');
    const channelUrl = channelEl ? extractBgUrl(channelEl) : null;

    const validBg = rawBg?.startsWith('http') ? rawBg : null;

    const finalBg = validBg || channelUrl;
    return {
        type: 'channel',
        title: textContent(card, '.card__name') || 'Sin título',
        backgroundUrl: finalBg,
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

function parseCardSlideshow(card: Element): ParsedCard {
    const imageEl = card.querySelector('.card__image');
    const ttEl = card.querySelector('.card__title-image');

    const bgUrl = imageEl ? extractBgUrl(imageEl) : null;
    return {
        type: 'slideshow',
        title: textContent(card, '.card__name') || 'Sin título',
        backgroundUrl: bgUrl,
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

function parseCardGeneric(card: Element): ParsedCard {
    const imageEl = card.querySelector('.card__image');
    const channelEl = card.querySelector('.card__channel-icon');
    const channelUrl = channelEl ? extractBgUrl(channelEl) : null;

    // Extract year and age rating from metadata spans
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
        backgroundUrl: bgUrl,
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

function parseCardCorner(card: Element): ParsedCard {
    const bgEl = card.querySelector('.card__background-image');
    const logoEl = card.querySelector('.card__logo-image');

    const bgUrl = bgEl ? extractBgUrl(bgEl) : null;
    return {
        type: 'corner',
        title: 'Corner',
        backgroundUrl: bgUrl,
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

function parseHtml(html: string): ParsedCarousel[] {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    const carousels: ParsedCarousel[] = [];

    // Find all app-carousel-* elements
    const allElements = doc.querySelectorAll('*');
    allElements.forEach(el => {
        const tag = el.tagName.toLowerCase();
        if (!tag.startsWith('app-carousel-')) return;

        const carouselType = tag.replace('app-carousel-', '');
        const titleEl = el.querySelector('.carousel-title');
        const title = titleEl?.textContent?.trim().replace(/\s+/g, ' ') || null;

        const cards: ParsedCard[] = [];

        if (carouselType === 'slideshow') {
            el.querySelectorAll('app-card-slideshow').forEach(card => {
                cards.push(parseCardSlideshow(card));
            });
        } else if (carouselType === 'emission') {
            el.querySelectorAll('app-card-emission').forEach(card => {
                cards.push(parseCardEmission(card));
            });
        } else if (carouselType === 'channel') {
            el.querySelectorAll('app-card-channel').forEach(card => {
                cards.push(parseCardChannel(card));
            });
        } else if (carouselType === 'corner') {
            el.querySelectorAll('app-card-corner').forEach(card => {
                cards.push(parseCardCorner(card));
            });
        } else if (carouselType === 'generic') {
            el.querySelectorAll('app-card-generic').forEach(card => {
                cards.push(parseCardGeneric(card));
            });
        }

        if (cards.length > 0) {
            const label = title || `${tag} (${cards.length})`;
            const pCount = cards.filter(c => c.imageFormat === 'portrait').length;
            Logger.add('Parse', `${label} → portrait=${pCount} landscape=${cards.length - pCount}`);
            carousels.push({ tagName: tag, label, title, cards });
        }
    });

    return carousels;
}

// ── Carousel type labels ───────────────────────────────

const CAROUSEL_ICONS: Record<string, string> = {
    'slideshow': 'S',
    'emission': 'E',
    'channel': 'C',
    'corner': 'R',
    'generic': 'G',
};

function carouselTypeTag(tagName: string): string {
    const type = tagName.replace('app-carousel-', '');
    return CAROUSEL_ICONS[type] || '?';
}

// ── Component ──────────────────────────────────────────

export default function HtmlPasteTab({ selectionInfo, setApplying, htmlState, onHtmlStateChange }: HtmlPasteTabProps) {
    const { rawHtml, carousels, selectedIdx } = htmlState;
    const [parsing, setParsing] = useState(false);

    const update = (patch: Partial<HtmlPasteState>) => onHtmlStateChange({ ...htmlState, ...patch });

    const handleParse = () => {
        if (!rawHtml.trim()) return;
        setParsing(true);
        // Use setTimeout to let the UI update with the loading state
        setTimeout(() => {
            const result = parseHtml(rawHtml);
            update({ carousels: result, selectedIdx: null });
            setParsing(false);
            Logger.add('HTML Parse', `${result.length} carruseles, ${result.reduce((s, c) => s + c.cards.length, 0)} cards`);
        }, 50);
    };

    const handleClear = () => {
        update({ rawHtml: '', carousels: null, selectedIdx: null });
    };

    const handleBack = () => {
        update({ selectedIdx: null });
    };

    const selectedCarousel = selectedIdx !== null && carousels ? carousels[selectedIdx] : null;

    const handleApplySingle = (card: ParsedCard) => {
        if (!card.backgroundUrl) return;
        setApplying(true);

        const metadata: any = { title: card.title };
        if (card.schedule) metadata.schedule = card.schedule;
        if (card.live) metadata.live = card.live;
        if (card.duration) metadata.duration = card.duration;
        if (card.description) metadata.sinopsis = card.description;
        if (card.year) metadata.year = card.year;
        if (card.ageRating) metadata.ageRating = card.ageRating;
        if (card.channelName) metadata.channelName = card.channelName;

        parent.postMessage({
            pluginMessage: {
                type: 'apply-cover-url',
                coverUrl: card.backgroundUrl,
                titleTreatmentUrl: card.titleTreatmentUrl,
                metadata,
            }
        }, '*');

        Logger.add('HTML Apply - Single', card.title, [card.type]);
        setTimeout(() => setApplying(false), 800);
    };

    const handleApplyAll = () => {
        if (!selectedCarousel) return;
        const validCards = selectedCarousel.cards.filter(c => c.backgroundUrl);
        if (validCards.length === 0) return;

        setApplying(true);

        const coversUrlData = validCards.map(card => {
            const metadata: any = { title: card.title };
            if (card.schedule) metadata.schedule = card.schedule;
            if (card.live) metadata.live = card.live;
            if (card.duration) metadata.duration = card.duration;
            if (card.description) metadata.sinopsis = card.description;
            if (card.year) metadata.year = card.year;
            if (card.ageRating) metadata.ageRating = card.ageRating;
            if (card.channelName) metadata.channelName = card.channelName;

            return {
                coverUrl: card.backgroundUrl!,
                titleTreatmentUrl: card.titleTreatmentUrl,
                metadata,
            };
        });

        parent.postMessage({
            pluginMessage: {
                type: 'apply-multiple-covers-url',
                coversUrlData: coversUrlData.slice(0, selectionInfo.coverCount || coversUrlData.length),
                carouselTitle: selectedCarousel.title,
            }
        }, '*');

        Logger.add('HTML Apply - Row', selectedCarousel.label, [`${validCards.length} cards`]);
        setTimeout(() => setApplying(false), 800);
    };

    // ── Step 1: Paste HTML ──
    if (!carousels) {
        return (
            <div className="grid-container">
                <div className="html-paste-step">
                    <div className="html-paste-header">
                        <ol className="html-paste-steps">
                            {([
                                <><strong>Abre orangetv.orange.es</strong> en Chrome y navega a la página que quieras.</>,
                                <>Haz clic derecho en cualquier parte de la página y pulsa <strong>Inspeccionar</strong>.</>,
                                <>En el panel que se abre, localiza la etiqueta <code>&lt;app-root&gt;</code> al inicio del código.</>,
                                <>Haz clic derecho sobre <code>&lt;app-root&gt;</code> y selecciona <strong>Edit as HTML</strong>.</>,
                                <>Selecciona todo el contenido (<strong>Ctrl+A</strong>), cópialo y pégalo en el campo de abajo.</>,
                            ] as React.ReactNode[]).map((step, i) => (
                                <li key={i}>
                                    <span className="html-paste-step-num">{i + 1}</span>
                                    <span>{step}</span>
                                </li>
                            ))}
                        </ol>
                    </div>
                    <textarea
                        className="html-paste-textarea"
                        placeholder="Pega aquí el HTML del inspector del navegador..."
                        value={rawHtml}
                        onChange={e => update({ rawHtml: e.target.value })}
                    />
                    <div className="html-paste-actions">
                        <button
                            className="btn btn-parse"
                            disabled={!rawHtml.trim() || parsing}
                            onClick={handleParse}
                        >
                            {parsing ? (
                                <><div className="spinner" style={{ width: 14, height: 14 }}></div> Parseando...</>
                            ) : (
                                'Parsear HTML'
                            )}
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    // ── Step 2: Carousel List ──
    if (selectedIdx === null) {
        if (carousels.length === 0) {
            return (
                <div className="grid-container">
                    <div className="empty-state">
                        <span className="icon">&#x26A0;&#xFE0F;</span>
                        <p>No se encontraron carruseles en el HTML.</p>
                    </div>
                    <div className="html-paste-actions" style={{ padding: '0 12px' }}>
                        <button className="btn btn-clear" onClick={handleClear}>Pegar otro HTML</button>
                    </div>
                </div>
            );
        }

        return (
            <>
                <div className="html-carousel-header">
                    <span className="html-carousel-count">{carousels.length} carruseles &middot; {carousels.reduce((s, c) => s + c.cards.length, 0)} cards</span>
                    <button className="btn btn-clear-sm" onClick={handleClear}>Limpiar</button>
                </div>
                <div className="grid-container">
                    <div className="html-carousel-list">
                        {carousels.map((carousel, idx) => (
                            <button
                                key={idx}
                                className="html-carousel-item"
                                onClick={() => update({ selectedIdx: idx })}
                            >
                                <span className={`carousel-type-tag tag-${carousel.tagName.replace('app-carousel-', '')}`}>
                                    {carouselTypeTag(carousel.tagName)}
                                </span>
                                <div className="carousel-item-info">
                                    <div className="carousel-item-label">{carousel.label}</div>
                                    <div className="carousel-item-meta">
                                        {carousel.tagName.replace('app-carousel-', '')} &middot; {carousel.cards.length} cards
                                    </div>
                                </div>
                                <span className="carousel-item-arrow">&rsaquo;</span>
                            </button>
                        ))}
                    </div>
                </div>
            </>
        );
    }

    // ── Step 3: Card Grid ──
    if (!selectedCarousel) return null;

    const validCards = selectedCarousel.cards.filter(c => c.backgroundUrl);
    const totalTargetCards = Math.max(selectionInfo.coverCount || 0, 0);
    const canApplyAll = totalTargetCards > 1 && validCards.length > 0;

    // Grid columns driven by the majority format across all cards.
    const portraitCount = selectedCarousel.cards.filter(c => c.imageFormat === 'portrait').length;
    const carouselFormat: 'portrait' | 'landscape' = portraitCount > selectedCarousel.cards.length / 2 ? 'portrait' : 'landscape';
    Logger.add('Grid', `${selectedCarousel.label} → format=${carouselFormat} (portrait=${portraitCount}/${selectedCarousel.cards.length})`);

    return (
        <>
            <div className="html-carousel-header">
                <button className="btn btn-back" onClick={handleBack}>&lsaquo; Volver</button>
                <span className="html-carousel-count" style={{ flex: 1, textAlign: 'right' }}>
                    {selectedCarousel.cards.length} cards
                </span>
            </div>

            {canApplyAll && (
                <div className="random-bar visible">
                    <button className="btn btn-random" onClick={handleApplyAll}>
                        Aplicar fila completa ({Math.min(validCards.length, totalTargetCards)})
                    </button>
                </div>
            )}

            <div className="grid-container">
                <div className={`grid ${carouselFormat === 'portrait' ? '' : 'landscape'}`.trim()}>
                    {selectedCarousel.cards.map((card, idx) => {
                        const aspectRatio = card.imageFormat === 'portrait' ? '2/3' : '16/9';

                        if (!card.backgroundUrl) {
                            return (
                                <div key={idx} className="grid-item no-image" style={{ aspectRatio }}>
                                    <span>{card.title}</span>
                                </div>
                            );
                        }

                        return (
                            <div
                                key={idx}
                                className="grid-item"
                                style={{ aspectRatio }}
                                onClick={() => handleApplySingle(card)}
                            >
                                <img
                                    src={card.backgroundUrl}
                                    alt={card.title}
                                    onLoad={e => {
                                        (e.target as HTMLImageElement).classList.add('loaded');
                                    }}
                                    onError={e => {
                                        (e.target as HTMLImageElement).parentElement!.classList.add('no-image');
                                        (e.target as HTMLImageElement).style.display = 'none';
                                        const span = document.createElement('span');
                                        span.textContent = card.title;
                                        (e.target as HTMLImageElement).parentElement!.appendChild(span);
                                    }}
                                />
                                <div className="overlay">
                                    <div className="overlay-title">{card.title}</div>
                                    {card.schedule && (
                                        <div className="overlay-year">{card.live ? `${card.live} | ` : ''}{card.schedule}</div>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </>
    );
}
