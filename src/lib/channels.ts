// Lógica pura de proveedores y canales — extraída de code.ts para poder testearla.
// El backend (code.ts) importa de aquí; esbuild lo inlinea en plugin/code.js.

// -- Provider prefix → variable value mapping --
export const PROVIDER_MAP: { [prefix: string]: string } = {
    PRIME: 'Prime Video',
    SKYS: 'SkyShowtime',
    DSN: 'Disney+',
    MAX: 'Max',
    RTVE: 'RTVE Play',
    FLMN: 'Filmin',
    APREM: 'A3 Premium',
};

// -- Extract provider from contentId prefix --
export function extractProvider(contentId: string | undefined): string | null {
    if (!contentId || contentId.length < 2) return null;

    const idUpper = contentId.toUpperCase();
    for (const key of Object.keys(PROVIDER_MAP)) {
        if (idUpper.startsWith(key)) {
            return PROVIDER_MAP[key];
        }
    }
    return null;
}

// Map from URL channel name (extracted from icon URL) → Figma provider variant name.
// Only needed for cases where normalization can't resolve the match.
export const CHANNEL_TO_PROVIDER: Record<string, string> = {
    // Numeric channel IDs
    '1': 'TVE - 1',
    '2': 'La 2 - 2',
    // TDT principales
    ANTENA_3: 'Antena 3 - 3',
    CUATRO: 'Cuatro - 4',
    TELECINCO: 'Telecinco - 5',
    LA_SEXTA: 'La sexta -6',
    // Canales temáticos con nombre diferente
    XTRM: 'xtreme - 17',
    NAT_GEO: 'nationalgeographic - 61',
    CLAN: 'clanHD - 91',
    CANAL_HOLLYWOOD: 'hollywood',
    CANAL_HISTORIA_LOGO: 'historia - 60',
    CANAL_COCINA_4K: 'Canal Cocina - 68',
    discovery_logo: 'discovery - 64',
    ODISEA_4K: 'odisea - 63',
    WARNER_TV_B: 'warner tv - 13',
    STAR_CHANNEL: 'StarChannel',
    VIN_TV: 'verditv - 48',
    '24H': 'tdp - 103',
    // Deportes — MOVISTAR_ → M
    MOVISTAR_LALIGA: 'MLaLiga - 110',
    MOVISTAR_LALIGA_HDR: 'MLaLiga - 110',
    MOVISTAR_LALIGA_2: 'MLaLiga2 - 112',
    MOVISTAR_LALIGA_2_HDR: 'MLaLiga2 - 112',
    MOVISTAR_LALIGA_3: 'MLaLiga+ - 122',
    MOVISTAR_LIGA_DE_CAMPEONES: 'MLiga de Campeones - 115',
    MOVISTAR_LIGA_DE_CAMPEONES_2: 'MLiga de Campeones 2 - 116',
    MOVISTAR_LIGA_DE_CAMPEONES_3: 'MLiga de Campeones - 117',
    LALIGA_HYPERMOTION: 'MLaLigaHyper - 119',
    LALIGA_HYPERMOTION_2: 'MLaLigaHyper 2 - 120',
    LALIGA_INSIDE: 'laLigaLiveTvInside',
    DAZN_F1: 'DAZNF1',
    DAZN_LALIGA: 'DAZN1',
    DAZN_LALIGA_2: 'DAZN2',
    DAZN_BALONCESTO: 'DAZN3',
    DAZN_BALONCESTO_2: 'DAZN4',
    DAZN_MOTOGP: 'DAZN Motor',
    PRIMERA_FEDERACION: 'TodoFutbol',
    // Runtime → RT (Spanish translations)
    RUNTIME_ACTION_WHITE: 'RT_Acción - 43',
    RUNTIME_CINE_Y_SERIES_WHITE: 'RT_Cine y series - 41',
    RUNTIME_THRILLER_HORROR_WHITE: 'RT_Thriller - 42',
    RUNTIME_COMEDY_WHITE: 'RT_Comedia - 44',
    RUNTIME_CRIME_WHITE: 'RT_Crimen - 45',
    RUNTIME_ROMANCE_WHITE: 'RT_Romance - 46',
    RUNTIME_CLASSICS_WHITE: 'RT_Clásicos - 47',
    RUNTIME_FAMILIA: 'enfamilia - 20',
    RUNTIME_SERIES_WHITE: 'RT_Cine y series - 41',
    // AMC
    AMC_BREAK: 'amcBreak',
    AMC_CRIME: 'amcCrime',
    AMC_WESTERN: 'amc western',
    AMC_LIVING: 'amc living',
    // Eurosport
    EUROSPORT_1_WHITE: 'eurosport1',
    EUROSPORT_2_WHITE: 'eurosport2',
    // Deportes misc
    RUGBY_SPAIN_WHITE: 'rugbySpain',
    TENNIS_CHANNEL: 'tennisChannel',
    MY_PADEL_TV: 'myPadelTv',
    HORSE_TV: 'horseTV',
    NAUTICAL_CHANNEL: 'nauticalChannel',
    // Sky
    SKYSHOWTIME_1: 'SkyShowtime1',
};

// Normalize a channel name for fuzzy matching: lowercase, strip suffixes, underscores → spaces → collapsed
export function normalizeChannel(name: string): string {
    return name
        .toLowerCase()
        .replace(/_/g, ' ')
        .replace(/\b(logo|4k|white|hd|b|v2|color)\b/g, '') // common URL suffixes
        .replace(/\s*-\s*\d+\s*$/, '') // Figma " - N" channel number
        .replace(/^canal\s+/i, '') // CANAL_ prefix
        .replace(/^movistar\s+/i, 'm') // MOVISTAR_ → M
        .replace(/\s+/g, '') // collapse spaces
        .trim();
}

export function findBestVariantMatch(providerValue: string, variantOptions: string[]): string | null {
    // 0. Exact match — cuando las variantes de Figma se renombren para coincidir con los nombres
    // de URL de OTV (ej. "LA_SEXTA", "ANTENA3"), esto resolverá directamente sin necesitar la tabla.
    // TODO: Una vez completado ese renombrado, CHANNEL_TO_PROVIDER puede eliminarse.
    if (variantOptions.includes(providerValue)) return providerValue;
    // 1. Hardcoded mapping table (URL channel name → Figma variant name actual)
    const mapped = CHANNEL_TO_PROVIDER[providerValue];
    if (mapped && variantOptions.includes(mapped)) return mapped;
    // 2. Case-insensitive exact
    const lower = providerValue.toLowerCase();
    const ciMatch = variantOptions.find((o) => o.toLowerCase() === lower);
    if (ciMatch) return ciMatch;
    // 3. Normalized match
    const norm = normalizeChannel(providerValue);
    if (!norm) return null;
    const match = variantOptions.find((o) => normalizeChannel(o) === norm);
    if (match) return match;
    // 4. Substring match (normalized name contained in variant or vice versa)
    const subMatch = variantOptions.find((o) => {
        const normOpt = normalizeChannel(o);
        return normOpt.length >= 3 && (normOpt.includes(norm) || norm.includes(normOpt));
    });
    return subMatch || null;
}
