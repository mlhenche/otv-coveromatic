-- ============================================
-- CoverOmatic v3 — Supabase Schema
-- ============================================

-- Tabla: contents (catálogo OTV)
CREATE TABLE contents (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  title       text NOT NULL,
  content_id  text UNIQUE NOT NULL,
  media_type  text CHECK (media_type IN ('movie', 'tv')),
  tmdb_id     integer,
  tmdb_title  text,
  genre_ids   integer[] DEFAULT '{}',
  provider    text,
  active      boolean DEFAULT true,
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now()
);

-- Índices
CREATE INDEX idx_contents_media_type ON contents (media_type);
CREATE INDEX idx_contents_genre_ids ON contents USING GIN (genre_ids);
CREATE INDEX idx_contents_active ON contents (active);

-- Tabla: genres (mapeo id → nombre en español)
CREATE TABLE genres (
  id    integer PRIMARY KEY,
  name  text NOT NULL
);

-- Tabla: config (configuración general)
CREATE TABLE config (
  key   text PRIMARY KEY,
  value jsonb NOT NULL
);

-- ============================================
-- Row Level Security (RLS)
-- ============================================

-- contents: lectura pública, escritura solo autenticados
ALTER TABLE contents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read contents" ON contents FOR SELECT USING (true);
CREATE POLICY "Auth write contents" ON contents FOR ALL USING (auth.role() = 'authenticated');

-- genres: solo lectura pública
ALTER TABLE genres ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read genres" ON genres FOR SELECT USING (true);
CREATE POLICY "Auth write genres" ON genres FOR ALL USING (auth.role() = 'authenticated');

-- config: solo lectura pública
ALTER TABLE config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read config" ON config FOR SELECT USING (true);
CREATE POLICY "Auth write config" ON config FOR ALL USING (auth.role() = 'authenticated');

-- ============================================
-- Trigger: auto-actualizar updated_at
-- ============================================

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER contents_updated_at
  BEFORE UPDATE ON contents
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================
-- Datos iniciales: config
-- ============================================

INSERT INTO config (key, value) VALUES
('url_patterns', '{
  "coverArt": "https://pc.orangetv.orange.es/pc/api/rtv/v1/images/vod/COVER_ART/{contentId}_COVER_ART.jpg?width=3840&height=2160",
  "vertical": "https://pc.orangetv.orange.es/pc/api/rtv/v1/images/vod/VERTICAL/{contentId}_VERTICAL.jpg?width=3840&height=2160",
  "background": "https://pc.orangetv.orange.es/pc/api/rtv/v1/images/vod/BACKGROUND/{contentId}_BACKGROUND.jpg?width=3840&height=2160",
  "titleTreatment": "https://pc.orangetv.orange.es/pc/api/rtv/v1/images/vod/TITLE_TREATMENT/{contentId}_title_treatment.png?width=1280&height=720"
}'::jsonb),
('provider_map', '{
  "PRIME": "Prime Video",
  "SKYS": "SkyShowtime",
  "DSN": "Disney+",
  "MAX": "Max",
  "RTVE": "RTVE Play",
  "FLMN": "Filmin",
  "APREM": "A3 Premium",
  "MFO": "Orange TV",
  "FLX": "Orange TV"
}'::jsonb);
