import React, { useState } from 'react';

export interface CatalogItem {
    title: string;
    contentId: string;
    mediaType: string;
    tmdbId: string;
    tmdbTitle: string;
    genreIds: number[];
}

interface CoverCardProps {
    item: CatalogItem;
    urlPatterns: Record<string, string>;
    onApply: (item: CatalogItem) => void;
    onOpenSeasons?: (item: CatalogItem) => void;
}

export default function CoverCard({ item, urlPatterns, onApply, onOpenSeasons }: CoverCardProps) {
    const [imgError, setImgError] = useState(false);
    const [imgLoaded, setImgLoaded] = useState(false);

    const title = item.title || 'Sin título';
    const isSeries = item.mediaType === 'tv';

    // OTV catalog entry: use VERTICAL for thumbnail
    const thumbUrlPattern = urlPatterns?.vertical || 'https://pc.orangetv.orange.es/pc/api/rtv/v1/images/vod/VERTICAL/{contentId}_VERTICAL.jpg?width=3840&height=2160';
    const thumbUrl = thumbUrlPattern.replace('{contentId}', item.contentId);

    if (imgError) {
        return (
            <div className="grid-item no-image">
                <span>{title}</span>
            </div>
        );
    }

    return (
        <div className="grid-item" onClick={!isSeries ? () => onApply(item) : undefined}>
            <img
                src={thumbUrl}
                alt={title}
                className={imgLoaded ? 'loaded' : ''}
                onLoad={() => setImgLoaded(true)}
                onError={() => setImgError(true)}
            />

            {isSeries ? (
                <div className="overlay overlay-series">
                    <div className="overlay-title">{title}</div>
                    <div className="overlay-buttons">
                        <button
                            className="overlay-btn overlay-btn-datos"
                            onClick={(e) => { e.stopPropagation(); onApply(item); }}
                        >
                            Serie
                        </button>
                        <button
                            className="overlay-btn overlay-btn-temporadas"
                            onClick={(e) => { e.stopPropagation(); onOpenSeasons?.(item); }}
                        >
                            Capit.
                        </button>
                    </div>
                </div>
            ) : (
                <div className="overlay">
                    <div className="overlay-title">{title}</div>
                </div>
            )}
        </div>
    );
}
