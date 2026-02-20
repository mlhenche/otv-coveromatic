import React from 'react';
import { CatalogItem } from './CoverCard';

interface VPSNextDialogProps {
    entry: CatalogItem;
    onClose: () => void;
    onAddChapters?: () => void;
    onAddRelated: () => void;
    onViewCast: () => void;
}

export default function VPSNextDialog({ entry, onClose, onAddChapters, onAddRelated, onViewCast }: VPSNextDialogProps) {
    const isSeries = entry.mediaType === 'tv';

    return (
        <div className="vps-next-dialog-overlay">
            <div className="vps-next-dialog-card">
                <div className="vps-next-dialog-header">
                    <span className="vps-next-dialog-icon">✅</span>
                    <h3>Contenido aplicado</h3>
                </div>
                <p className="vps-next-dialog-message">¿Qué quieres hacer ahora con <strong>{entry.title}</strong>?</p>
                <div className="vps-next-dialog-buttons">
                    {isSeries && (
                        <button className="vps-next-btn vps-next-btn-primary" onClick={onAddChapters}>
                            Añadir capítulos
                        </button>
                    )}
                    <button className={`vps-next-btn ${isSeries ? 'vps-next-btn-secondary' : 'vps-next-btn-primary'}`} onClick={onAddRelated}>
                        Añadir contenido relacionado
                    </button>
                    <button className="vps-next-btn vps-next-btn-secondary" onClick={onViewCast}>
                        Ver reparto
                    </button>
                    <button className="vps-next-btn vps-next-btn-tertiary" onClick={onClose}>
                        Más tarde
                    </button>
                </div>
            </div>
        </div>
    );
}
