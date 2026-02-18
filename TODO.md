# TODO — CoverOmatic v2

> Última actualización: 2026-02-18

---

## Tareas pendientes

### 1. Capítulos de series (TMDB API)
Sacar información de episodios para rellenar las **cards de capítulos**.

Endpoints relevantes:
- `GET /tv/{series_id}/season/{season_number}` → array `episodes[]` con todos los capítulos
- `GET /tv/{series_id}/season/{season_number}/episode/{episode_number}/images` → `stills[]` (landscape 16:9, cover del capítulo)

Campos útiles por episodio: `name`, `overview`, `air_date`, `episode_number`, `season_number`, `still_path`, `vote_average`

URLs de imagen: `https://image.tmdb.org/t/p/w780/{still_path}`

---

### 2. Provider logo por ID de contenido
Extraer el proveedor del ID del contenido para cambiar el valor de la variable **provider logo**.

Prefijos identificados hasta ahora:

| Prefijo en ID | Proveedor      |
|---------------|----------------|
| `PRIME`       | Prime Video    |
| `SKYS`        | SkyShowtime    |
| `DSN`         | Disney+        |
| `MAX`         | Max            |
| `RTVE`        | RTVE Play      |
| `FLMN`        | Filmin         |
| `APREM`       | A3 Premium     |

Implementación: al aplicar contenido, parsear el `id` del entry y mapear al nombre de variable correspondiente.

---

### 3. Retransmisiones deportivas
Empezar a pensar cómo gestionar el flujo para **contenido deportivo en directo**:
- ¿Qué tipo de card/componente usan?
- ¿Qué datos necesitan? (equipos, competición, fecha/hora, canal)
- ¿Fuente de datos? (TMDB no cubre deportes — ¿API propia, manual?)
- ¿Cómo encaja con el sistema de tipos actuales (portrait/landscape/vps)?
