import React from 'react';

interface TabsProps {
    activeTab: string;
    onChangeTab: (tab: string) => void;
}

export default function Tabs({ activeTab, onChangeTab }: TabsProps) {
    const tabs = [
        { id: 'movie', label: 'Cine' },
        { id: 'tv', label: 'Series' },
        { id: 'person', label: 'Personas' },
        { id: 'html', label: 'HTML' },
        { id: 'log', label: 'Log' }
    ];

    return (
        <div className="tabs">
            {tabs.map((tab) => (
                <div
                    key={tab.id}
                    className={`tab ${activeTab === tab.id ? 'active' : ''}`}
                    onClick={() => onChangeTab(tab.id)}
                >
                    {tab.label}
                </div>
            ))}
        </div>
    );
}
