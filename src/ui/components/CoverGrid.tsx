import React, { useMemo } from 'react';
import { useCatalog } from '../hooks/useCatalog';
import { useTMDBPersonSearch, useTMDBCredits, TmdbAuthError } from '../hooks/useTMDB';
import CoverCard, { CatalogItem } from './CoverCard';
import { shuffle } from '../../lib/shuffle';
import { buildOTVUrls } from '../../lib/urls';

interface CoverGridProps {
    apiKey: string;
    activeTab: string;
    searchTerm: string;
    genreId: number | null;
    personSearchMode: 'by-name' | 'by-content';
    selectedContentData: any;
    onOpenSeasons: (item: CatalogItem) => void;
    onGoToPersonas: (item: CatalogItem) => void;
    selectionInfo: any;
    setApplying: (val: boolean) => void;
    setTypePickerCallback: (cb: any) => void;
    reloadTrigger?: number;
}

import VPSNextDialog from './VPSNextDialog';
import { Logger } from './LogStore';
import LogPanel from './LogPanel';

export default function CoverGrid({
    apiKey, activeTab, searchTerm, genreId,
    personSearchMode, selectedContentData, onOpenSeasons, onGoToPersonas,
    selectionInfo, setApplying, setTypePickerCallback, reloadTrigger
}: CoverGridProps) {
    const [vpsNextEntry, setVpsNextEntry] = React.useState<any>(null);
    const [vpsDialogHidden, setVpsDialogHidden] = React.useState(false);

    const { data: catalogData, isLoading: catalogLoading, error: catalogError } = useCatalog();

    // TMDB Person hooks
    const { data: personsByName, isLoading: personsLoading, error: personsError } = useTMDBPersonSearch(
        apiKey,
        activeTab === 'person' && personSearchMode === 'by-name' ? searchTerm : ''
    );

    const { data: personsByContent, isLoading: creditsLoading, error: creditsError } = useTMDBCredits(
        apiKey,
        activeTab === 'person' && personSearchMode === 'by-content' && selectedContentData ? selectedContentData.id : null,
        selectedContentData?.media_type || 'movie'
    );

    const tmdbAuthError = (personsError instanceof TmdbAuthError || creditsError instanceof TmdbAuthError);

    const handleApply = (item: any) => {
        if (activeTab === 'person') {
            applyTMDBPerson(item);
        } else {
            if (selectionInfo.componentType === 'unknown') {
                setTypePickerCallback((typeToUse: string | null) => {
                    if (!typeToUse) return;
                    applyOTVContent(item, typeToUse);
                });
            } else {
                applyOTVContent(item, selectionInfo.componentType);
            }
        }
    };

    const applyOTVContent = async (item: any, typeToUse: string) => {
        setApplying(true);
        try {
            const { coverUrl, titleTreatmentUrl } = buildOTVUrls(item.contentId, typeToUse);

            let duration = '';
            let ageRating = '';
            let sinopsis = '';
            let year = '';
            let rating = '';

            if (item.tmdbId && apiKey) {
                try {
                    const appendObj = item.mediaType === 'movie' ? 'release_dates' : 'content_ratings';
                    const detailRes = await fetch(`https://api.themoviedb.org/3/${item.mediaType === 'movie' ? 'movie' : 'tv'}/${item.tmdbId}?api_key=${apiKey}&language=es-ES&append_to_response=${appendObj}`);
                    if (detailRes.ok) {
                        const detail = await detailRes.json();
                        rating = detail.vote_average ? detail.vote_average.toFixed(1) : '';
                        const dateStr = detail.release_date || detail.first_air_date || '';
                        year = dateStr ? dateStr.substring(0, 4) : '';
                        sinopsis = detail.overview || '';

                        if (item.mediaType === 'movie') {
                            duration = detail.runtime ? `${Math.floor(detail.runtime / 60)}h ${detail.runtime % 60}m`.replace('0h ', '') : '';
                        } else {
                            const n = detail.number_of_seasons;
                            if (n) duration = `${n} temporada${n === 1 ? '' : 's'}`;
                        }

                        if (item.mediaType === 'movie' && detail.release_dates?.results) {
                            const esRelease = detail.release_dates.results.find((r: any) => r.iso_3166_1 === 'ES');
                            if (esRelease && esRelease.release_dates.length > 0) {
                                ageRating = esRelease.release_dates[0].certification || '';
                            }
                        } else if (item.mediaType === 'tv' && detail.content_ratings?.results) {
                            const esRating = detail.content_ratings.results.find((r: any) => r.iso_3166_1 === 'ES');
                            if (esRating) ageRating = esRating.rating || '';
                        }
                    }
                } catch (e) {
                    console.error("TMDB metadata fetch error", e);
                    Logger.add('TMDB fetch failed', String(e), ['warning']);
                    parent.postMessage({ pluginMessage: { type: 'notify-warning', message: '⚠️ No se pudo cargar metadata de TMDB. Se aplicará solo la imagen.' } }, '*');
                }
            }

            const genres = catalogData ? (item.genreIds || []).slice(0, 3).map((id: number) => catalogData.genreNames[id]).filter(Boolean) : [];

            parent.postMessage({
                pluginMessage: {
                    type: 'apply-cover-url',
                    coverUrl,
                    titleTreatmentUrl,
                    metadata: {
                        title: item.title,
                        rating,
                        year,
                        duration,
                        ageRating,
                        sinopsis,
                        genres,
                        contentId: item.contentId
                    }
                }
            }, '*');

            Logger.add(`Apply ${selectionInfo.componentType} - Single`, item.title, [item.mediaType, `ID: ${item.contentId}`]);

            if (typeToUse === 'vps' && item.tmdbId) {
                setTimeout(() => {
                    setVpsNextEntry(item);
                    setVpsDialogHidden(false);
                }, 1000);
            }
        } finally {
            setTimeout(() => setApplying(false), 800);
        }
    };

    const applyRelatedContent = async (entry: any) => {
        if (selectionInfo.coverCount <= 1) {
            alert('Selecciona múltiples componentes card portrait o landscape para añadir contenido relacionado.');
            return;
        }

        if (selectionInfo.componentType === 'vps' || selectionInfo.componentType === 'slideshow') {
            alert('El contenido relacionado solo se puede aplicar a cards portrait o landscape, no a envolventes.');
            return;
        }

        if (!entry.genreIds || entry.genreIds.length === 0) {
            alert('Este contenido no tiene géneros asociados.');
            return;
        }

        setApplying(true);

        try {
            const allOTVItems = [...(catalogData?.movies || []), ...(catalogData?.series || [])]
                .filter(item => item.contentId !== entry.contentId);

            const selectedIds = new Set();
            const selectedItems: any[] = [];

            for (const gId of entry.genreIds) {
                if (selectedItems.length >= selectionInfo.coverCount) break;

                const genreItems = allOTVItems.filter(item => {
                    if (selectedIds.has(item.contentId)) return false;
                    return item.genreIds?.includes(gId);
                });

                const shuffled = shuffle(genreItems);
                for (const item of shuffled) {
                    if (selectedItems.length >= selectionInfo.coverCount) break;
                    selectedIds.add(item.contentId);
                    selectedItems.push(item);
                }
            }

            if (selectedItems.length < selectionInfo.coverCount) {
                const remaining = allOTVItems.filter(item => !selectedIds.has(item.contentId));
                const shuffledRemaining = shuffle(remaining);

                for (const item of shuffledRemaining) {
                    if (selectedItems.length >= selectionInfo.coverCount) break;
                    selectedIds.add(item.contentId);
                    selectedItems.push(item);
                }
            }

            applyRandomOTV(selectedItems); // This sends apply-multiple-covers-url properly
        } finally {
            setTimeout(() => setApplying(false), 800);
        }
    };

    const applyTMDBPerson = async (person: any) => {
        setApplying(true);
        try {
            const coverUrl = `https://image.tmdb.org/t/p/original${person.profile_path}`;
            const response = await fetch(coverUrl);
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const buffer = await response.arrayBuffer();
            const bytes = Array.from(new Uint8Array(buffer));

            const personName = person.name || person.title || '';
            const dept = person.known_for_department || '';
            const isActor = dept === 'Acting';
            const departmentMap: Record<string, string> = {
                'Directing': 'Director',
                'Writing': 'Guionista',
                'Production': 'Productor',
                'Editing': 'Montador',
                'Camera': 'Fotografía',
                'Art': 'Arte'
            };

            const rol = isActor ? '' : (person.character || departmentMap[dept] || dept);

            parent.postMessage({
                pluginMessage: {
                    type: 'apply-cover',
                    imageBytes: bytes,
                    metadata: { personName, rol, isActor }
                }
            }, '*');

            Logger.add(`Apply person - Single`, personName, [rol, isActor ? 'Actor' : 'Crew']);

        } catch (err) {
            console.error('Error fetching person image:', err);
        } finally {
            setTimeout(() => {
                setApplying(false);
                if (vpsNextEntry) setVpsDialogHidden(false);
            }, 800);
        }
    };

    const currentResults = useMemo(() => {
        if (activeTab === 'log') return [];

        if (activeTab === 'person') {
            if (personSearchMode === 'by-name') {
                return personsByName || [];
            } else {
                return personsByContent || [];
            }
        }

        if (!catalogData) return [];

        const source = activeTab === 'movie' ? catalogData.movies : catalogData.series;

        let results = source;
        if (searchTerm) {
            const q = searchTerm.toLowerCase();
            results = results.filter(e => e.title.toLowerCase().includes(q));
        }
        if (genreId !== null) {
            results = results.filter(e => e.genreIds.includes(genreId));
        }

        // Apply shuffle/randomness when reloadTrigger changes
        if (reloadTrigger && reloadTrigger > 0) {
            results = shuffle(results);
        }

        return results;
    }, [activeTab, personSearchMode, personsByName, personsByContent, catalogData, searchTerm, genreId, reloadTrigger]);


    const handleApplyRandom = () => {
        const totalTargetCards = Math.max(selectionInfo.coverCount || 0, selectionInfo.chapterCardCount || 0);
        if (totalTargetCards <= 1) return;

        const validItems = currentResults.filter((item: any) => activeTab === 'person' ? !!item.profile_path : !!item.contentId);
        if (validItems.length === 0) return;

        let selectedItems = [];
        if (activeTab === 'person' && personSearchMode === 'by-content') {
            selectedItems = validItems.slice(0, totalTargetCards);
        } else {
            const shuffled = shuffle(validItems);
            selectedItems = shuffled.slice(0, totalTargetCards);
        }

        if (activeTab === 'person') {
            setApplying(true);
            applyRandomPersons(selectedItems);
        } else {
            applyRandomOTV(selectedItems);
        }
    };

    const applyRandomPersons = async (items: any[]) => {
        try {
            const coversData = [];
            for (let i = 0; i < items.length; i++) {
                const item = items[i];
                const coverUrl = `https://image.tmdb.org/t/p/original${item.profile_path}`;
                const personName = item.name || '';
                const dept = item.known_for_department || '';
                const isActor = dept === 'Acting';
                const rol = isActor ? '' : dept;
                const metadata = { personName, rol, isActor: isActor };

                const response = await fetch(coverUrl);
                if (response.ok) {
                    const buffer = await response.arrayBuffer();
                    const bytes = Array.from(new Uint8Array(buffer));
                    coversData.push({ imageBytes: bytes, metadata });
                }
            }

            parent.postMessage({
                pluginMessage: {
                    type: 'apply-multiple-covers',
                    coversData: coversData.slice(0, selectionInfo.coverCount)
                }
            }, '*');

            Logger.add(`Apply persons - Random`, `${coversData.length} items applied`);
        } finally {
            setTimeout(() => setApplying(false), 800);
        }
    };

    const applyRandomOTV = (items: any[]) => {
        if (selectionInfo.componentType === 'unknown') {
            setTypePickerCallback((typeToUse: string) => {
                if (!typeToUse) return;
                sendRandomOTVMessage(items, typeToUse);
            });
            return;
        }
        sendRandomOTVMessage(items, selectionInfo.componentType);
    };

    const sendRandomOTVMessage = (items: any[], typeToUse: string) => {
        setApplying(true);
        const coversUrlData = items.map(item => {
            const { coverUrl, titleTreatmentUrl } = buildOTVUrls(item.contentId, typeToUse);
            return {
                coverUrl,
                titleTreatmentUrl,
                metadata: {
                    title: item.title,
                    genreIds: item.genreIds,
                    mediaType: item.mediaType
                }
            };
        });

        parent.postMessage({
            pluginMessage: {
                type: 'apply-multiple-covers-url',
                coversUrlData: coversUrlData.slice(0, selectionInfo.coverCount)
            }
        }, '*');

        Logger.add(`Apply ${typeToUse} - Random OTV`, `${coversUrlData.length} items applied`);

        setTimeout(() => setApplying(false), 800);
    };

    if (activeTab === 'log') return <LogPanel />;

    if (tmdbAuthError) {
        return (
            <div className="grid-container">
                <div className="empty-state">
                    <span className="icon">🔑</span>
                    <p>API key de TMDB inválida o caducada.</p>
                    <p style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                        Actualízala en el icono de llave (arriba a la derecha).
                    </p>
                </div>
            </div>
        );
    }

    const isLoading =
        (activeTab !== 'person' && catalogLoading) ||
        (activeTab === 'person' && personSearchMode === 'by-name' && personsLoading) ||
        (activeTab === 'person' && personSearchMode === 'by-content' && selectedContentData && creditsLoading);

    if (isLoading) {
        return (
            <div className="grid-container">
                <div className="loading">
                    <div className="spinner"></div>
                    <span>Cargando...</span>
                </div>
            </div>
        );
    }

    if (catalogError && activeTab !== 'person') {
        return (
            <div className="grid-container">
                <div className="empty-state">
                    <span className="icon">⚠️</span>
                    <p>Error cargando datos: {(catalogError as Error).message}</p>
                </div>
            </div>
        );
    }

    if (activeTab === 'person' && personSearchMode === 'by-content' && !selectedContentData) {
        return (
            <div className="grid-container">
                <div className="empty-state">
                    <span className="icon">🔍</span>
                    <p>Usa el buscador para seleccionar una película o serie y cargar su reparto.</p>
                </div>
            </div>
        );
    }

    if (currentResults.length === 0) {
        return (
            <div className="grid-container">
                <div className="empty-state">
                    <span className="icon">🎬</span>
                    <p>No se encontraron resultados</p>
                </div>
            </div>
        );
    }

    const totalTargetCards = Math.max(selectionInfo.coverCount || 0, selectionInfo.chapterCardCount || 0);
    const isMultipleSelected = totalTargetCards > 1;

    const validItemsCount = currentResults.filter((item: any) => activeTab === 'person' ? !!item.profile_path : !!item.contentId).length;
    const canRandomApply = validItemsCount >= (activeTab === 'person' ? 1 : totalTargetCards);

    return (
        <>
            <div className={`random-bar ${isMultipleSelected && currentResults.length > 0 ? 'visible' : ''}`}>
                <button
                    className="btn btn-random"
                    disabled={!canRandomApply}
                    onClick={handleApplyRandom}
                >
                    <span className="icon">✨</span> Aplicar Aleatorio
                </button>
            </div>

            {vpsNextEntry && vpsDialogHidden && activeTab === 'person' && (
                <div style={{ padding: '8px 12px', background: 'var(--bg-tertiary)', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Opciones VPS: <strong style={{ color: 'var(--text-primary)' }}>{vpsNextEntry.title}</strong></span>
                    <button style={{ background: 'var(--accent)', color: '#fff', fontSize: '10px', padding: '4px 8px', borderRadius: '4px', border: 'none', cursor: 'pointer' }} onClick={() => setVpsDialogHidden(false)}>Volver al panel</button>
                </div>
            )}

            <div className="grid-container">
                <div className="grid">
                    {activeTab === 'person' ? currentResults.slice(0, 50).map((item: any) => (
                        <div key={`${item.id}-${item.character}`} className="grid-item" onClick={() => handleApply(item)}>
                            <img
                                src={`https://image.tmdb.org/t/p/w342${item.profile_path}`}
                                alt={item.name}
                                onLoad={(e) => (e.target as HTMLImageElement).classList.add('loaded')}
                                onError={(e) => {
                                    (e.target as HTMLImageElement).parentElement!.classList.add('no-image');
                                    (e.target as HTMLImageElement).style.display = 'none';
                                }}
                            />
                            <div className="overlay">
                                <div className="overlay-title">{item.name}</div>
                                {item.character && <div className="overlay-year" style={{ fontSize: '10px' }}>{item.character}</div>}
                            </div>
                        </div>
                    )) : currentResults.slice(0, 50).map((item: any) => (
                        <CoverCard
                            key={item.contentId}
                            item={item}
                            urlPatterns={catalogData!.urlPatterns}
                            onApply={handleApply}
                            onOpenSeasons={onOpenSeasons}
                        />
                    ))}
                </div>
            </div>

            {vpsNextEntry && !vpsDialogHidden && (
                <VPSNextDialog
                    entry={vpsNextEntry}
                    onClose={() => setVpsNextEntry(null)}
                    onAddChapters={() => {
                        onOpenSeasons(vpsNextEntry);
                    }}
                    onViewCast={() => {
                        setVpsDialogHidden(true);
                        onGoToPersonas(vpsNextEntry);
                    }}
                    onAddRelated={() => applyRelatedContent(vpsNextEntry)}
                />
            )}
        </>
    );
}
