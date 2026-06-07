import React from 'react';

interface OverlaysProps {
    applying: boolean;
    typePickerCallback?: ((type: string | null) => void) | null;
    setTypePickerCallback: (cb: any) => void;
}

export default function Overlays({ applying, typePickerCallback, setTypePickerCallback }: OverlaysProps) {

    const handleTypePick = (type: string | null) => {
        if (typePickerCallback) {
            typePickerCallback(type);
            setTypePickerCallback(null);
        }
    };

    return (
        <>
            <div className={`applying-overlay ${applying ? '' : 'hidden'}`}>
                <div className="message">
                    <div className="spinner"></div>
                    Aplicando cover...
                </div>
            </div>

            <div className={`type-picker-overlay ${typePickerCallback ? '' : 'hidden'}`}>
                <div className="type-picker-card">
                    <h3>¿Qué tipo de imagen?</h3>
                    <p>No se pudo detectar el tipo automáticamente. Elige el formato de imagen para los frames seleccionados.</p>
                    <div className="type-picker-options">
                        <button className="type-picker-btn" onClick={() => handleTypePick('card-portrait')}>
                            <span className="icon">🖼</span>
                            <span><span className="label">Portrait</span><span className="desc">Imagen vertical (VERTICAL)</span></span>
                        </button>
                        <button className="type-picker-btn" onClick={() => handleTypePick('card-landscape')}>
                            <span className="icon">🎬</span>
                            <span><span className="label">Landscape</span><span className="desc">Imagen horizontal (COVER_ART)</span></span>
                        </button>
                        <button className="type-picker-btn" onClick={() => handleTypePick('vps')}>
                            <span className="icon">🌅</span>
                            <span><span className="label">Background</span><span className="desc">Fondo pantalla completa (BACKGROUND)</span></span>
                        </button>
                    </div>
                    <button className="type-picker-cancel" onClick={() => handleTypePick(null)}>Cancelar</button>
                </div>
            </div>
        </>
    );
}
