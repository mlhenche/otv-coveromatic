import { useQuery, useMutation } from '@tanstack/react-query';

const API_BASE = 'https://api.themoviedb.org/3';

export class TmdbAuthError extends Error {
    constructor() {
        super('TMDB API key inválida o caducada');
        this.name = 'TmdbAuthError';
    }
}

async function tmdbFetch(url: string) {
    const response = await fetch(url);
    if (response.status === 401 || response.status === 403) {
        throw new TmdbAuthError();
    }
    if (!response.ok) {
        throw new Error(`TMDB HTTP Error: ${response.status}`);
    }
    return response.json();
}

export function useTMDBPersonSearch(apiKey: string, query: string) {
    return useQuery({
        queryKey: ['tmdb', 'person', query],
        queryFn: async () => {
            if (!apiKey) return [];
            const url = query
                ? `${API_BASE}/search/person?api_key=${apiKey}&language=es-ES&query=${encodeURIComponent(query)}&page=1`
                : `${API_BASE}/trending/person/week?api_key=${apiKey}&language=es-ES&page=1`;

            const data = await tmdbFetch(url);
            return (data.results || []).filter((item: any) => item.profile_path);
        },
        enabled: !!apiKey,
    });
}

export function useTMDBMultiSearch(apiKey: string, query: string) {
    return useQuery({
        queryKey: ['tmdb', 'multi', query],
        queryFn: async () => {
            if (!apiKey || query.length < 3) return [];
            const url = `${API_BASE}/search/multi?api_key=${apiKey}&language=es-ES&query=${encodeURIComponent(query)}&page=1`;
            const data = await tmdbFetch(url);
            return (data.results || []).filter((item: any) => item.media_type === 'movie' || item.media_type === 'tv').slice(0, 10);
        },
        enabled: !!apiKey && query.length >= 3,
    });
}

export function useTMDBCredits(apiKey: string, contentId: number | string, mediaType: string) {
    return useQuery({
        queryKey: ['tmdb', 'credits', contentId, mediaType],
        queryFn: async () => {
            if (!apiKey || !contentId) return [];
            const url = `${API_BASE}/${mediaType}/${contentId}/credits?api_key=${apiKey}&language=es-ES`;
            const data = await tmdbFetch(url);

            const castAll = (data.cast || []).filter((p: any) => p.profile_path);
            const crewAll = (data.crew || []).filter((p: any) => p.profile_path);

            const director = crewAll.find((c: any) => c.job === 'Director');
            const writers = crewAll.filter((c: any) => c.job === 'Screenplay' || c.job === 'Writer');

            const seen = new Set();
            const people: any[] = [];
            if (director) { seen.add(director.id); people.push(director); }
            for (const w of writers) {
                if (!seen.has(w.id)) { seen.add(w.id); people.push(w); }
            }
            for (const c of castAll) {
                if (!seen.has(c.id)) { seen.add(c.id); people.push(c); }
            }

            return people.map(p => ({
                id: p.id,
                name: p.name,
                profile_path: p.profile_path,
                known_for_department: p.known_for_department || (p.job ? 'Crew' : 'Acting'),
                character: p.character || p.job || ''
            }));
        },
        enabled: !!apiKey && !!contentId,
    });
}

export function useTMDBSeasons(apiKey: string, tmdbId: number | string | null) {
    return useQuery({
        queryKey: ['tmdb', 'seasons', tmdbId],
        queryFn: async () => {
            if (!apiKey || !tmdbId) return [];
            const url = `${API_BASE}/tv/${tmdbId}?api_key=${apiKey}&language=es-ES`;
            const data = await tmdbFetch(url);
            return (data.seasons || []).filter((s: any) => s.season_number > 0);
        },
        enabled: !!apiKey && !!tmdbId,
    });
}

export function useTMDBEpisodes(apiKey: string, tmdbId: number | string | null, seasonNumber: number | null) {
    return useQuery({
        queryKey: ['tmdb', 'episodes', tmdbId, seasonNumber],
        queryFn: async () => {
            if (!apiKey || !tmdbId || seasonNumber === null) return [];
            const url = `${API_BASE}/tv/${tmdbId}/season/${seasonNumber}?api_key=${apiKey}&language=es-ES`;
            const data = await tmdbFetch(url);
            return data.episodes || [];
        },
        enabled: !!apiKey && !!tmdbId && seasonNumber !== null,
    });
}
