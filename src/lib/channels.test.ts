import { describe, it, expect } from 'vitest';
import { extractProvider, normalizeChannel, findBestVariantMatch } from './channels';

describe('extractProvider', () => {
    it('detecta proveedores por prefijo', () => {
        expect(extractProvider('PRIME_123')).toBe('Prime Video');
        expect(extractProvider('SKYS_999')).toBe('SkyShowtime');
        expect(extractProvider('DSN_1')).toBe('Disney+');
    });

    it('Filmin no lleva guión bajo y se detecta por startsWith', () => {
        expect(extractProvider('FLMN10000050694')).toBe('Filmin');
    });

    it('es case-insensitive (usa toUpperCase)', () => {
        expect(extractProvider('prime_123')).toBe('Prime Video');
    });

    it('slugs válidos de OTV sin prefijo conocido → null (no es error)', () => {
        // hoppers, scream-7… son IDs válidos pero no tienen prefijo de proveedor
        expect(extractProvider('hoppers')).toBeNull();
        expect(extractProvider('scream-7')).toBeNull();
    });

    it('contentId vacío o demasiado corto → null', () => {
        expect(extractProvider(undefined)).toBeNull();
        expect(extractProvider('')).toBeNull();
        expect(extractProvider('A')).toBeNull();
    });
});

describe('normalizeChannel', () => {
    it('quita sufijos comunes y el número de canal de Figma', () => {
        expect(normalizeChannel('Antena 3 - 3')).toBe('antena3');
        expect(normalizeChannel('discovery_logo')).toBe('discovery');
    });

    it('MOVISTAR_ se colapsa a m', () => {
        expect(normalizeChannel('MOVISTAR_LALIGA')).toBe('mlaliga');
    });

    it('quita el prefijo canal', () => {
        expect(normalizeChannel('CANAL_HOLLYWOOD')).toBe('hollywood');
    });
});

describe('findBestVariantMatch', () => {
    it('0. exact match tiene prioridad', () => {
        expect(findBestVariantMatch('LA_SEXTA', ['LA_SEXTA', 'otra'])).toBe('LA_SEXTA');
    });

    it('1. usa la tabla CHANNEL_TO_PROVIDER cuando la variante existe', () => {
        expect(findBestVariantMatch('LA_SEXTA', ['La sexta -6', 'x'])).toBe('La sexta -6');
    });

    it('2. case-insensitive exact', () => {
        expect(findBestVariantMatch('cuatro', ['Cuatro', 'x'])).toBe('Cuatro');
    });

    it('3. match normalizado', () => {
        // "Antena 3 - 3" normaliza a "antena3"; la variante "ANTENA_3" también
        expect(findBestVariantMatch('ANTENA_3', ['Antena 3 - 3'])).toBe('Antena 3 - 3');
    });

    it('devuelve null si nada encaja', () => {
        expect(findBestVariantMatch('zzz_desconocido', ['Cuatro', 'Telecinco'])).toBeNull();
    });
});
