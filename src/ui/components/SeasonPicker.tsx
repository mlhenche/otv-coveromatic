import React, { useState } from 'react';
import { useTMDBSeasons, useTMDBEpisodes, TmdbAuthError } from '../hooks/useTMDB';
import { CatalogItem } from './CoverCard';

interface SeasonPickerProps {
    apiKey: string;
    entry: CatalogItem | null;
    onClose: () => void;
    selectionInfo: any;
}

export default function SeasonPicker({ apiKey, entry, onClose, selectionInfo }: SeasonPickerProps) {
    const [selectedSeason, setSelectedSeason] = useState<number | null>(null);

    const { data: seasons, isLoading: seasonsLoading, error: seasonsError } = useTMDBSeasons(apiKey, entry?.tmdbId || null);
    const { data: episodes, isLoading: episodesLoading, error: episodesError } = useTMDBEpisodes(apiKey, entry?.tmdbId || null, selectedSeason);

    if (!entry) return null;

    if (seasonsError instanceof TmdbAuthError || episodesError instanceof TmdbAuthError) {
        return (
            <div className="season-picker-overlay">
                <div className="season-picker-card">
                    <div className="season-picker-header">
                        <h2 className="season-picker-title">{entry.title}</h2>
                        <button className="season-picker-close" onClick={onClose}>×</button>
                    </div>
                    <div className="season-picker-content">
                        <div className="season-picker-empty" style={{ padding: '24px 16px', textAlign: 'center' }}>
                            <div style={{ fontSize: '24px', marginBottom: '8px' }}>🔑</div>
                            <p>API key de TMDB inválida o caducada.</p>
                            <p style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                                Actualízala en el icono de llave (arriba a la derecha).
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    const handleApplySingleEpisode = (episode: any) => {
        applyEpisodes([episode]);
    };

    const handleApplyBatch = () => {
        if (!episodes) return;
        const applyCount = Math.min(episodes.length, selectionInfo.chapterCardCount);
        applyEpisodes(episodes.slice(0, applyCount));
    };

    const applyEpisodes = (episodesToApply: any[]) => {
        // Send to sandbox via postMessage
        const episodesData = episodesToApply.map(ep => {
            const OTV_BASE = 'https://pc.orangetv.orange.es/pc/api/rtv/v1/images/vod';
            const fallbackUrl = `${OTV_BASE}/COVER_ART/${entry.contentId}_COVER_ART.jpg?width=3840&height=2160`;
            const coverUrl = ep.still_path ? `https://image.tmdb.org/t/p/original${ep.still_path}` : fallbackUrl;

            const formatChapter = (sn: number, en: number) => `T${String(sn).padStart(2, '0')} E${String(en).padStart(2, '0')}`;
            const formatDuration = (mins: number) => mins ? `${Math.floor(mins / 60)}h ${mins % 60}m`.replace('0h ', '') : '';

            return {
                coverUrl,
                metadata: {
                    title: ep.name || 'Sin título',
                    chapter: formatChapter(selectedSeason as number, ep.episode_number),
                    duration: formatDuration(ep.runtime),
                    sinopsis: ep.overview || ''
                }
            };
        });

        parent.postMessage({
            pluginMessage: {
                type: 'apply-episode-covers',
                episodesData,
                fallbackContentId: entry.contentId // Let sandbox know to use cover art if still fails
            }
        }, '*');

        onClose();
    };

    return (
        <div className="season-picker-overlay">
            <div className="season-picker-card">
                <div className="season-picker-header">
                    {selectedSeason !== null && (
                        <button className="season-picker-back" onClick={() => setSelectedSeason(null)}>
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <line x1="19" y1="12" x2="5" y2="12"></line>
                                <polyline points="12 19 5 12 12 5"></polyline>
                            </svg>
                        </button>
                    )}
                    <h2 className="season-picker-title">
                        {entry.title} {selectedSeason !== null ? `— T${String(selectedSeason).padStart(2, '0')}` : ''}
                    </h2>
                    <button className="season-picker-close" onClick={onClose}>×</button>
                </div>

                <div className="season-picker-content">
                    {selectedSeason === null ? (
                        // Seasons list
                        seasonsLoading ? (
                            <div className="season-picker-loading">
                                <div className="spinner"></div><span>Cargando temporadas...</span>
                            </div>
                        ) : seasons && seasons.length > 0 ? (
                            seasons.map((s: any) => (
                                <button
                                    key={s.season_number}
                                    className="season-item"
                                    onClick={() => setSelectedSeason(s.season_number)}
                                >
                                    <span className="season-name">Temporada {s.season_number}</span>
                                    <span className="season-episodes">{s.episode_count} episodios</span>
                                </button>
                            ))
                        ) : (
                            <div className="season-picker-empty">No se encontraron temporadas</div>
                        )
                    ) : (
                        // Episodes list
                        episodesLoading ? (
                            <div className="season-picker-loading">
                                <div className="spinner"></div><span>Cargando episodios...</span>
                            </div>
                        ) : episodes && episodes.length > 0 ? (
                            <>
                                {selectionInfo.chapterCardCount > 1 ? (
                                    <>
                                        <div className="episode-batch-info">
                                            <p>{episodes.length} episodios disponibles</p>
                                            <p>{selectionInfo.chapterCardCount} tarjetas seleccionadas</p>
                                            <p className="episode-batch-note">Se aplicarán los primeros {Math.min(episodes.length, selectionInfo.chapterCardCount)} episodios en orden.</p>
                                        </div>
                                        <button className="btn-apply-episodes" onClick={handleApplyBatch}>Añadir capítulos</button>
                                        <div className="episode-preview-list">
                                            {episodes.slice(0, Math.min(episodes.length, selectionInfo.chapterCardCount)).map((ep: any) => (
                                                <div key={ep.episode_number} className="episode-preview-item">
                                                    <span className="ep-num">T{String(selectedSeason).padStart(2, '0')} E{String(ep.episode_number).padStart(2, '0')}</span>
                                                    <span className="ep-name">{ep.name || 'Sin título'}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </>
                                ) : (
                                    episodes.map((ep: any) => (
                                        <button key={ep.episode_number} className="episode-item" onClick={() => handleApplySingleEpisode(ep)}>
                                            <div className="episode-item-header">
                                                <span className="ep-num">T{String(selectedSeason).padStart(2, '0')} E{String(ep.episode_number).padStart(2, '0')}</span>
                                                <span className="ep-duration">{ep.runtime ? `${ep.runtime}m` : ''}</span>
                                            </div>
                                            <span className="ep-name">{ep.name || 'Sin título'}</span>
                                        </button>
                                    ))
                                )}
                            </>
                        ) : (
                            <div className="season-picker-empty">No se encontraron episodios</div>
                        )
                    )}
                </div>
            </div>
        </div>
    );
}
