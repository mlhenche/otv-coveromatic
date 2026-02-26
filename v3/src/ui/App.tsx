import React, { useState, useEffect } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import Header from './components/Header';
import Tabs from './components/Tabs';
import ControlsBar from './components/ControlsBar';
import CoverGrid from './components/CoverGrid';
import HtmlPasteTab, { HtmlPasteState } from './components/HtmlPasteTab';
import FooterLog from './components/FooterLog';
import SeasonPicker from './components/SeasonPicker';
import Overlays from './components/Overlays';

const queryClient = new QueryClient();

export default function App() {
    const [activeTab, setActiveTab] = useState('movie');
    const [apiKey, setApiKey] = useState('');
    const [searchTerm, setSearchTerm] = useState('');
    const [genreId, setGenreId] = useState<number | null>(null);

    // Personas Tab states
    const [personSearchMode, setPersonSearchMode] = useState<'by-name' | 'by-content'>('by-name');
    const [selectedContentData, setSelectedContentData] = useState<any>(null);

    // HTML Paste Tab persisted state
    const [htmlState, setHtmlState] = useState<HtmlPasteState>({
        rawHtml: '', carousels: null, selectedIdx: null,
    });

    // Modals & Overlays
    const [seasonPickerEntry, setSeasonPickerEntry] = useState<any>(null);
    const [applying, setApplying] = React.useState(false);
    const [typePickerCallback, setTypePickerCallback] = React.useState<((type: string | null) => void) | null>(null);
    const [reloadTrigger, setReloadTrigger] = React.useState(0);

    const [selectionInfo, setSelectionInfo] = useState({
        count: 0,
        coverCount: 0,
        titleTreatmentCount: 0,
        componentType: 'unknown',
        chapterCardCount: 0
    });

    useEffect(() => {
        // Listen to messages from the sandbox plugin
        const onMessage = (event: MessageEvent) => {
            const msg = event.data.pluginMessage;
            if (!msg) return;

            if (msg.type === 'loaded-api-key') {
                setApiKey(msg.apiKey || '');
            } else if (msg.type === 'selection-info') {
                setSelectionInfo({
                    count: msg.count || 0,
                    coverCount: msg.coverCount || 0,
                    titleTreatmentCount: msg.titleTreatmentCount || 0,
                    componentType: msg.componentType || 'unknown',
                    chapterCardCount: msg.chapterCardCount || 0
                });
            } else if (msg.type === 'selection-changed') {
                setSelectionInfo(prev => ({ ...prev, componentType: 'unknown' }));
            }
        };

        window.addEventListener('message', onMessage);

        // Request initial data
        parent.postMessage({ pluginMessage: { type: 'load-api-key' } }, '*');
        parent.postMessage({ pluginMessage: { type: 'get-selection' } }, '*');

        return () => window.removeEventListener('message', onMessage);
    }, []);

    const handleSaveApiKey = (key: string) => {
        setApiKey(key);
        parent.postMessage({ pluginMessage: { type: 'save-api-key', apiKey: key } }, '*');
    };

    const handleTabChange = (tab: string) => {
        setActiveTab(tab);
        setSearchTerm('');
        setGenreId(null);
        setReloadTrigger(0);
    };

    const handleGoToPersonas = (entry: any) => {
        setActiveTab('person');
        setPersonSearchMode('by-content');
        setSelectedContentData({
            id: entry.tmdbId,
            media_type: entry.mediaType
        });
    };

    return (
        <QueryClientProvider client={queryClient}>
            <div className="plugin">
                <Header apiKey={apiKey} onSaveApiKey={handleSaveApiKey} />
                <Tabs activeTab={activeTab} onChangeTab={handleTabChange} />
                {activeTab !== 'html' && (
                    <ControlsBar
                        apiKey={apiKey}
                        activeTab={activeTab}
                        searchTerm={searchTerm}
                        onSearchChange={setSearchTerm}
                        genreId={genreId}
                        onGenreChange={setGenreId}
                        personSearchMode={personSearchMode}
                        onPersonSearchModeChange={setPersonSearchMode}
                        selectedContentData={selectedContentData}
                        onSelectedContentDataChange={setSelectedContentData}
                    />
                )}
                {activeTab === 'html' ? (
                    <HtmlPasteTab
                        selectionInfo={selectionInfo}
                        setApplying={setApplying}
                        htmlState={htmlState}
                        onHtmlStateChange={setHtmlState}
                    />
                ) : (
                    <CoverGrid
                        apiKey={apiKey}
                        activeTab={activeTab}
                        searchTerm={searchTerm}
                        genreId={genreId}
                        personSearchMode={personSearchMode}
                        selectedContentData={selectedContentData}
                        onOpenSeasons={(entry) => setSeasonPickerEntry(entry)}
                        onGoToPersonas={handleGoToPersonas}
                        selectionInfo={selectionInfo}
                        setApplying={setApplying}
                        setTypePickerCallback={(cb) => setTypePickerCallback(() => cb)}
                        reloadTrigger={reloadTrigger}
                    />
                )}
                <FooterLog
                    selectionInfo={selectionInfo}
                    onReload={() => setReloadTrigger(r => r + 1)}
                />
            </div>

            {/* Overlays */}
            {seasonPickerEntry && (
                <SeasonPicker
                    apiKey={apiKey}
                    entry={seasonPickerEntry}
                    selectionInfo={selectionInfo}
                    onClose={() => setSeasonPickerEntry(null)}
                />
            )}

            <Overlays
                applying={applying}
                typePickerCallback={typePickerCallback}
                setTypePickerCallback={setTypePickerCallback}
            />
        </QueryClientProvider>
    );
}
