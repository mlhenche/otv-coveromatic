import React from 'react';

interface SelectionInfo {
    count: number;
    coverCount: number;
    titleTreatmentCount: number;
    componentType: string;
    chapterCardCount: number;
}

interface FooterLogProps {
    selectionInfo: SelectionInfo;
}

export default function FooterLog({ selectionInfo, onReload }: FooterLogProps & { onReload?: () => void }) {
    const { count, coverCount, titleTreatmentCount, componentType, chapterCardCount } = selectionInfo;

    const getSelectionText = () => {
        if (count === 0) return 'Selecciona componentes en Figma';

        let text = `${count} seleccionado(s)`;
        if (coverCount > 0) {
            if (titleTreatmentCount > 0) {
                text += ` • ${coverCount} cover(s) + títulos listos`;
            } else {
                text += ` • ${coverCount} cover(s) lista(s)`;
            }
        } else if (chapterCardCount > 0) {
            text += ` • ${chapterCardCount} card de capítulos lista(s)`;
        } else {
            text += ` • (tipo: ${componentType})`;
        }
        return text;
    };

    return (
        <div className="footer">
            <div className="selection-info">
                {getSelectionText()}
            </div>
            <button className="btn btn-reload" onClick={onReload} title="Cargar más / Actualizar">
                <span className="reload-icon">↻</span> Más
            </button>
        </div>
    );
}
