import React, { useState } from 'react';
import { Logger } from './LogStore';
import {
    ParsedCard,
    ParsedCarousel,
    parseHtml,
    buildCardMetadata,
} from '../../lib/html-parser';

export type { ParsedCard, ParsedCarousel };

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

    const handleApplySingle = async (card: ParsedCard) => {
        if (!card.backgroundUrl) return;
        setApplying(true);

        // Fetch image in UI context (browser iframe allows cross-origin fetches to pc.orangetv.orange.es,
        // necesario para EPG: figma.createImageAsync falla en el sandbox de Figma para URLs de OTV)
        let imageBytes: number[] | undefined;
        try {
            const res = await fetch(card.backgroundUrl);
            if (res.ok) imageBytes = Array.from(new Uint8Array(await res.arrayBuffer()));
        } catch (_) {}

        parent.postMessage({
            pluginMessage: {
                type: 'apply-cover-url',
                coverUrl: card.backgroundUrl,
                imageBytes,
                titleTreatmentUrl: card.titleTreatmentUrl,
                metadata: buildCardMetadata(card),
            }
        }, '*');

        Logger.add('HTML Apply - Single', card.title, [card.type]);
        setTimeout(() => setApplying(false), 800);
    };

    const handleApplyAll = async () => {
        if (!selectedCarousel) return;
        const validCards = selectedCarousel.cards.filter(c => c.backgroundUrl);
        if (validCards.length === 0) return;

        setApplying(true);

        // Fetch all images in UI context (browser iframe has OTV session cookies, needed for EPG images)
        const coversUrlData = await Promise.all(
            validCards.map(async card => {
                const data: { coverUrl: string; imageBytes?: number[]; titleTreatmentUrl: string | null; metadata: Record<string, string> } = {
                    coverUrl: card.backgroundUrl!,
                    titleTreatmentUrl: card.titleTreatmentUrl,
                    metadata: buildCardMetadata(card),
                };
                try {
                    const res = await fetch(card.backgroundUrl!);
                    if (res.ok) data.imageBytes = Array.from(new Uint8Array(await res.arrayBuffer()));
                } catch (_) {}
                return data;
            })
        );

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

                        if (!card.backgroundUrl) return null;

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
