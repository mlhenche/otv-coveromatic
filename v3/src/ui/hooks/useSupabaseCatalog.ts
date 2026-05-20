import { useQuery } from '@tanstack/react-query';

const CATALOG_URL = 'https://raw.githubusercontent.com/mlhenche/otv-coveromatic/main/v3/catalog/otv-catalog.json';

const URL_PATTERNS = {
    coverArt: 'https://pc.orangetv.orange.es/pc/api/rtv/v1/images/vod/COVER_ART/{contentId}_COVER_ART.jpg?width=3840&height=2160',
    vertical: 'https://pc.orangetv.orange.es/pc/api/rtv/v1/images/vod/VERTICAL/{contentId}_VERTICAL.jpg?width=3840&height=2160',
    background: 'https://pc.orangetv.orange.es/pc/api/rtv/v1/images/vod/BACKGROUND/{contentId}_BACKGROUND.jpg?width=3840&height=2160',
    titleTreatment: 'https://pc.orangetv.orange.es/pc/api/rtv/v1/images/vod/TITLE_TREATMENT/{contentId}_title_treatment.png?width=1280&height=720',
};

export interface CatalogItem {
    title: string;
    contentId: string;
    mediaType: string;
    tmdbId: string;
    tmdbTitle: string;
    genreIds: number[];
}

export interface CatalogData {
    generatedAt: string;
    source: string;
    totalContents: number;
    urlPatterns: Record<string, string>;
    catalog: Record<string, CatalogItem>;
    genreNames: Record<number, string>;
    movies: CatalogItem[];
    series: CatalogItem[];
}

export function useSupabaseCatalog() {
    return useQuery<CatalogData>({
        queryKey: ['otvCatalog'],
        queryFn: async () => {
            const response = await fetch(CATALOG_URL);
            if (!response.ok) {
                throw new Error(`Error cargando catálogo: ${response.status}`);
            }
            const json = await response.json();

            const genreNames: Record<number, string> = {};
            if (json.genres) {
                Object.entries(json.genres).forEach(([id, name]) => {
                    genreNames[Number(id)] = name as string;
                });
            }

            const catalog: Record<string, CatalogItem> = {};
            const movies: CatalogItem[] = [];
            const series: CatalogItem[] = [];

            Object.entries(json.catalog).forEach(([key, raw]: [string, any]) => {
                const item: CatalogItem = {
                    title: raw.title,
                    contentId: raw.contentId,
                    mediaType: raw.mediaType || '',
                    tmdbId: raw.tmdbId || '',
                    tmdbTitle: raw.tmdbTitle || '',
                    genreIds: raw.genreIds || [],
                };
                catalog[key] = item;
                if (item.mediaType === 'movie') movies.push(item);
                if (item.mediaType === 'tv') series.push(item);
            });

            return {
                generatedAt: json.generatedAt,
                source: 'GitHub',
                totalContents: Object.keys(catalog).length,
                urlPatterns: URL_PATTERNS,
                catalog,
                genreNames,
                movies,
                series,
            };
        },
        staleTime: 4 * 60 * 60 * 1000
    });
}
