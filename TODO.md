# TODO — CoverOmatic v2

> Última actualización: 2026-02-18

---

## Tareas pendientes

### 1. Provider logo por ID de contenido
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

### 2. Búsqueda de reparto por ID de TMDB (VPS)
Al aplicar contenido a una VPS, la búsqueda de actores en la pestaña Personas debe usar el **`person_id` de TMDB** en lugar del nombre.

Motivo: buscar por nombre falla cuando hay caracteres especiales, nombres ambiguos o variaciones de escritura.

Endpoint correcto:
- `GET /person/{person_id}` → datos del actor
- `GET /person/{person_id}/images` → fotos del actor

Cambio necesario: el catálogo ya almacena el `tmdbId` del contenido; al cargar el reparto usar los IDs de persona del endpoint `GET /movie/{id}/credits` o `GET /tv/{id}/credits` → campo `cast[].id` en lugar de `cast[].name` para hacer lookups posteriores.

---

### 3. Retransmisiones deportivas
Empezar a pensar cómo gestionar el flujo para **contenido deportivo en directo**:
- ¿Qué tipo de card/componente usan?
- ¿Qué datos necesitan? (equipos, competición, fecha/hora, canal)
- ¿Fuente de datos? (TMDB no cubre deportes — ¿API propia, manual?)
- ¿Cómo encaja con el sistema de tipos actuales (portrait/landscape/vps)?
