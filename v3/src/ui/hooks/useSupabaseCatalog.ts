import { useQuery } from '@tanstack/react-query';

const SUPABASE_URL = 'https://zmzehngquxtqirpjxyhn.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InptemVobmdxdXh0cWlycGp4eWhuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE1MjU3ODksImV4cCI6MjA4NzEwMTc4OX0.aE19KXi3m0WjmZpxRyLNyETDVI5sAyg0JfLNOe_c4Aw';

async function sbFetch(endpoint: string) {
    const url = `${SUPABASE_URL}/rest/v1/${endpoint}`;
    const response = await fetch(url, {
        headers: {
            'apikey': SUPABASE_ANON_KEY,
            'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
            'Content-Type': 'application/json'
        }
    });

    if (!response.ok) {
        throw new Error(`Supabase error ${response.status}: ${await response.text()}`);
    }

    return response.json();
}

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
            const [contents, genres, config] = await Promise.all([
                sbFetch('contents?active=eq.true&select=title,content_id,media_type,tmdb_id,tmdb_title,genre_ids,provider'),
                sbFetch('genres?select=id,name'),
                sbFetch('config?key=eq.url_patterns&select=value')
            ]);

            const genreNames: Record<number, string> = {};
            genres.forEach((g: any) => { genreNames[g.id] = g.name; });

            const catalog: Record<string, CatalogItem> = {};
            const movies: CatalogItem[] = [];
            const series: CatalogItem[] = [];

            contents.forEach((c: any) => {
                const key = c.title.toLowerCase().replace(/[^a-z0-9]/g, '');
                const item = {
                    title: c.title,
                    contentId: c.content_id,
                    mediaType: c.media_type,
                    tmdbId: c.tmdb_id,
                    tmdbTitle: c.tmdb_title,
                    genreIds: c.genre_ids || []
                };
                catalog[key] = item;
                if (item.mediaType === 'movie') movies.push(item);
                if (item.mediaType === 'tv') series.push(item);
            });

            const urlPatterns = config[0]?.value || {
                coverArt: 'https://pc.orangetv.orange.es/pc/api/rtv/v1/images/vod/COVER_ART/{contentId}_COVER_ART.jpg?width=3840&height=2160',
                vertical: 'https://pc.orangetv.orange.es/pc/api/rtv/v1/images/vod/VERTICAL/{contentId}_VERTICAL.jpg?width=3840&height=2160',
                background: 'https://pc.orangetv.orange.es/pc/api/rtv/v1/images/vod/BACKGROUND/{contentId}_BACKGROUND.jpg?width=3840&height=2160',
                titleTreatment: 'https://pc.orangetv.orange.es/pc/api/rtv/v1/images/vod/TITLE_TREATMENT/{contentId}_title_treatment.png?width=1280&height=720'
            };

            return {
                generatedAt: new Date().toISOString(),
                source: 'Supabase',
                totalContents: contents.length,
                urlPatterns,
                catalog,
                genreNames,
                movies,
                series
            };
        },
        staleTime: 4 * 60 * 60 * 1000 // 4 hours matching the original manual config
    });
}
