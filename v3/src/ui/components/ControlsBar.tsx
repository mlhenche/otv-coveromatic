import React, { useState } from 'react';
import { useSupabaseCatalog } from '../hooks/useSupabaseCatalog';
import { useTMDBMultiSearch } from '../hooks/useTMDB';

interface ControlsBarProps {
    apiKey: string;
    activeTab: string;
    searchTerm: string;
    onSearchChange: (val: string) => void;
    genreId: number | null;
    onGenreChange: (id: number | null) => void;
    personSearchMode: 'by-name' | 'by-content';
    onPersonSearchModeChange: (mode: 'by-name' | 'by-content') => void;
    selectedContentData: any;
    onSelectedContentDataChange: (data: any) => void;
}

const IMAGE_BASE = 'https://image.tmdb.org/t/p/';

export default function ControlsBar({
    apiKey, activeTab, searchTerm, onSearchChange,
    genreId, onGenreChange, personSearchMode,
    onPersonSearchModeChange, selectedContentData, onSelectedContentDataChange
}: ControlsBarProps) {

    const [isGenreOpen, setIsGenreOpen] = useState(false);
    const { data: catalogData } = useSupabaseCatalog();

    // Autocomplete only works when on person tab and searching by content
    const shouldSearchMulti = activeTab === 'person' && personSearchMode === 'by-content';
    const { data: autocompleteResults, isLoading: autocompleteLoading } = useTMDBMultiSearch(apiKey, shouldSearchMulti ? searchTerm : '');

    if (activeTab === 'log') return null;

    let genres: { id: number, name: string }[] = [];
    if (catalogData && (activeTab === 'movie' || activeTab === 'tv')) {
        const source = activeTab === 'movie' ? catalogData.movies : catalogData.series;
        const genreSet = new Set<number>();
        source.forEach(e => { (e.genreIds || []).forEach(id => genreSet.add(id)); });

        genres = Array.from(genreSet)
            .map(id => ({ id, name: catalogData.genreNames[id] }))
            .filter(g => g.name)
            .sort((a, b) => a.name.localeCompare(b.name));
    }

    const currentGenreName = genreId && catalogData ? catalogData.genreNames[genreId] : 'Género';

    return (
        <>
            <div className="controls-bar">
                {activeTab === 'person' && (
                    <div className="person-search-mode-toggle">
                        <button
                            className={`mode-btn ${personSearchMode === 'by-name' ? 'active' : ''}`}
                            onClick={() => { onPersonSearchModeChange('by-name'); onSelectedContentDataChange(null); onSearchChange(''); }}
                        >Por nombre</button>
                        <button
                            className={`mode-btn ${personSearchMode === 'by-content' ? 'active' : ''}`}
                            onClick={() => { onPersonSearchModeChange('by-content'); onSelectedContentDataChange(null); onSearchChange(''); }}
                        >Por contenido</button>
                    </div>
                )}
                <div className="search-input-wrapper">
                    <span className="search-icon">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <circle cx="11" cy="11" r="8" />
                            <line x1="21" y1="21" x2="16.65" y2="16.65" />
                        </svg>
                    </span>
                    <input
                        type="text"
                        placeholder={activeTab === 'person' && personSearchMode === 'by-content' ? "Buscar película o serie..." : "Buscar..."}
                        value={searchTerm}
                        onChange={(e) => onSearchChange(e.target.value)}
                    />
                    {searchTerm && (
                        <button className="search-clear-btn visible" onClick={() => onSearchChange('')} title="Borrar búsqueda">
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                <line x1="18" y1="6" x2="6" y2="18" />
                                <line x1="6" y1="6" x2="18" y2="18" />
                            </svg>
                        </button>
                    )}

                    {/* Autocomplete Dropdown */}
                    {shouldSearchMulti && searchTerm.length >= 3 && !selectedContentData && (
                        <div className={`autocomplete-dropdown ${!autocompleteResults && !autocompleteLoading ? 'hidden' : ''}`}>
                            {autocompleteLoading && (
                                <div className="autocomplete-loading"><div className="spinner"></div>Buscando...</div>
                            )}
                            {autocompleteResults && autocompleteResults.length === 0 && (
                                <div className="autocomplete-empty">No se encontraron películas ni series</div>
                            )}
                            {autocompleteResults && autocompleteResults.length > 0 && autocompleteResults.map(item => {
                                const title = item.title || item.name || 'Sin título';
                                const date = item.release_date || item.first_air_date || '';
                                const year = date ? date.substring(0, 4) : '';
                                const typeLabel = item.media_type === 'movie' ? 'Película' : 'Serie';

                                return (
                                    <div key={item.id} className="autocomplete-item" onClick={() => {
                                        onSelectedContentDataChange({ id: item.id, title, media_type: item.media_type });
                                        onSearchChange(''); // Clear input
                                    }}>
                                        {item.poster_path ? (
                                            <img className="autocomplete-item-poster" src={`${IMAGE_BASE}w92${item.poster_path}`} alt="" />
                                        ) : (
                                            <div className="autocomplete-item-poster"></div>
                                        )}
                                        <div className="autocomplete-item-info">
                                            <div className="autocomplete-item-title">{title}</div>
                                            <div className="autocomplete-item-meta">{typeLabel}{year ? ` · ${year}` : ''}</div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                {activeTab !== 'person' && activeTab !== 'log' && (
                    <div className="genre-filter">
                        <button
                            className={`genre-btn ${genreId ? 'active' : ''}`}
                            onClick={() => setIsGenreOpen(!isGenreOpen)}
                        >
                            {currentGenreName}
                            {genreId ? (
                                <span className="genre-clear" onClick={(e) => { e.stopPropagation(); onGenreChange(null); }}>×</span>
                            ) : (
                                <span style={{ fontSize: '8px' }}> ▾</span>
                            )}
                        </button>

                        {isGenreOpen && (
                            <div className="genre-dropdown open" onMouseLeave={() => setIsGenreOpen(false)}>
                                <button
                                    className={`genre-option ${genreId === null ? 'active' : ''}`}
                                    onClick={() => { onGenreChange(null); setIsGenreOpen(false); }}
                                >
                                    Todos
                                </button>
                                {genres.map(g => (
                                    <button
                                        key={g.id}
                                        className={`genre-option ${genreId === g.id ? 'active' : ''}`}
                                        onClick={() => { onGenreChange(g.id); setIsGenreOpen(false); }}
                                    >
                                        {g.name}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </div>

            {activeTab === 'person' && personSearchMode === 'by-content' && selectedContentData && (
                <div className="content-context-bar">
                    <div className="content-context-info">
                        <span className="context-label">Personas de:</span>
                        <span className="context-title">{selectedContentData.title}</span>
                    </div>
                    <button className="context-clear-btn" onClick={() => onSelectedContentDataChange(null)} title="Limpiar selección">×</button>
                </div>
            )}
        </>
    );
}
